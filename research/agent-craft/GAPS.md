# Gaps

- Player extract (`yt-dlp` without `--flat-playlist`) and `youtube-transcript-api`
  were blocked as cloud IP / bot-check. Dates came from watch-page HTML
  `publishDate`. Caption text came from `WebFetch` of the watch URL, saved under
  `{role}/transcripts/`.
- Claude “Introducing Code Review” (`RKsADl0ZC3Y`) returned music-only
  captions after retry. It stays in the reviewer top-20 by views; Craft does
  not lean on it.
- Disk caption coverage of the selected twenty: coder 20/20, planner 20/20,
  orchestrator 20/20, reviewer 19/20.
- Truncated but usable: coder `wlpBCazAY9Q`; orchestrator `iqRcGCah0Kw`;
  reviewer `3rlvB_cxmTQ`, `b8btDwbVL-c`.
- Planner #19–20 have low view counts after off-topic viral videos were
  dropped; they remain because they are on-topic and in-window.
