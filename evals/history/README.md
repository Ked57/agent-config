# Eval history

The two A/B rounds (2026-11-16 and 2026-11-17) that built this suite are recorded on the
`feat/repo-evals` branch: `evals/PROGRESS.md` (running log), `evals/NEXT.md` (findings and proposals)
and `evals/AUDIT.md` (the audit that started it). `INVENTORY.md` here is the component inventory
those rounds tested against.

What they established, in short:

- Synthetic tasks cannot separate configs on quality: Opus 5.5 passes them with or without the
  config (full vs bare: +0.04 run score, 95% CI −0.04 to +0.12).
- Cost and firing are measured well: the full config cost +103% over bare (CI +75% to +139%), and
  only a few components ever fired (`routing` 100%, `typescript` 92%, `manual-qa` 81%,
  `vue-primevue` on 14 of 15 Vue tasks).
- Hence `npm run eval:smoke`: a cheap single-arm check of firing, cost and gates (see `../README.md`).
