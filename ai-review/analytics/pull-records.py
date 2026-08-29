import json
import os
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor

ACCOUNT = os.environ.get("CLOUDFLARE_ACCOUNT_ID", "")
TOKEN = os.environ.get("CLOUDFLARE_API_TOKEN", "")
BUCKET = "ai-review-data"
DEFAULT_CACHE_ROOT = os.path.join(
    os.environ.get("AI_REVIEW_SCORECARD_CACHE", os.path.expanduser("~/.cache/ai-review")),
    "r2-export",
)


def cache_root() -> str:
    if len(sys.argv) > 1 and sys.argv[1].strip():
        return sys.argv[1]
    return DEFAULT_CACHE_ROOT


def require_credentials() -> None:
    if not ACCOUNT or not TOKEN:
        print(
            "Cloudflare credentials missing; run through "
            "mise run //ai-review:scorecard:pull (which loads them from Doppler)",
            file=sys.stderr,
        )
        sys.exit(2)


def api(url: str) -> urllib.request.Request:
    return urllib.request.Request(url, headers={"Authorization": f"Bearer {TOKEN}"})


def list_objects() -> list[tuple[str, int]]:
    base = f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/r2/buckets/{BUCKET}/objects"
    objects: list[tuple[str, int]] = []
    cursor = ""
    truncated = True
    while truncated:
        url = base + (f"?cursor={cursor}" if cursor else "")
        with urllib.request.urlopen(api(url), timeout=60) as response:
            payload = json.load(response)
        for entry in payload.get("result") or []:
            objects.append((entry["key"], int(entry.get("size", 0))))
        info = payload.get("result_info") or {}
        truncated = bool(info.get("is_truncated", False))
        cursor = info.get("cursor", "")
    return sorted(objects)


def fetch(object_key: str, size: int, target_dir: str) -> str | None:
    local_path = os.path.join(target_dir, object_key)
    if os.path.exists(local_path) and os.path.getsize(local_path) == size:
        return None
    url = (
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT}/r2/buckets/{BUCKET}/objects/"
        f"{urllib.parse.quote(object_key, safe='/')}"
    )
    for attempt in range(8):
        try:
            with urllib.request.urlopen(api(url), timeout=60) as response:
                body = response.read()
            os.makedirs(os.path.dirname(local_path), exist_ok=True)
            with open(local_path, "wb") as out:
                out.write(body)
            return None
        except urllib.error.HTTPError as error:
            if error.code in (429, 500, 502, 503):
                time.sleep(min(2**attempt, 30))
                continue
            return f"{object_key}: {error}"
        except Exception as error:  # noqa: BLE001
            return f"{object_key}: {error}"
    return f"{object_key}: gave up after retries"


def main() -> None:
    require_credentials()
    target_dir = cache_root()
    objects = list_objects()
    if not objects:
        print(f"bucket {BUCKET} is empty; nothing to pull")
        return
    failures: list[str] = []
    with ThreadPoolExecutor(max_workers=4) as pool:
        for outcome in pool.map(lambda entry: fetch(entry[0], entry[1], target_dir), objects):
            if outcome:
                failures.append(outcome)
    v1 = sum(1 for key, _ in objects if key.startswith("v1/"))
    v2 = sum(1 for key, _ in objects if key.startswith("v2/"))
    pulled = len(objects) - len(failures)
    print(f"pulled {pulled}/{len(objects)} objects (v1={v1}, v2={v2}) into {target_dir}")
    if failures:
        for line in failures[:10]:
            print(line, file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
