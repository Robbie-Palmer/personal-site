#!/usr/bin/env python3
"""Wire the media automation services together via their REST APIs.

Reads connection details from the environment (exported by provision.sh):
  PROWLARR_PORT, SONARR_PORT, RADARR_PORT, QBITTORRENT_PORT,
  QBITTORRENT_PASSWORD, PROWLARR_API_KEY, SONARR_API_KEY, RADARR_API_KEY

Idempotent: existing indexers/apps/download clients/root folders are left
alone. Prints one summary line per action.
"""

import json
import os
import socket
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

PROWLARR = f"http://localhost:{os.environ.get('PROWLARR_PORT', '9696')}"
SONARR = f"http://localhost:{os.environ.get('SONARR_PORT', '8989')}"
RADARR = f"http://localhost:{os.environ.get('RADARR_PORT', '7878')}"
QBIT = f"http://localhost:{os.environ.get('QBITTORRENT_PORT', '8080')}"

# Public Cardigann definitions provisioned into Prowlarr and synced to the apps.
# Base URL overrides: some mirrors block datacenter/user-agent traffic or have
# broken TLS from this network; thepiratebay.org answers while piratebay.org
# returns 403 from here.
INDEXER_DEFINITIONS = ["thepiratebay", "yts"]
INDEXER_BASE_URLS = {
    "thepiratebay": "https://thepiratebay.org/",
}

SONARR_CATEGORY = "tv-sonarr"
RADARR_CATEGORY = "radarr"


class Api:
    def __init__(self, base, key=None):
        self.base = base.rstrip("/")
        self.key = key

    def request(self, method, path, payload=None):
        data = json.dumps(payload).encode() if payload is not None else None
        req = urllib.request.Request(f"{self.base}{path}", data=data, method=method)
        req.add_header("Content-Type", "application/json")
        if self.key:
            req.add_header("X-Api-Key", self.key)
        try:
            with urllib.request.urlopen(req, timeout=30) as resp:
                body = resp.read().decode()
                return json.loads(body) if body.strip() else None
        except urllib.error.HTTPError as exc:
            detail = exc.read().decode(errors="replace")[:300]
            raise RuntimeError(f"{method} {path} -> HTTP {exc.code}: {detail}") from exc

    def get(self, path):
        return self.request("GET", path)

    def post(self, path, payload=None):
        return self.request("POST", path, payload)


def wait_port(host, port, name, timeout=180):
    host_only = host.split("//")[1].split(":")[0]
    deadline = time.time() + timeout
    while time.time() < deadline:
        try:
            with socket.create_connection((host_only, int(port)), timeout=3):
                return
        except OSError:
            time.sleep(4)
    raise SystemExit(f"{name} did not open its port within {timeout}s")


def qbit_login_once(username, password):
    """Attempt a qBittorrent WebUI login; returns cookie string or None.

    Success is HTTP 200/204; 403 means this client IP is temporarily banned
    from too many failed attempts.
    """
    query = urllib.parse.urlencode({"username": username, "password": password})
    req = urllib.request.Request(
        f"{QBIT}/api/v2/auth/login", data=query.encode(), method="POST"
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            resp.read()
            if resp.status not in (200, 204):
                return None
            set_cookie = resp.headers.get("Set-Cookie", "")
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"HTTP {exc.code}") from exc
    name = f"QBT_SID_{urllib.parse.urlparse(QBIT).port}="
    if name not in set_cookie:
        return None
    value = set_cookie.split(name, 1)[1].split(";", 1)[0]
    return f"{name}{value}"


def qbit_temp_password_from_logs():
    """Read the first-boot temporary WebUI password from container logs."""
    import subprocess
    logs = subprocess.run(
        ["docker", "logs", "qbittorrent"], capture_output=True, text=True,
    )
    for line in (logs.stdout + logs.stderr).splitlines():
        if "temporary password" in line.lower():
            return line.rsplit(":", 1)[-1].strip()
    return None


def qbit_session():
    """Log into qBittorrent with the configured password.

    On a fresh install the WebUI has no stored password: qBittorrent prints a
    temporary one into its logs. Log in with it once and persist the generated
    password from .env via the API so later boots authenticate directly.
    Auth endpoints are hit at most twice to avoid tripping the ban-on-failures
    protection.
    """
    password = os.environ["QBITTORRENT_PASSWORD"]
    sid = qbit_login_once("admin", password)
    if sid:
        print("qBittorrent: authenticated with stored password")
        return sid

    temp = qbit_temp_password_from_logs()
    if not temp:
        raise SystemExit(
            "qBittorrent rejected the stored password and no first-boot temporary "
            "password was found in logs; wipe media-automation/data/qbittorrent "
            "and re-run //homelab:media-bootstrap"
        )
    sid = qbit_login_once("admin", temp)
    if not sid:
        raise SystemExit(
            "qBittorrent rejected even the logged temporary password (possibly "
            "banned after earlier failures; restart the container and re-run)"
        )
    body = urllib.parse.urlencode(
        {"json": json.dumps({"web_ui_password": password})}).encode()
    req = urllib.request.Request(
        f"{QBIT}/api/v2/app/setPreferences", data=body, method="POST",
        headers={"Cookie": sid, "Referer": QBIT},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        resp.read()
    check = qbit_login_once("admin", password)
    if not check:
        raise SystemExit(
            "qBittorrent rejected the new password immediately after setting it"
        )
    print("qBittorrent: permanent WebUI password set from first-boot credentials")
    return check


def qbittorrent_fields(password, category_field, category):
    return [
        {"name": "host", "value": "qbittorrent"},
        {"name": "port", "value": int(os.environ.get("QBITTORRENT_PORT", "8080"))},
        {"name": "useSsl", "value": False},
        {"name": "username", "value": "admin"},
        {"name": "password", "value": password},
        {"name": category_field, "value": category},
    ]


def ensure_download_client(app, category_field, category):
    existing = {dc.get("name") for dc in app.get("/api/v3/downloadclient")}
    if "qbittorrent" in existing:
        print("  download client 'qbittorrent' already present")
        return
    schema = next(
        dc for dc in app.get("/api/v3/downloadclient/schema")
        if dc.get("implementation") == "QBittorrent"
    )
    schema = json.loads(json.dumps(schema))
    schema.update({
        "name": "qbittorrent",
        "enable": True,
        "protocol": "torrent",
        "priority": 1,
        "removeCompletedDownloads": False,
        "removeCompleted": False,
    })
    schema["fields"] = qbittorrent_fields(
        os.environ["QBITTORRENT_PASSWORD"], category_field, category)
    app.post("/api/v3/downloadclient/test", schema)
    app.post("/api/v3/downloadclient", schema)
    print("  added download client 'qbittorrent' (connection test passed)")


def ensure_root_folder(app, path):
    if any(rf.get("path") == path for rf in app.get("/api/v3/rootfolder")):
        print(f"  root folder {path} already present")
        return
    app.post("/api/v3/rootfolder", {"path": path})
    print(f"  added root folder {path}")


def definition_of(indexer):
    for field in indexer.get("fields") or []:
        if field.get("name") == "definitionFile":
            return field.get("value")
    return None


def ensure_indexers(prowlarr):
    existing_defs = {definition_of(idx) for idx in prowlarr.get("/api/v1/indexer")}
    schemas = {}
    for entry in prowlarr.get("/api/v1/indexer/schema"):
        definition = next(
            (f.get("value") for f in entry.get("fields", [])
             if f.get("name") == "definitionFile"),
            None,
        )
        if definition in INDEXER_DEFINITIONS:
            schemas[definition] = entry

    for definition in INDEXER_DEFINITIONS:
        if definition in existing_defs:
            print(f"  indexer '{definition}' already present")
            continue
        schema = schemas.get(definition)
        if schema is None:
            print(f"  ! definition '{definition}' not available in this Prowlarr; skipping")
            continue
        payload = json.loads(json.dumps(schema))
        payload["name"] = definition
        payload["enable"] = True
        payload["tags"] = []
        if definition in INDEXER_BASE_URLS:
            for field in payload.get("fields", []):
                if field.get("name") == "baseUrl":
                    field["value"] = INDEXER_BASE_URLS[definition]
        if not payload.get("appProfileId"):
            profiles = prowlarr.get("/api/v1/appprofile")
            standard = next((p["id"] for p in profiles if p.get("name") == "Standard"), None)
            payload["appProfileId"] = standard or profiles[0]["id"]
        result = prowlarr.post("/api/v1/indexer", payload)
        print(f"  added indexer '{result['name']}'")

    apps = prowlarr.get("/api/v1/applications")
    app_schemas = {e["implementation"]: e for e in prowlarr.get("/api/v1/applications/schema")}
    registered = []
    for implementation, base_url, key in (
        ("Sonarr", "http://sonarr:8989", os.environ["SONARR_API_KEY"]),
        ("Radarr", "http://radarr:7878", os.environ["RADARR_API_KEY"]),
    ):
        if any(a.get("implementation") == implementation for a in apps):
            print(f"  application {implementation} already registered")
            continue
        schema = json.loads(json.dumps(app_schemas[implementation]))
        values = {f["name"]: f.get("value") for f in schema.get("fields", [])}
        values.update({
            "apiKey": key,
            "baseUrl": f"{base_url}/",
            "prowlarrUrl": "http://prowlarr:9696",
        })
        schema["fields"] = [{"name": k, "value": v} for k, v in values.items()]
        schema["name"] = implementation
        schema["enable"] = True
        schema["syncLevel"] = "fullSync"
        prowlarr.post("/api/v1/applications", schema)
        registered.append(implementation)
        print(f"  registered {implementation} for indexer sync")

    for path in ("/api/v1/applications/sync", "/api/v1/applications/testall"):
        try:
            prowlarr.request("POST", path, {})
            print(f"  triggered {path.rsplit('/', 1)[-1]}")
            break
        except RuntimeError as exc:
            last_error = str(exc)
    else:
        print(f"  note: manual sync unavailable ({last_error}); runs on schedule")


def wait_for_synced_indexers(app, name, minimum=1, timeout=120):
    deadline = time.time() + timeout
    count = len(app.get(f"/api/v3/indexer"))
    while count < minimum and time.time() < deadline:
        time.sleep(6)
        count = len(app.get(f"/api/v3/indexer"))
    print(f"  {name}: {count} synced indexer(s)")
    return count


def main():
    prowlarr = Api(PROWLARR, os.environ["PROWLARR_API_KEY"])
    sonarr = Api(SONARR, os.environ["SONARR_API_KEY"])
    radarr = Api(RADARR, os.environ["RADARR_API_KEY"])

    wait_port(PROWLARR, os.environ.get("PROWLARR_PORT", "9696"), "Prowlarr")
    wait_port(SONARR, os.environ.get("SONARR_PORT", "8989"), "Sonarr")
    wait_port(RADARR, os.environ.get("RADARR_PORT", "7878"), "Radarr")
    wait_port(QBIT, os.environ.get("QBITTORRENT_PORT", "8080"), "qBittorrent")

    sid = qbit_session()
    prefs_req = urllib.request.Request(
        f"{QBIT}/api/v2/app/preferences", headers={"Cookie": sid})
    save_path = json.loads(urllib.request.urlopen(prefs_req, timeout=30).read()).get("save_path")
    print(f"qBittorrent: default save path {save_path}")

    print("Sonarr:")
    ensure_download_client(sonarr, "tvCategory", SONARR_CATEGORY)
    ensure_root_folder(sonarr, "/media/TV")
    print("Radarr:")
    ensure_download_client(radarr, "movieCategory", RADARR_CATEGORY)
    ensure_root_folder(radarr, "/media/Movies")

    print("Prowlarr:")
    ensure_indexers(prowlarr)

    print("Indexer sync:")
    sonarr_ok = wait_for_synced_indexers(sonarr, "Sonarr")
    radarr_ok = wait_for_synced_indexers(radarr, "Radarr")
    if not (sonarr_ok and radarr_ok):
        print("  note: sync can take a couple of minutes on first run;")
        print("  re-run //media:provision to confirm.")
    else:
        print("Provisioning complete.")


if __name__ == "__main__":
    sys.exit(main())
