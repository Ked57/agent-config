#!/usr/bin/env python3
"""Collect YouTube candidates for agent-craft research.

Search via yt-dlp (flat), then scrape watch-page HTML for publish dates.
Date window: 2026-03-05 inclusive through 2026-09-05 (last 6 months from 2026-09-05).
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import time
import urllib.request
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import date, datetime
from pathlib import Path

CUTOFF = date(2026, 3, 5)
END = date(2026, 9, 5)
ROOT = Path(__file__).resolve().parents[1]
YTDLP = os.path.expanduser("~/.local/bin/yt-dlp")

QUERIES = {
    "coder": [
        "test driven development 2026 software",
        "senior software engineer implementation workflow 2026",
        "how senior developers write production code 2026",
        "implementing software from a spec TDD 2026",
        "AI coding agent implementation best practices 2026",
        "Cursor Claude Code implementer workflow 2026",
        "red green refactor 2026",
        "shipping features as a senior engineer 2026",
        "software engineer ticket implementation 2026",
        "tracer bullet software development 2026",
        "how I implement a pull request senior developer 2026",
        "TDD in practice 2026",
        "AI pair programming production code 2026",
        "senior developer coding workflow",
        "implementing from tickets software engineering 2026",
    ],
    "orchestrator": [
        "AI agent orchestration software engineering 2026",
        "tech lead splitting work subtasks 2026",
        "staff engineer coordinating software delivery 2026",
        "multi-agent coding workflow Cursor Claude 2026",
        "engineering manager software delivery 2026",
        "orchestrating AI coding agents 2026",
        "tech lead running a software project 2026",
        "how staff engineers break down work 2026",
        "software team lead workflow 2026",
        "multi agent software development 2026",
        "engineering lead coordinating engineers 2026",
        "AI software factory orchestration 2026",
        "tech lead delegation and review loops 2026",
        "staff engineer technical leadership 2026",
        "breaking down software projects into tasks 2026",
    ],
    "planner": [
        "software technical planning design docs 2026",
        "how staff engineers plan software projects 2026",
        "writing RFC design documents 2026",
        "breaking down tickets software planning 2026",
        "engineering planning before coding 2026",
        "technical design review software 2026",
        "software estimation and planning senior 2026",
        "staff engineer planning a project 2026",
        "software architecture planning 2026",
        "how to write a technical design doc 2026",
        "product engineering planning 2026",
        "scoping software work senior engineer 2026",
        "planning AI coding agent work 2026",
        "software project breakdown tickets 2026",
        "senior engineer planning implementation 2026",
    ],
    "reviewer": [
        "code review best practices 2026",
        "how staff engineers review pull requests 2026",
        "senior developer PR review 2026",
        "effective code reviews 2026",
        "AI code review 2026",
        "how I review pull requests staff engineer 2026",
        "code review as a senior engineer 2026",
        "reviewing AI generated code 2026",
        "pull request review checklist 2026",
        "staff software engineer code review",
        "how senior developers review PRs 2026",
        "code review bottlenecks 2026",
        "PR review best practices senior 2026",
        "human code review with AI tools 2026",
        "request changes vs approve code review 2026",
    ],
}

DATE_RE = re.compile(
    r'"(?:publishDate|dateText)":\{"simpleText":"((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}, \d{4})"'
)
RELATIVE_RE = re.compile(
    r'"relativeDateText":\{"accessibility":\{"accessibilityData":\{"label":"([^"]+)"\}\}'
)
TITLE_RE = re.compile(r'"title":\{"simpleText":"([^"]+)"\}')
CHANNEL_RE = re.compile(r'"ownerChannelName":"([^"]+)"')
VIEWS_RE = re.compile(r'"viewCount":\{"simpleText":"([\d,]+) views"')
VIEWS_SHORT_RE = re.compile(r'([\d,.]+)\s+views', re.I)


def parse_date(text: str) -> date | None:
    try:
        return datetime.strptime(text, "%b %d, %Y").date()
    except ValueError:
        return None


def search_query(query: str, n: int = 20) -> list[dict]:
    cmd = [
        YTDLP,
        "--flat-playlist",
        "--dump-json",
        "--no-warnings",
        "--playlist-end",
        str(n),
        f"ytsearch{n}:{query}",
    ]
    proc = subprocess.run(cmd, capture_output=True, text=True, timeout=120)
    out = []
    for line in proc.stdout.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            item = json.loads(line)
        except json.JSONDecodeError:
            continue
        vid = item.get("id")
        if not vid:
            continue
        out.append(
            {
                "id": vid,
                "title": item.get("title"),
                "channel": item.get("channel") or item.get("uploader"),
                "view_count": item.get("view_count"),
                "duration": item.get("duration"),
                "url": f"https://www.youtube.com/watch?v={vid}",
                "query": query,
            }
        )
    return out


def scrape_watch(video_id: str) -> dict:
    url = f"https://www.youtube.com/watch?v={video_id}"
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": (
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
                "(KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36"
            )
        },
    )
    try:
        with urllib.request.urlopen(req, timeout=25) as resp:
            html = resp.read().decode("utf-8", errors="ignore")
    except Exception as exc:  # noqa: BLE001 — scrape must continue
        return {"id": video_id, "error": str(exc)}
    date_match = DATE_RE.search(html)
    published_raw = date_match.group(1) if date_match else None
    published = parse_date(published_raw) if published_raw else None
    rel_match = RELATIVE_RE.search(html)
    title_match = TITLE_RE.search(html)
    channel_match = CHANNEL_RE.search(html)
    views_match = VIEWS_RE.search(html)
    views = int(views_match.group(1).replace(",", "")) if views_match else None
    return {
        "id": video_id,
        "published": published.isoformat() if published else None,
        "published_raw": published_raw,
        "relative": rel_match.group(1) if rel_match else None,
        "html_title": title_match.group(1) if title_match else None,
        "html_channel": channel_match.group(1) if channel_match else None,
        "html_views": views,
        "html_bytes": len(html),
        "in_window": bool(published and CUTOFF <= published <= END),
    }


def collect_role(role: str) -> dict:
    seen: dict[str, dict] = {}
    search_cache = ROOT / role / "search-cache.json"
    if search_cache.exists() and "--refresh-search" not in sys.argv:
        print(f"[{role}] loading search cache {search_cache}", flush=True)
        for item in json.loads(search_cache.read_text()):
            seen[item["id"]] = item
    else:
        for query in QUERIES[role]:
            print(f"[{role}] search: {query}", flush=True)
            try:
                for item in search_query(query, 20):
                    existing = seen.get(item["id"])
                    if existing:
                        existing.setdefault("queries", []).append(query)
                        vc = item.get("view_count") or 0
                        if vc > (existing.get("view_count") or 0):
                            existing["view_count"] = vc
                        continue
                    item["queries"] = [query]
                    seen[item["id"]] = item
            except Exception as exc:  # noqa: BLE001
                print(f"  search failed: {exc}", flush=True)
            time.sleep(0.4)
        search_cache.write_text(json.dumps(list(seen.values()), indent=2) + "\n")
    print(f"[{role}] unique candidates: {len(seen)}", flush=True)
    ids = [vid for vid, item in seen.items() if not item.get("published") and not item.get("error")]
    if not ids:
        ids = list(seen)
    with ThreadPoolExecutor(max_workers=6) as pool:
        futs = {pool.submit(scrape_watch, vid): vid for vid in ids}
        done = 0
        for fut in as_completed(futs):
            vid = futs[fut]
            done += 1
            try:
                meta = fut.result()
            except Exception as exc:  # noqa: BLE001
                seen[vid]["error"] = str(exc)
                continue
            seen[vid].update(meta)
            if done % 40 == 0:
                print(f"[{role}] scraped {done}/{len(ids)}", flush=True)
    search_cache.write_text(json.dumps(list(seen.values()), indent=2) + "\n")
    in_window = [v for v in seen.values() if v.get("in_window")]
    in_window.sort(key=lambda v: v.get("view_count") or v.get("html_views") or 0, reverse=True)
    selected = in_window[:20]
    dated = [v for v in seen.values() if v.get("published")]
    dated.sort(key=lambda v: v.get("published") or "", reverse=True)
    return {
        "role": role,
        "cutoff": CUTOFF.isoformat(),
        "end": END.isoformat(),
        "candidate_count": len(seen),
        "in_window_count": len(in_window),
        "selected": selected,
        "all_in_window": in_window,
        "recent_outside_or_undated_sample": dated[:15],
        "undated_count": sum(1 for v in seen.values() if not v.get("published")),
        "all_candidates": list(seen.values()),
    }


def main() -> None:
    roles = [a for a in sys.argv[1:] if not a.startswith("--") and a in QUERIES] or list(QUERIES)
    for role in roles:
        result = collect_role(role)
        out = ROOT / role / "sources.json"
        slim = {
            "role": result["role"],
            "window": {"start": result["cutoff"], "end": result["end"]},
            "candidate_count": result["candidate_count"],
            "in_window_count": result["in_window_count"],
            "undated_count": result["undated_count"],
            "selected": result["selected"],
            "all_in_window": [
                {
                    "id": v["id"],
                    "title": v.get("title"),
                    "channel": v.get("channel"),
                    "view_count": v.get("view_count") or v.get("html_views"),
                    "published": v.get("published"),
                    "url": v.get("url"),
                    "queries": v.get("queries"),
                }
                for v in result["all_in_window"]
            ],
        }
        out.write_text(json.dumps(slim, indent=2) + "\n")
        raw = ROOT / role / "candidates-raw.json"
        raw.write_text(json.dumps(result["all_candidates"], indent=2) + "\n")
        print(
            f"[{role}] wrote {out} selected={len(result['selected'])} "
            f"in_window={result['in_window_count']} candidates={result['candidate_count']}",
            flush=True,
        )
        for i, v in enumerate(result["selected"], 1):
            print(
                f"  {i:02d}. {v.get('published')} views={v.get('view_count')} "
                f"{v.get('title')} [{v.get('channel')}] {v.get('url')}",
                flush=True,
            )


if __name__ == "__main__":
    main()
