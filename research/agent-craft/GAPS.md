# Gaps

- Player extract (`yt-dlp` without `--flat-playlist`) and `youtube-transcript-api`
  were blocked as cloud IP / bot-check. Dates came from watch-page HTML
  `publishDate`. Caption text came from `WebFetch` of the watch URL plus
  on-disk dumps under `{role}/transcripts/`.
- Claude “Introducing Code Review” (`RKsADl0ZC3Y`) returned music-only
  captions. It stays in the reviewer top-20 by views; Craft does not lean on it.
- Disk caption coverage of the selected twenty: coder 20/20, planner 17/20,
  reviewer 17/20, orchestrator 16/20. Missing files were still used when
  WebFetch returned captions in-session (see CONSENSUS.md).
- Planner #19–20 have low view counts after off-topic viral videos were
  dropped; they remain because they are on-topic and in-window.
