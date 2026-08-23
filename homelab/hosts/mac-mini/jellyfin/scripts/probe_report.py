#!/usr/bin/env python3
"""Summarise an ffprobe JSON report for client compatibility.

Reads ffprobe JSON on stdin; argv[1] is the file's lowercase extension.
Exits non-zero if the input cannot be parsed.
"""

import json
import sys

CONTAINER_FOR = {
    "avi": {"avi"},
    "matroska": {"mkv", "webm"},
    "mov": {"mp4", "m4v", "mov"},
    "mpegts": {"ts", "m2ts"},
    "flv": {"flv"},
    "asf": {"asf", "wmv"},
    "webm": {"webm", "mkv"},
}

BROWSER_VIDEO = {"h264", "vp8", "vp9", "av1"}
DEVICE_EXTRA_VIDEO = {"hevc", "h265"}
BROWSER_AUDIO = {"aac", "mp3", "opus", "flac", "vorbis"}


def num(value):
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def hms(seconds):
    seconds = int(seconds)
    return f"{seconds // 3600}:{(seconds % 3600) // 60:02d}:{seconds % 60:02d}"


def mb(bytes_):
    return f"{bytes_ / 1_000_000:.1f} MB"


def fmt_fps(raw):
    if not raw or raw == "N/A":
        return "?"
    try:
        if "/" in raw:
            numerator, denominator = raw.split("/", 1)
            denominator_f = float(denominator)
            if not denominator_f:
                return "?"
            return f"{float(numerator) / denominator_f:.2f}"
        return f"{float(raw):.2f}"
    except ValueError:
        return str(raw)


def verdict_for(vcodec, acodec):
    video_ok_browser = vcodec in BROWSER_VIDEO
    video_ok_device = video_ok_browser or vcodec in DEVICE_EXTRA_VIDEO
    audio_ok = acodec is None or acodec in BROWSER_AUDIO

    if video_ok_browser and audio_ok:
        return "plays natively everywhere (phone, browser, Fire TV)"
    if video_ok_device and audio_ok:
        return "native on phone/Fire TV; browsers will transcode"
    if video_ok_browser:
        return "video native everywhere; audio will transcode in browsers"
    if video_ok_device:
        return "native on phone/Fire TV only; everything else transcodes"
    return "needs server transcoding on every client"


def main():
    ext = sys.argv[1].lower() if len(sys.argv) > 1 else ""
    d = json.load(sys.stdin)

    fmt = d.get("format", {})
    streams = d.get("streams", [])
    video = next((s for s in streams if s.get("codec_type") == "video"), None)
    audio = next((s for s in streams if s.get("codec_type") == "audio"), None)
    subs = [s.get("codec_name") for s in streams if s.get("codec_type") == "subtitle"]

    fmt_names = (fmt.get("format_name") or "").split(",")
    primary_fmt = next((n for n in fmt_names if n != "webm"), fmt_names[0] if fmt_names else "")
    primary_key = primary_fmt.split(",")[0]
    allowed = CONTAINER_FOR.get(primary_key, set())
    mislabeled = bool(ext and allowed and ext not in allowed)

    vcodec = (video or {}).get("codec_name", "?")
    acodec = (audio or {}).get("codec_name") if audio else None
    res = f"{video.get('width')}x{video.get('height')}" if video else "-"
    fps = fmt_fps((video or {}).get("avg_frame_rate"))

    duration = num(fmt.get("duration"))
    size = int(num(fmt.get("size")))
    bitrate = int(num(fmt.get("bit_rate")))

    print(f"  actual: {'/'.join(fmt_names)} | video {vcodec} {res}@{fps} | audio {acodec or 'no audio'}"
          + (f" | subs: {','.join(subs)}" if subs else ""))
    print(f"  duration {hms(duration)} | size {mb(size)} | bitrate {bitrate // 1000} kbps")
    if mislabeled:
        print(f"  WARNING: .{ext} extension does not match actual container ({primary_fmt}); rename to {sorted(allowed)[0]}")
    elif video is not None and primary_key and primary_key not in CONTAINER_FOR:
        print(f"  NOTE: unrecognized container '{primary_fmt}' for a video stream; extension cross-check skipped")
    print(f"  expect: {verdict_for(vcodec, acodec)}")


if __name__ == "__main__":
    try:
        main()
    except (json.JSONDecodeError, ValueError, KeyError, AttributeError, TypeError) as exc:
        print(f"  could not parse ffprobe output: {exc}", file=sys.stderr)
        sys.exit(1)
