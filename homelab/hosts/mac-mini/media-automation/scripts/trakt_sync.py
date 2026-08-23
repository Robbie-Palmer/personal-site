#!/usr/bin/env python3
"""Trakt bridge: one community-app connection drives the whole loop.

Free Trakt accounts may hold a single OAuth connection at a time, so the
native integrations (Jellyfin plugin + two *arr import lists) cannot coexist.
This bridge replaces all three with one authorization against the user's own
registered Trakt application (see ADR 021):

  watchlist  -> Sonarr (shows) and Radarr (movies) adds
  plays      -> Jellyfin watched state pushed to Trakt

Subcommands:
    auth    Interactive device-code flow; stores the token for `sync`.
    sync    Non-interactive pass: refresh the token if due, pull the
            watchlist into the *arr apps, push new plays to Trakt.

Configuration comes from the environment:
    TRAKT_CLIENT_ID / TRAKT_CLIENT_SECRET   from the user's Trakt app page
    TRAKT_USERNAME                          whose watchlist to read
    MEDIA_AUTOMATION_DIR                    runtime state root (data/trakt)
    SONARR_URL / RADARR_URL                 container-internal HTTP endpoints
    SONARR_API_KEY / RADARR_API_KEY         *arr API keys
    JELLYFIN_URL                            defaults to http://localhost:8096
    JELLYFIN_ENV                            path to jellyfin/.env holding the
                                            admin credentials (optional; the
                                            watched-state half is skipped if
                                            absent or auth fails)
"""

import json
import os
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

TRAKT = "https://api.trakt.tv"
SONARR = f"http://localhost:{os.environ.get('SONARR_PORT', '8989')}"  # NOSONAR S5332: private Compose network
RADARR = f"http://localhost:{os.environ.get('RADARR_PORT', '7878')}"  # NOSONAR S5332: private Compose network
JELLYFIN = os.environ.get("JELLYFIN_URL", "http://localhost:8096")  # NOSONAR S5332: loopback on the hub

STATE_DIR = os.path.join(
    os.environ.get("MEDIA_AUTOMATION_DIR", "."), "data", "trakt")
TOKEN_PATH = os.path.join(STATE_DIR, "token.json")
WATCHLIST_WATERMARK = os.path.join(STATE_DIR, "last_watchlist_sync")
PLAYED_WATERMARK = os.path.join(STATE_DIR, "last_played_sync")


def fail(message):
    raise SystemExit(message)


class Http:
    """Small JSON client that never raises on unexpected status codes."""

    def __init__(self):
        self.last_error = None

    def json(self, method, url, payload=None, headers=None):
        self.last_error = None
        data = json.dumps(payload).encode() if payload is not None else None
        base = {"Content-Type": "application/json", "Accept": "application/json"}
        for key, value in (headers or {}).items():
            base[key] = value
        req = urllib.request.Request(url, data=data, method=method, headers=base)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode()
                return resp.status, (json.loads(body) if body.strip() else None)
        except urllib.error.HTTPError as exc:
            self.last_error = f"HTTP {exc.code}"
            try:
                return exc.code, json.loads(exc.read().decode())
            except Exception:
                return exc.code, None
        except (urllib.error.URLError, socket.timeout, OSError) as exc:
            self.last_error = str(getattr(exc, "reason", exc))
            return None, None


http = Http()


# --- Trakt authorization -----------------------------------------------------

def load_token():
    if not os.path.exists(TOKEN_PATH):
        return None
    with open(TOKEN_PATH) as fh:
        return json.load(fh)


def store_token(token):
    os.makedirs(STATE_DIR, exist_ok=True)
    fd = os.open(TOKEN_PATH, os.O_WRONLY | os.O_CREAT | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "w") as fh:
        json.dump(token, fh)


def trakt_headers(access_token):
    headers = {
        "trakt-api-version": "2",
        "trakt-api-key": os.environ["TRAKT_CLIENT_ID"],
    }
    if access_token:
        headers["Authorization"] = f"Bearer {access_token}"
    return headers


def device_authorize():
    client_id = os.environ.get("TRAKT_CLIENT_ID", "").strip()
    client_secret = os.environ.get("TRAKT_CLIENT_SECRET", "").strip()
    if not client_id or not client_secret:
        fail(
            "Set TRAKT_CLIENT_ID and TRAKT_CLIENT_SECRET from "
            "https://trakt.tv/oauth/applications first."
        )
    status, data = http.json(
        "POST", f"{TRAKT}/oauth/device/code",
        {"client_id": client_id}, trakt_headers(None))
    if status != 200 or not data:
        fail(f"Could not start device flow ({http.last_error}).")
    print(f"Open {data['verification_url']} and enter code: {data['user_code']}")
    deadline = time.time() + data["expires_in"]
    interval = max(int(data.get("interval", 5)), 3)
    while time.time() < deadline:
        time.sleep(interval)
        status, token = http.json(
            "POST", f"{TRAKT}/oauth/device/token",
            {"code": data["device_code"], "client_id": client_id,
             "client_secret": client_secret}, trakt_headers(None))
        if status == 200:
            token["created_at"] = int(time.time())
            store_token(token)
            print("Authorized. Token stored.")
            return
        detail = (token or {}).get("error_description", http.last_error)
        if status == 400:  # still pending at Trakt
            continue
        fail(f"Authorization failed ({status}: {detail}).")
    fail("Device code expired before approval; run auth again.")


def fresh_access_token():
    token = load_token()
    if not token:
        print("Trakt: no stored token; run scripts/trakt_sync.py auth first.")
        return None
    if time.time() < token["created_at"] + token["expires_in"] - 3600:
        return token["access_token"]
    status, refreshed = http.json(
        "POST", f"{TRAKT}/oauth/token",
        {"refresh_token": token["refresh_token"], "client_id":
         os.environ["TRAKT_CLIENT_ID"], "client_secret":
         os.environ["TRAKT_CLIENT_SECRET"], "grant_type": "refresh_token"},
        trakt_headers(None))
    if status != 200 or not refreshed:
        print(f"Trakt: token refresh failed ({http.last_error}); "
              "run scripts/trakt_sync.py auth again.")
        return None
    refreshed["created_at"] = int(time.time())
    store_token(refreshed)
    return refreshed["access_token"]


# --- Watchlist -> Sonarr/Radarr ----------------------------------------------

def watermark(path):
    if os.path.exists(path):
        with open(path) as fh:
            return float(fh.read().strip() or 0)
    return 0


def stamp(path, value):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w") as fh:
        fh.write(str(value))


def quality_profile_id(app, api_key, name):
    status, profiles = http.json(
        "GET", f"{app}/api/v3/qualityprofile", headers={"X-Api-Key": api_key})
    if status == 200:
        for profile in profiles or []:
            if profile["name"] == name:
                return profile["id"]
    fail(f"Quality profile '{name}' not found; provision the stack first.")


def sync_watchlist(access_token):
    username = os.environ.get("TRAKT_USERNAME", "").strip()
    sonarr_key = os.environ["SONARR_API_KEY"]
    radarr_key = os.environ["RADARR_API_KEY"]
    since = watermark(WATCHLIST_WATERMARK)
    now = time.time()

    status, items = http.json(
        "GET", f"{TRAKT}/users/{urllib.parse.quote(username)}/watchlist?extended=full",
        headers=trakt_headers(access_token))
    if status != 200:
        print(f"Trakt: watchlist fetch failed ({http.last_error}); "
              "keeping previous watermark.")
        return
    added = skipped = 0
    for entry in items or []:
        kind = entry.get("type")
        item = entry.get(kind) or {}
        listed = _parse_listed_at(entry.get("listed_at"))
        if since and listed is not None and listed <= since:
            continue  # already handled in an earlier pass
        if kind == "show" and add_show(item, sonarr_key):
            added += 1
        elif kind == "movie" and add_movie(item, radarr_key):
            added += 1
        else:
            skipped += 1
    stamp(WATCHLIST_WATERMARK, now)
    print(f"Watchlist: {added} added, {skipped} already present.")


def _parse_listed_at(value):
    if not value:
        return None
    import calendar
    parsed = time.strptime(value[:19], "%Y-%m-%dT%H:%M:%S")
    return calendar.timegm(parsed)


def add_show(show, api_key):
    tvdb_id = (show.get("ids") or {}).get("tvdb")
    title = show.get("title", "?")
    if not tvdb_id:
        print(f"  ! '{title}' has no TVDB id; skipping")
        return False
    status, library = http.json(
        "GET", f"{SONARR}/api/v3/series", headers={"X-Api-Key": api_key})
    if any(s.get("tvdbId") == tvdb_id for s in library or []):
        return False
    status, found = http.json(
        "GET", f"{SONARR}/api/v3/series/lookup?term={urllib.parse.quote('tvdb:%d' % tvdb_id)}",
        headers={"X-Api-Key": api_key})
    if status != 200 or not found:
        print(f"  ! '{title}' not found in Sonarr lookup ({http.last_error})")
        return True  # counted as handled so it is retried next pass
    candidate = found[0]
    payload = {
        "title": candidate.get("title"),
        "tvdbId": tvdb_id,
        "seasons": candidate.get("seasons"),
        "profileId": quality_profile_id(
            SONARR, api_key, os.environ.get("TRAKT_SONARR_PROFILE", "WEB-1080p")),
        "rootFolderPath": "/media/TV",
        "monitored": True,
        "seasonFolder": False,
        "monitorNewItems": "all",
        "addOptions": {"monitor": "all", "searchForMissingEpisodes": True},
    }
    status, _ = http.json(
        "POST", f"{SONARR}/api/v3/series", payload,
        headers={"X-Api-Key": api_key})
    if status in (200, 201):
        print(f"  + series '{candidate.get('title')}' added to Sonarr")
        return True
    print(f"  ! Sonarr rejected '{title}' ({status}: {http.last_error})")
    return True


def add_movie(movie, api_key):
    tmdb_id = (movie.get("ids") or {}).get("tmdb")
    title = movie.get("title", "?")
    if not tmdb_id:
        print(f"  ! '{title}' has no TMDB id; skipping")
        return False
    status, library = http.json(
        "GET", f"{RADARR}/api/v3/movie", headers={"X-Api-Key": api_key})
    if any(m.get("tmdbId") == tmdb_id for m in library or []):
        return False
    status, found = http.json(
        "GET", f"{RADARR}/api/v3/movie/lookup/tmdb?tmdbId={tmdb_id}",
        headers={"X-Api-Key": api_key})
    if status != 200 or not found:
        print(f"  ! '{title}' not found in Radarr lookup ({http.last_error})")
        return True
    payload = {
        "title": found.get("title", title),
        "tmdbId": tmdb_id,
        "qualityProfileId": quality_profile_id(
            RADARR, api_key, os.environ.get("TRAKT_RADARR_PROFILE", "HD Bluray + WEB")),
        "rootFolderPath": "/media/Movies",
        "monitored": True,
        "minimumAvailability": "released",
        "addOptions": {"searchForMovie": True},
    }
    status, _ = http.json(
        "POST", f"{RADARR}/api/v3/movie", payload,
        headers={"X-Api-Key": api_key})
    if status in (200, 201):
        print(f"  + movie '{payload['title']}' added to Radarr")
        return True
    print(f"  ! Radarr rejected '{title}' ({status}: {http.last_error})")
    return True


# --- Jellyfin plays -> Trakt ---------------------------------------------------

def read_jellyfin_credentials():
    env_path = os.environ.get(
        "TRAKT_JELLYFIN_ENV",
        os.path.join(os.path.dirname(os.environ.get(
            "MEDIA_AUTOMATION_DIR", ".")), "jellyfin", ".env"))
    values = {}
    try:
        with open(env_path) as fh:
            for line in fh:
                line = line.strip()
                if "=" in line and not line.startswith("#"):
                    key, value = line.split("=", 1)
                    values[key] = value
    except OSError:
        return None
    user = values.get("JELLYFIN_ADMIN_USER")
    password = values.get("JELLYFIN_ADMIN_PASSWORD")
    return (user, password) if user and password else None


def jellyfin_token():
    creds = read_jellyfin_credentials()
    if not creds:
        return None
    user, password = creds
    status, data = http.json(
        "POST", f"{JELLYFIN}/Users/AuthenticateByName",
        {"Username": user, "Pw": password},
        {"X-Emby-Authorization": 'MediaBrowser Client="trakt-sync", '
         'Device="hub", DeviceId="trakt-sync", Version="1.0"'})
    if status != 200:
        print(f"Trakt: Jellyfin auth failed ({http.last_error}); "
              "skipping played-state push.")
        return None
    return data["AccessToken"]


def collect_new_plays(jf_token):
    since = watermark(PLAYED_WATERMARK)
    now = time.time()
    movies, shows = [], []
    status, page = http.json(
        "GET", f"{JELLYFIN}/Items?Filters=IsPlayed&Recursive=true"
        f"&IncludeItemTypes=Episode,Movie&Limit=10000&SortBy=DatePlayed&SortOrder="
        f"Ascending&Fields=ParentIndexNumber,IndexNumber,SeriesId,ProviderIds,"
        f"ProductionYear&api_key={jf_token}")
    if status != 200:
        print(f"Trakt: Jellyfin query failed ({http.last_error}).")
        return movies, shows, since
    series_ids = {}
    latest = since
    for item in page.get("Items", []):
        played = (item.get("UserData") or {}).get("LastPlayedDate")
        if not played:
            continue
        played_epoch = _parse_listed_at(played.replace("Z", "+00:00").split("+")[0])
        if played_epoch is None:
            continue
        if played_epoch <= since:
            continue
        latest = max(latest, min(played_epoch, now - 1))
        watched_at = time.strftime(
            "%Y-%m-%dT%H:%M:%S.000Z", time.gmtime(played_epoch))
        if item.get("Type") == "Movie":
            tmdb = ((item.get("ProviderIds") or {}).get("Tmdb")
                    or (item.get("ProviderIds") or {}).get("TMDB"))
            if tmdb:
                movies.append({"ids": {"tmdb": int(tmdb)}, "watched_at": watched_at})
        else:
            sid = item.get("SeriesId")
            season = item.get("ParentIndexNumber")
            episode = item.get("IndexNumber")
            if not (sid and isinstance(season, int) and isinstance(episode, int)):
                continue
            entry = series_ids.setdefault(sid, {})
            entry.setdefault("_seasons", {}).setdefault(season, []).append({
                "number": episode, "watched_at": watched_at})
            entry["_played"] = played_epoch
    for sid, entry in series_ids.items():
        status, detail = http.json(
            "GET", f"{JELLYFIN}/Items/{sid}?Fields=ProviderIds&api_key={jf_token}")
        tvdb = ((detail or {}).get("ProviderIds") or {}).get("Tvdb")
        if not tvdb:
            continue
        seasons = [{"number": number, "episodes": eps}
                   for number, eps in sorted(entry["_seasons"].items())]
        shows.append({"ids": {"tvdb": int(tvdb)}, "seasons": seasons})
    return movies, shows, latest


def push_watched_state(access_token):
    jf_token = jellyfin_token()
    if not jf_token:
        return
    movies, shows, latest = collect_new_plays(jf_token)
    if not movies and not shows:
        print("Played-state: nothing new.")
        return
    payload = {}
    if movies:
        payload["movies"] = movies
    if shows:
        payload["shows"] = shows
    status, _ = http.json(
        "POST", f"{TRAKT}/sync/watched?extended=full", payload,
        trakt_headers(access_token))
    if status == 200:
        stamp(PLAYED_WATERMARK, latest)
        print(f"Played-state: pushed {len(movies)} movie(s), "
              f"{len(shows)} show(s).")
    else:
        print(f"Trakt: watched-state push failed ({http.last_error}).")


# --- Entry points ---------------------------------------------------------------

def sync():
    access_token = fresh_access_token()
    if not access_token:
        return 0
    sync_watchlist(access_token)
    push_watched_state(access_token)
    return 0


def main():
    command = sys.argv[1] if len(sys.argv) > 1 else ""
    if command == "auth":
        device_authorize()
        return 0
    if command == "sync":
        return sync()
    fail("usage: trakt_sync.py [auth|sync]")


if __name__ == "__main__":
    sys.exit(main())
