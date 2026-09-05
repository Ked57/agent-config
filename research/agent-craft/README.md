# Agent-craft YouTube research (Mar–Sep 2026)

Audit trail for the craft sections added to `agents/*.md`. Canonical
behaviour stays in those role files; this directory is evidence, not policy.

## Window

Today for this pass: 2026-09-05. Videos kept only when the YouTube watch page
`publishDate` / `dateText` was **2026-03-05 through 2026-09-05**.

## How videos were chosen

1. `yt-dlp` flat search (`ytsearch20`) on role-specific queries (implementer /
   TDD / agentic coding workflow; orchestration / multi-agent / software
   factory; planning / design docs / plan mode; code review / PR review).
2. Watch-page HTML scrape for `publishDate` (player extract was bot-blocked on
   this cloud IP).
3. Drop off-topic viral hits (AGI recaps, SEO, career roadmaps, unrelated
   domains).
4. Rank remaining in-window videos by **view count** (popularity) among
   on-topic titles.
5. Transcripts: YouTube timedtext and `youtube-transcript-api` were IP-blocked;
   `WebFetch` on `youtube.com/watch?v=` returned caption text for most videos.
   Gaps are listed in each role’s `sources.json` notes and in `GAPS.md`.

## Layout

- `{role}/sources.json` — selected top 20 plus the in-window pool
- `_meta/collect.py`, `finalize_selection.py` — collectors
- `CONSENSUS.md` — weighted themes used in the role files
