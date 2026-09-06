#!/usr/bin/env python3
"""Fetch YouTube transcripts for each role's selected top-20 videos."""
from __future__ import annotations

import json
import sys
import time
from pathlib import Path

from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import (
    NoTranscriptFound,
    TranscriptsDisabled,
    VideoUnavailable,
    YouTubeRequestFailed,
    YouTubeTranscriptApiException,
)

ROOT = Path(__file__).resolve().parents[1]
api = YouTubeTranscriptApi()


def transcript_to_text(fetched) -> str:
    snippets = getattr(fetched, "snippets", fetched)
    lines = []
    for snip in snippets:
        text = getattr(snip, "text", None)
        if text is None and isinstance(snip, dict):
            text = snip.get("text", "")
        if text:
            lines.append(text.replace("\n", " ").strip())
    return "\n".join(lines)


def fetch_one(video_id: str) -> dict:
    try:
        fetched = api.fetch(video_id)
        return {
            "ok": True,
            "language": getattr(fetched, "language", None)
            or getattr(fetched, "language_code", None),
            "text": transcript_to_text(fetched),
        }
    except (NoTranscriptFound, TranscriptsDisabled, VideoUnavailable) as exc:
        # Try listing and picking any generated/manual English or first available.
        try:
            listing = api.list(video_id)
            chosen = None
            for t in listing:
                lang = getattr(t, "language_code", "") or ""
                if lang.startswith("en"):
                    chosen = t
                    break
            if chosen is None:
                chosen = next(iter(listing), None)
            if chosen is None:
                return {"ok": False, "error": type(exc).__name__, "detail": str(exc)}
            fetched = chosen.fetch()
            return {
                "ok": True,
                "language": getattr(chosen, "language_code", None),
                "generated": bool(getattr(chosen, "is_generated", False)),
                "text": transcript_to_text(fetched),
            }
        except Exception as inner:  # noqa: BLE001
            return {
                "ok": False,
                "error": type(exc).__name__,
                "detail": f"{exc}; fallback={inner}",
            }
    except (YouTubeRequestFailed, YouTubeTranscriptApiException) as exc:
        return {"ok": False, "error": type(exc).__name__, "detail": str(exc)}
    except Exception as exc:  # noqa: BLE001
        return {"ok": False, "error": type(exc).__name__, "detail": str(exc)}


def process_role(role: str) -> dict:
    sources = json.loads((ROOT / role / "sources.json").read_text())
    selected = sources["selected"]
    out_dir = ROOT / role / "transcripts"
    out_dir.mkdir(parents=True, exist_ok=True)
    manifest = []
    for i, video in enumerate(selected, 1):
        vid = video["id"]
        dest = out_dir / f"{i:02d}-{vid}.txt"
        meta_path = out_dir / f"{i:02d}-{vid}.json"
        if dest.exists() and dest.stat().st_size > 200:
            print(f"[{role}] {i:02d}/{len(selected)} skip existing {vid}", flush=True)
            manifest.append(
                {
                    "rank": i,
                    "id": vid,
                    "title": video.get("title"),
                    "ok": True,
                    "chars": dest.stat().st_size,
                    "cached": True,
                    "url": video.get("url"),
                }
            )
            continue
        print(f"[{role}] {i:02d}/{len(selected)} fetch {vid} {video.get('title')}", flush=True)
        result = fetch_one(vid)
        record = {
            "rank": i,
            "id": vid,
            "title": video.get("title"),
            "channel": video.get("channel"),
            "published": video.get("published"),
            "view_count": video.get("view_count"),
            "url": video.get("url"),
            "ok": result.get("ok"),
            "error": result.get("error"),
            "detail": result.get("detail"),
            "language": result.get("language"),
            "generated": result.get("generated"),
            "chars": len(result.get("text") or ""),
        }
        meta_path.write_text(json.dumps(record, indent=2) + "\n")
        if result.get("ok") and result.get("text"):
            dest.write_text(result["text"] + "\n")
        else:
            dest.write_text("")
        manifest.append(record)
        time.sleep(0.35)
    (ROOT / role / "transcript-manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n"
    )
    ok = sum(1 for m in manifest if m.get("ok") and (m.get("chars") or 0) > 200)
    print(f"[{role}] transcripts ok={ok}/{len(manifest)}", flush=True)
    return {"role": role, "ok": ok, "total": len(manifest)}


def main() -> None:
    roles = [a for a in sys.argv[1:] if a in ("coder", "planner", "orchestrator", "reviewer")] or [
        "coder",
        "planner",
        "orchestrator",
        "reviewer",
    ]
    summary = [process_role(role) for role in roles]
    print(json.dumps(summary, indent=2), flush=True)


if __name__ == "__main__":
    main()
