#!/usr/bin/env python3
"""Pick the top 20 in-window, on-topic, popular videos per role."""
from __future__ import annotations

import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

JUNK = re.compile(
    r"retirement|succession planning|capacity planning software|revit|navisworks|"
    r"bim coordination|coursera review|oraclewings|beautiful ceo|seo in 2026|"
    r"outlook|how to learn to code|should you still become|how to win with ai|"
    r"\bagi\b|gpt-6|i/o 2026|career path|roadmap|web developer by the end|"
    r"planning engineer skills|marriage kids|telugu|become software engineer|"
    r"sso, mfa|data engineering roadmap|iam engineer|game design document|"
    r"nasa systems|interview question|first 90 days|construction, manufacturing|"
    r"inorbit|otto gen",
    re.I,
)

ROLE_KW = {
    "coder": re.compile(
        r"tdd|test-driven|red-green|implement|coding workflow|workflow for ai coding|"
        r"agentic coding|agentic engineering workflow|claude code|cursor|"
        r"senior engineer|pair program|production code|ai-assisted coding|"
        r"opencode workflow|ai coding workflow|harness engineering|"
        r"humans steer|explore .{0,8}plan|how i use claude|build with ai|"
        r"ai skills like a senior|real ai coding workflow|build anything",
        re.I,
    ),
    "orchestrator": re.compile(
        r"orchestrat|multi-agent|multi agent|agent teams|tech lead|staff engineer|"
        r"software factory|\bafk\b|delegation|agentic loop|agent skills|openclaw|"
        r"harness engineering|humans steer|dev team|break down|sub-agent|subagent|"
        r"agentic engineering|claude code team|principal.?s agentic|"
        r"complete ai coding workflow|two-way agent|pi to pi",
        re.I,
    ),
    "planner": re.compile(
        r"\bplan\b|planning|design doc|rfc|system design|architecture|scoping|"
        r"estimat|explore .{0,8}plan|starts every project|before coding|"
        r"technical design|breakdown|tickets|spec|harness engineering|sdlc|"
        r"every step explained|c4 model|design documentation|"
        r"senior engineers actually build|don't give estimates",
        re.I,
    ),
    "reviewer": re.compile(
        r"code review|pr review|pull request|reviewing ai|review skill|lgtm|"
        r"reviewdebt|ai code review|slop|coderabbit|looks good to me|"
        r"reviews my ai|approve pull|reviewing ai-generated|reviewing ai-written|"
        r"are code reviews",
        re.I,
    ),
}


def views_of(item: dict) -> int:
    return int(item.get("view_count") or item.get("html_views") or 0)


def main() -> None:
    for role, kw in ROLE_KW.items():
        src = json.loads((ROOT / role / "sources.json").read_text())
        picked = []
        for v in src["all_in_window"]:
            title = v.get("title") or ""
            if JUNK.search(title):
                continue
            if not kw.search(title):
                continue
            picked.append(v)
        picked.sort(key=views_of, reverse=True)
        selected = picked[:20]
        src["selected"] = selected
        src["selection_method"] = (
            "Date window 2026-03-05 to 2026-09-05 from watch-page publishDate. "
            "On-topic title match for the role. Ranked by view count. "
            "Off-topic viral and unrelated-domain videos dropped."
        )
        (ROOT / role / "sources.json").write_text(json.dumps(src, indent=2) + "\n")
        print(f"\n=== {role} {len(selected)}/{len(picked)} relevant ===")
        for i, v in enumerate(selected, 1):
            print(f"{i:02d}. {v.get('published')} {views_of(v):>9}  {v.get('title')}  [{v.get('channel')}]")


if __name__ == "__main__":
    main()
