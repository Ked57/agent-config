# feat/repo-evals progress

**Status: done (2026-11-16 15:00 UTC).** Heartbeat `e95b56f3` deleted. Results, open gaps and the ablation proposal: see the end of the log and `evals/NEXT.md`.

Running log for the "evaluate agent-config's own policies, skills and plugins" brief. Any resume
(the lead's or a heartbeat's) starts here, then `git log --oneline -15` and `git status`.

- Branch `feat/repo-evals`, from `audit/eval-suite` `526c433`. Push after every step. No PR, no merge.
- Lead (Fable) plans, reviews, integrates and reports. Subagents run `claude-opus-5-5` and implement.
- Paseo heartbeat `e95b56f3` (`repo-evals-resume`, every 30 min, expires after 36 h). Delete when done.
- Never write to live `~/.claude`, `~/.agents`, `~/.cursor`, `~/.codex`. Telemetry off. Node/TS only.
- Phase 3 budget: about $80 in total for both comparisons.

## Status

| Phase | Item | Owner | State |
|---|---|---|---|
| 0 | `evals/INVENTORY.md` | agent F | done (committed `1db5fa0`); F continues with component tasks |
| 1.1 | Isolation: per-run HOME and TMPDIR outside the home tree, plugins installed, init verification | agent A | done, reviewed: bare and WORKTREE arms pass the per-run isolation check on a real haiku run |
| 1.2 | Decision rule: task-level paired CI, MDE, "cannot conclude" | agent B | done (`1db5fa0`), reviewed |
| 1.3 | Primary metric: hidden-test and required-check pass rate; judge as tiebreaker | agent B | done (`1db5fa0`); `run.mjs` wiring requests sent to agent A |
| 1.4 | Mutant gate (`npm run eval:mutants`) | agent C | done: `evals/mutants.mjs`; base ts-backend gate green (132 checks, about 5–6 min, so not part of `verify`; a structural manifest test is) |
| 1.5 | Weak tests: B5 strict, B6, B8, B9, B10, N2 | agent C | done: B5 strict (3 of 4 saved solutions now fail by design), B6 11/11, B8 11/11, B9 9/9 with delivery required, B10 11/11, B11 7/8, N2 6/6 |
| 1.6 | Vue behavioural hidden tests; MWG wording removed from the Vue task set | agent D | done: 14 of 15 tasks have jsdom behavioural tests (C5 static only), 91 of 92 mutants killed; but all 126 saved real solutions pass every case (ceiling) |
| 2 | `ts-backend-hard` task set | agent E | H1–H8 verified (67 of 67 mutants) but baseline passed 85 of 85 cases; E is rewriting prompts to state invariants, not case lists, and recalibrating (cap $8) |
| 2 | `poteto-spec` task set | agent G | S1–S5 verified; S1 at ceiling; G calibrating S2–S5 and hardening (cap $7) |
| 2 | Component tasks | agent F | done: K1–K5; K6, K7 are gaps |
| 2 | Prompt prefixes per arm, ablation arms (`--b-remove plugin:x`), bare arm | agent A | done; `/pstack:poteto-mode` prefix confirmed to load the skill headless; task-level `files` ship specs before the run |
| 3 | Comparison 1: full agent-config vs bare Claude Code | lead | done: `~/agent-config-evals/2026-11-16T10-20-full-vs-bare` |
| 3 | Comparison 2: poteto-mode on vs off | lead | done: `~/agent-config-evals/2026-11-16T10-20-poteto-mode` |
| — | `evals/NEXT.md` ablation proposal | lead | done |

## Decisions (binding for all subagents)

### Layout

- Results (records, transcripts, diffs, reports) stay in `~/agent-config-evals/<timestamp>-<name>/`.
- Everything an agent process touches lives in a sandbox outside the home tree:
  `${AGENT_CONFIG_EVALS_SANDBOX:-/var/tmp/agent-config-evals}/<eval>/`.
  - `arms/<arm>/{src,home}`: the arm's template home, built once.
  - `runs/<id>/{home,app,tmp}`: a per-run copy of the template home (absolute paths in
    `.claude/plugins/*.json` rewritten), the worked copy, and the run's `TMPDIR`.
- After a run, `app/` moves into the results dir (`runs/<id>/app`, same filesystem) so `--recheck`
  works as before. The run's home and tmp are deleted once the session log has been read.
- The suite refuses to start if any ancestor of the sandbox holds `.claude`, `CLAUDE.md`,
  `AGENTS.md` or `.mcp.json`.

### Arms

- An arm is `ref` (git ref, `WORKTREE`, or `BARE` for an empty home) plus toggles.
- Non-bare arms run the ref's own `bin/agent-config.mjs sync --user` **with** external plugins
  (`HOME` = template home). `--plugins skip` keeps the old offline behaviour.
- `--a-remove` / `--b-remove` accept `policy/x.md`, `skills/x` and `plugin:<id>` (ids from
  `bin/external-plugins.mjs`: `taste-skill`, `emilkowalski-ui`, `mattpocock-skills`, `pstack`).
- `--a-prefix` / `--b-prefix "<text>"` prepend to every task prompt for that arm. A task may also set
  `promptPrefix: { "A": "...", "B": "..." }`. The record stores the exact prompt sent.
- Each arm gets one cheap probe session at build time (haiku, "reply ok"). Its init event is the
  arm's expected `skills`, `plugins`, `agents`. Every non-built-in entry must resolve to a file under
  the arm home. Built-ins are whatever an empty home reports.

### Isolation check (per run, fails the run)

From the run's init event and session log: `skills`, `plugins` and `agents` equal the arm's
expectation; `cwd` and memory paths sit under the run's sandbox; every loaded instruction file
(CLAUDE.md and imports) sits under the run home or the app. A violation sets `status: "isolation"`
and the run is excluded and reported.

### Scoring

- A `command` check may set `"reporter": "vitest-json"`. Its result then carries `passed` and
  `total` test cases, and its score is `passed / total`. Other checks score 0 or 1.
- Run score (primary) = mean score of the run's required checks, or 0 when a fixture gate fails or
  the run errored. Also recorded: `allPass` (every required check and gate passed).
- Task score per arm = mean run score over that task's reps. Reps are not independent samples.
- Comparison = paired over tasks: d_t = B_t − A_t. Report mean d, a 95% CI (paired t over tasks,
  plus a task-level bootstrap), and the MDE at 80% power (2.8 × SD(d) / √T).
- Verdict: "B better" or "A better" when the CI excludes 0. "No difference larger than X" when the
  CI lies inside ±0.10. Otherwise "cannot conclude", with the MDE and the tasks needed. Fewer than
  5 tasks is always "cannot conclude".
- The judge is secondary: reported with the same task-level CI, and used only to break a tie when
  the primary CI includes 0. It never overrides the primary metric.
- Cost overhead gets a task-bootstrap CI.

### Tasks and tests

- Hidden tests assert only what the prompt or spec states. Every new or changed hidden test is
  mutation-checked before any agent run: reference solution passes, untouched fixture fails,
  kill rate at least 80% per task.
- Mutants and reference solutions live in the repo under `evals/fixtures/<fixture>/mutants/<task>/`
  as patches against the template (`reference*.patch`, `m*.patch`), with a `manifest.json`.
- `npm run eval:mutants` applies each patch to a prepared fixture copy and runs the task's hidden
  checks. It fails when a task's kill rate is under 80% or a reference fails. No agent calls.
- Tasks and checks freeze before Phase 3. Later edits go through `--recheck`, which keeps the trail.
- modern-web-guidance is dropped: no MWG policy signals, expectations or wording in tasks or docs.
  `evals/AUDIT.md` stays as the historical record.

## Log

- 2026-11-16 00:00 UTC: branch created. Probe: `claude plugin marketplace add` and `plugin install`
  work in a home under `/var/tmp`; the init event lists `pstack:*` skills, the `pstack` plugin and
  `pstack:poteto-agent`; nothing from the live home loads when cwd is outside the home tree.
- 00:25 UTC: agent B done (stats.mjs, aggregate, report, judge; verify 121 pass). Inventory written. B's `run.mjs` requests and the inventory's findings (absolute CLAUDE.md import, 550 MB template home, unpinned plugin versions) relayed to agent A. Agents A, C, D, E, F, G still running; their files are checkpoint-committed mid-change.
- 00:30 UTC: agent A done (sandbox under `/var/tmp/agent-config-evals`, per-run home copy, arm probes, `evals/lib/isolation.mjs`, `BARE`, `plugin:` removal, prefixes, task `files`). Lead re-read the init events of its real run: bare arm 19 built-in skills, WORKTREE arm 120 skills with taste-skill 2.5.1, mattpocock-skills 1.3.2, pstack 0.15.42, no live-home skills. One verify test fails at this checkpoint (`tests/evals.test.mjs:374` reading `ts-backend.json`, which agent C is editing). Still running: C, D, E, F (component tasks), G.
- 00:55–04:40 UTC: usage limit. Agents C, D, E, F, G stopped mid-work; their files were checkpoint-committed.
- 04:45 UTC: limit reset. C, D, E, F, G resumed by message from their saved progress (same briefs).
  At resume: `ts-backend-hard.json` (H1–H8 mutant dirs exist), `components-backend.json`, Vue mutants and
  `evals/mutants.mjs` exist but are unverified; `poteto-spec.json` not yet written (G was on S5 tests);
  15 verify tests fail (task sets and mutant gate mid-change). Agent A's report was complete before the
  limit; not resumed. Next for the lead: review each agent's result, get `npm run verify` and
  `npm run eval:mutants` green, freeze tasks, then Phase 3 cost estimates and runs.
- 05:00 UTC: the lead's session restarted and stopped C, D, E, F, G mid-work again (about 15 minutes of progress, checkpoint-committed: `poteto-spec.json` now exists; verify 166 pass, 10 fail). All five re-sent a continue message.
- 05:12 UTC: agent F done. Component tasks K1–K5 (`components-backend`), 41 of 41 mutants killed. K6
  (quality tooling) and K7 (bug diagnosis) not built: gaps. Lead ruling: the K1–K4 strict-lint and
  domain-structure checks assert policy rules the prompts do not state. They stay `required` inside
  the component set, whose purpose is "does the policy's rule get followed" in a leave-one-out
  ablation. Comparison 1 (full vs bare) uses only tasks whose required checks are stated in the
  prompt, so K1–K4 are left out of it; K5 qualifies.
- 05:22 UTC: agent G delivered `poteto-spec` S1–S5 (specs shipped via task `files`, 61 of 62 mutants
  killed, references pass all gates). Calibration: baseline scored 20/20 on S1 for $1.05, so S1 is at
  ceiling. G resumed to calibrate S2–S5 (cap $6) and harden any task at 90% or more with further
  spec-stated interaction requirements. Noted: Vitest's default 5 s timeout fails under machine load;
  hidden checks and fixture gates get `--testTimeout=30000` before the freeze, and Phase 3 runs at low
  concurrency.
- 05:32 UTC: agents C and D done; verify passes (177). E reported the hard set at ceiling (85 of 85) and was sent back to rewrite prompts as invariants and recalibrate. Agent A resumed for `--combine` (one report across both fixtures for comparison 1), a deletion-safety audit (three agents saw `/var/tmp/repo-evals-work` wiped at about 05:00) and `--testTimeout=30000` on the fixture test gates.
- Calibration spend so far (outside the Phase 3 budget, reported separately): A $0.06, E $6.63, G $1.05.
- 05:45 UTC: agent A delivered `--combine`, deletion guards and `--testTimeout=30000` on the fixture test
  gates (verify 183 pass). Root cause of the 04:47–05:00 restart and wipe: the host has 7 GB RAM; a
  global OOM killed `paseo.service`, which runs with `PrivateTmp=yes` and `KillMode=control-group`. So
  `/var/tmp` (the sandbox and all agents' scratch) is recreated empty on every service restart and
  every child process dies. No other writable location exists outside the home tree. Consequences:
  results in `~/agent-config-evals` survive, the sandbox does not; `--resume` must rebuild arms (A is
  adding that plus a free-memory guard); Phase 3 runs at concurrency 2 with no other heavy work.
  A lead restart is expected to kill running subagents: re-send them a continue message.
- 05:55–09:40 UTC: second usage-limit pause (A, E, G stopped).
- 09:45 UTC: calibration results read by the lead from the agents' result dirs. **The ceiling holds.**
  Baseline (full agent-config, Opus 5.5 medium, 1 rep): `ts-backend-hard` with explicit prompts 85 of 85
  hidden cases ($6.63); with prompts rewritten as invariants 84 of 84 ($5.08); `poteto-spec` S1 20 of 20
  ($1.05), S2–S5 90 of 90 ($5.48). Calibration spend so far $18.30, outside the Phase 3 budget.
  The only known baseline misses are on B5 (strict concurrent 2xx), where the prompt does not
  mention concurrency: 3 of 4 saved solutions fail.
- Lead decisions: (1) stop hardening by adding requirements; it does not work on this fixture and
  costs usage. E and G not resumed. (2) H1, H5 and H7 prompts no longer mention simultaneous
  requests; they state the invariant only ("never negative", "never without an admin", the lost-update
  problem). The concurrency cases follow from "never", the same class as B5. (3) Every hidden Vitest
  check runs with `--testTimeout=30000`. (4) A resumed for unattended resume after a wiped sandbox
  and for usage-limit handling (a rate-limited run must not be recorded as a result).
- 09:50 UTC: full mutant gate started in the background (`/var/tmp/repo-evals-work/gate-full.log`).
  Next: gate green → freeze commit → Phase 3.
- 10:13 UTC: full mutation gate passed (46 tasks, 478 checks, 21 min at concurrency 3). Agent A
  finished usage-limit handling (exit code 75, nothing recorded for a rate-limited run), rebuild of a
  wiped sandbox on `--resume`, and `--min-free-mb`. **Tasks and checks frozen at `0ca7d68`.**
- 10:20 UTC: **Phase 3 launched.** Driver: `~/agent-config-evals/phase3/driver.sh`, log
  `~/agent-config-evals/phase3/driver.log`. It is idempotent; if it is not running
  (`pgrep -f phase3/driver.sh`), relaunch from the worktree with
  `nohup setsid bash ~/agent-config-evals/phase3/driver.sh >> ~/agent-config-evals/phase3/driver.log 2>&1 &`.
  It sleeps 20 min and resumes on a usage limit (exit code 75).
  - Comparison 1, full vs bare: `--a BARE --b main`, 1 rep, concurrency 2, four parts then `--combine`:
    `2026-11-16T10-20-fvb-hard` (8 tasks, cap $15), `-fvb-base` (13, cap $19), `-fvb-vue` (15, cap $13),
    `-fvb-k5` (1, cap $2.5) → `2026-11-16T10-20-full-vs-bare`. Estimate $43 plus about $4 of judging.
  - Comparison 2, poteto-mode: `--a main --b main --b-prefix "/pstack:poteto-mode"`, `poteto-spec` S1–S5,
    1 rep, cap $28 → `2026-11-16T10-20-poteto-mode`. Estimate $7 off, $15–20 on.
  - If budget remains under the $80 total, add a second rep of comparison 2 with
    `--resume <dir> --reps 2` only if the suite supports raising reps on resume; otherwise report the shortfall.
- After Phase 3: write `evals/NEXT.md`, update README examples if needed, final summary, delete heartbeat `e95b56f3`.
- 10:37 UTC: `fvb-hard` done (16 runs, $9.99): run score A 0.92, B 1.00, CI −0.11 to +0.28, 7 of 8 tasks at ceiling; cost B +54%.
- 10:57 UTC: `fvb-base` done (26 runs, $11.15): mean d +0.10, CI −0.15 to +0.36; cost B +53%.
- 11:08 UTC: `fvb-vue` crashed with ENOSPC after 11 runs. Cause: each finished run's `app/` in the
  results dir carries a full copy of `node_modules` (230–280 MB; the hard links to the fixture cache
  do not survive). Fix applied by hand: removed `node_modules` from every finished run app and the
  finished evals' sandboxes (19 GB free again), driver relaunched at 11:15 and resumed `fvb-vue`.
  **Open code fix:** drop `linkPaths` from saved run apps after measuring and re-link them on
  `--recheck`. Until then, prune `runs/*/app/node_modules` in results dirs by hand; `--recheck` on
  those dirs needs `node_modules` linked back from a prepared fixture.
- Host now reports 15.7 GB RAM (was 7.5 GB).
- Phase 3 spend so far: $21.14.
- 11:35 UTC: **comparison 1 complete**: `~/agent-config-evals/2026-11-16T10-20-full-vs-bare` (74 runs, 37 tasks,
  $36.3 with the Vue judging finished at 11:43). First combined report: run score A (bare) 0.92, B (full)
  0.98, d +0.06, CI −0.03 to +0.15, MDE 0.13, 30 of 37 tasks at ceiling; cost B +103% (CI +75% to +139%).
  To redo after the two items below: recombine (delete `phase3/combined-dir` and the combined dir first).
  1. H1 bare scored 3 of 9 because its solution makes the `Idempotency-Key` header mandatory (422
     without it) and the hidden test sends most requests without one. The prompt allows that reading:
     test artefact. Planned correction after comparison 2 finishes (a fixture edit mid-eval would block
     its resume): the test sends a unique key on every request, mutant gate for H1, then `--recheck`
     on `fvb-hard` (trail kept), recombine.
  2. Vue judging was cut by the part's cap; finished by a resume with a higher cap.
- 11:43 UTC: comparison 2 stopped after 2 of 10 runs: the suite detected writes in the fixture cache.
  Cause: the lead symlinked the cache's `node_modules` into a scratch copy to re-run H1's hidden test.
  Driver relaunched at 11:47; resume rebuilds the cache. Lesson: never link the live cache by hand; use
  `--recheck` or `evals/mutants.mjs`.
- Phase 3 spend so far: full-vs-bare $36.30, poteto-mode $2.94.
- 12:10–14:40 UTC: third usage-limit pause, mid comparison 2. The driver slept and resumed, but two S4
  runs started while the account was still limited ended in 0 minutes at $0 and were recorded as
  isolation failures (three account-gated built-in skills were absent). The lead moved those two
  records to `<poteto-mode dir>/discarded/` and resumed; both runs then completed normally. Fixed in
  `evals/lib/isolation.mjs`: an absent built-in is a note, and a refused run is discarded, not recorded.
- 14:52 UTC: **comparison 2 complete** (10 runs, $18.80): run score 1.00 vs 1.00, all 5 tasks at
  ceiling (117 of 117 hidden cases in both arms); cost +71% with poteto-mode (CI +19% to +120%); judge
  +0.14 (CI −0.17 to +0.45); pstack fired in 5 of 5 prefixed runs, `pstack:poteto-agent` used in 2.
- 14:55 UTC: H1 hidden test corrected (unique Idempotency-Key on every request, no extra body field),
  H1 mutant gate 8 of 8, `--recheck` on `fvb-hard` (H1 bare 3/9 → 8/9, original checks kept in the
  record), recombined. The pre-recheck combined report is kept in `~/agent-config-evals/phase3/`.
  **Final comparison 1**: run score bare 0.93, full 0.98, d +0.04, 95% CI −0.04 to +0.12, MDE 0.12 at 37
  tasks, 30 at ceiling → cannot conclude; cost full +103% (CI +75% to +139%); judge +0.06 (CI −0.08 to +0.21).
- Spend: Phase 3 $55.12 (full-vs-bare $36.32, poteto-mode $18.80) of the $80 budget. Calibration and
  probes outside it: about $18.50. The remaining budget was not spent on a second rep: with every
  spec task at ceiling, more reps cannot change the primary metric.
- Open gaps: tasks are too easy for the primary metric (see `NEXT.md` step 0); no React fixture; C5 has
  no browser check; K6 and K7 not built; B11 m7, S4 m11 and C5 m6 mutants survive; the combined report
  does not repeat the source report's "Rechecked" line; the sandbox lives in a service-private `/var/tmp`.

# Round 2 (started 2026-11-16 15:35 UTC)

Brief: fix two skill bugs, stop re-running the bare arm and add arm result reuse, a `vue-design`
mockup task set with a continuous visual score, harder backend tasks, then three comparisons.
Rules: lead plans and reviews; **one** `claude-opus-5-5` subagent at a time; eval concurrency 1;
budget about $40 calibration and $80 comparisons. Heartbeat `4b7e7962` (delete when the round is done).

## Round 2 status

| # | Item | State |
|---|---|---|
| R1 | `fix/skill-bugs` from `origin/main` (worktree `../fix-skill-bugs`): Halstead package in `fullstack-typescript-static`; `emil-design-eng` never loading; regression tests; cherry-pick into `feat/repo-evals` | done: `fix/skill-bugs` pushed (`baac20a`, `d7d0108`), cherry-picked into `feat/repo-evals` |
| R2 | Suite: arm result reuse ("reused from <dir>"), no bare arm in future comparisons, `"reporter": "json-score"` for continuous checks | done (verify 213 pass); not yet exercised with real agents; the MCP path is confirmed by the first `vue-design` probe |
| R3 | `vue-design`: about 6 mockup screens (reference → Playwright PNGs), visual similarity + DOM layout + behaviour + axe, mutants, calibration | done: 6 screens D1–D6, gates pass, calibrated (D1 to re-run) |
| R4 | Harder backend set: RacePlanr replay feasibility first (time-boxed), else legacy fixture + symptom-only bugs + implied invariants + budgets + spec conformance; mutants; calibration to 30–60% failing | not started |
| R5.1 | Comparison: `main` vs `fix/skill-bugs` on `vue-design` | not started |
| R5.2 | Comparison: poteto-mode on vs off on the new backend set | not started |
| R5.3 | Comparison: `manual-qa` removed, reusing arm A of R5.2 | not started |
| R5.4 | Comparison: figma-link vs screenshot-only on `main`, 1 rep, reusing arm A of R5.1 | not started |
| R6 | `NEXT.md`, final summary, delete heartbeat | not started |

## Round 2 decisions

- Order R1 → R2 → R3 → R4 → R5, one subagent at a time; the lead reviews and commits between agents.
- A design task's run score is the mean of its required checks, each continuous in 0..1: visual
  similarity, DOM layout, behaviour (hidden tests), accessibility (axe). Gates (typecheck, lint,
  build) zero the score as before. Components are reported separately.
- Mockups reach the agent as PNG files shipped into the app with task-level `files`; the agent reads
  them with its image-capable Read tool. The reference implementation never ships.
- Disk: saved run apps no longer keep `node_modules`; watch `df` before long evals.
- **Addendum (16:05 UTC): design tasks follow the user's Figma hand-off.** The user copies a prompt
  with a link to a frame; the agent reads the frame through Figma's MCP server; no Code Connect.
  - A local, offline, deterministic stdio stub of Figma's MCP server serves `get_design_context`,
    `get_variable_defs`, `get_screenshot` and `get_metadata` under the official names, with responses
    generated from the hidden reference design (layer tree, sizes, spacing, text styles, colour
    tokens) and shaped like the official server's (docs checked first). It never leaks the Vue
    source, PrimeVue choices or hidden checks, and never connects to the real Figma. The fidelity gap
    is documented.
  - Prompts mimic Figma's copied prompt: a fake `https://www.figma.com/design/<fileKey>/...?node-id=<id>`
    link per frame plus a one-line request.
  - Two input modes per task, chosen per arm with `--a-mode` / `--b-mode`: `figma-link` (stub server
    plus links; primary) and `screenshot-only` (PNGs as files, no MCP).
  - The stub is copied into each run's sandbox and registered only for `vue-design` runs. The
    isolation check expects exactly that server in `figma-link` mode and none otherwise.
  - Comparisons: design skills (`main` vs `fix/skill-bugs`) runs in `figma-link`; a 1-rep figma-link
    vs screenshot-only comparison on `main` reuses the figma-link arm. If the budget is short, the
    design-pack `--b-remove` ablations go first.
- Spend is tracked per item in the log below.

## Round 2 log

- 15:35 UTC: heartbeat created; R1 started.
- 16:00 UTC: R1 done ($0.90 of probes). Halstead: the package exists as `quality-metrics` (the skill never named it; agents guessed `eslint-plugin-quality-metrics`, which 404s); skill now names it and its install line; test `tests/skill-references.test.mjs` checks install lists against a verified allowlist. `emil-design-eng`: installed and listed fine; agents on a working Vue task read routing and the Vue policy but skipped the bare skill name. Fix: sharper routing line plus a load step in `policy/vue-primevue.md`. Haiku probes on a working Vue task: before 0 of 4 loaded it, routing line alone 0 of 9, final fix 2 of 5 (2 of 2 runs that read the Vue policy; sonnet 1 of 1); control prompt 0 of 2. About 45% of haiku runs never read `routing.md` at all: not fixed.
- 16:02 UTC: R2 started (arm reuse, `json-score` reporter, telemetry undercount, concurrency default 1).
- 16:00 UTC: R1 done ($0.90 of probes). Halstead: the package exists as `quality-metrics` (the skill
  never named it; agents guessed `eslint-plugin-quality-metrics`, which 404s). The skill now names it
  with an install line; `tests/skill-references.test.mjs` checks install lists against a verified
  allowlist. `emil-design-eng`: installed and listed fine; agents on a working Vue task read routing
  and the Vue policy but skipped the bare skill name. Fix: a sharper routing line plus a load step in
  `policy/vue-primevue.md`. Haiku probes on a working Vue task: before 0 of 4 loaded it, routing line
  alone 0 of 9, final fix 2 of 5 (2 of 2 runs that read the Vue policy; sonnet 1 of 1); control
  prompt 0 of 2. About 45% of haiku runs never read `routing.md` at all: not fixed.
- 16:02 UTC: R2 started (arm reuse, `json-score` reporter, telemetry undercount, concurrency default 1).
- 16:05 UTC: user addendum on the Figma workflow recorded under decisions; R2 extended with per-arm
  input modes and a task-set MCP server (copied into the run sandbox, checked by isolation).
- 16:22 UTC: R2 done. Arm result reuse by `inputsKey` (narrowed to `fixture.json` + `template/` + setup scripts, plus per-task check, file and server hashes), `--backfill-keys`, `json-score` reporter with a score gate for mutants, input modes with per-run MCP config and isolation expectation, skill telemetry for `<name>/SKILL.md` under any root, concurrency default 1. R3a started.
- 17:25 UTC: R3a done ($0.64 haiku probe). `vue-design` pipeline: scorer (visual SSIM + colour, normalised against the untouched app; layout by role/name; 6 Playwright behaviour tests; axe), Figma MCP stub (`get_design_context`, `get_variable_defs`, `get_screenshot`, `get_metadata`; bundles generated from the reference render; leak test), task D1 with `figma-link` and `screenshot-only` modes, 8 mutants. Validation: reference 1.000, untouched 0.000, mutants 0.704–0.979 (lazy-but-plausible 0.704; colour token and font weight only −0.02). Renders byte-identical across runs. MCP path confirmed live: stub connected, isolation ok, haiku called `get_design_context` ×5 and `get_screenshot` ×3.
  **Risk:** haiku already scored 0.919 combined (visual 0.762, layout 0.913, behaviour 1, a11y 1), so Opus would sit near the ceiling. Lead decision for R3b: tighten tolerances so small design errors cost more, weight the combined score toward visual and layout (0.4 / 0.3 / 0.2 / 0.1), make the remaining screens denser, and anchor the tuning on the saved haiku solution (target about 0.6–0.75 for it).
- 17:45–19:40 UTC: usage limit; R3b stopped about 15 minutes in (weights and stricter scorer mid-change, checkpoint-committed with 2 failing tests). Resumed at 19:43.
- 22:40 UTC: R3b done. Score = 0.4 visual + 0.3 layout + 0.2 behaviour + 0.1 a11y (checks take a `weight`). Tighter tolerances: on D1 the lazy mutant went 0.70 → 0.42, spacing 0.87 → 0.60, colour tokens 0.98 → 0.91, font weights 0.98 → 0.86; the saved haiku solution 0.919 → 0.731. Screens D2 account settings, D3 pricing, D4 onboarding wizard, D5 invoices table, D6 customer detail: reference 1.00, untouched 0.00–0.03, lazy mutants 0.37–0.56, all 8 mutants killed on each. Both Vue gates pass; verify 228.
  **Calibration (Opus, `main`, figma-link, `~/agent-config-evals/2026-11-16T21-50-04-r2-design-calibration`, $12.34):** D2 0.68, D3 0.77, D4 0.75, D5 0.82, D6 0.67; D1 died on a 401 "OAuth token revoked" after $1.27 (to re-run). In the 0.5–0.8 target; behaviour saturates on D3, D5, D6. No scoring change after seeing these.
- Problems seen: GitHub 429 while cloning plugin marketplaces during arm builds (two failed launches); an expired OAuth token recorded as a run error. Next: a small suite fix (arm build cache, auth errors as transient), then R4.
- Round 2 calibration spend so far: $0.90 (R1 probes) + $0.64 (R3a probe) + $12.34 (design) = $13.88 of about $40.
- 22:37 UTC: suite fix done (arm build cache under `~/agent-config-evals/.cache/arms`, 24 h; auth failures discarded and retried; `--redo`; discarded spend persisted). D1 calibration redone: see the calibration dir (total with the discarded run $15.05). Design calibration spend $15.05; round 2 calibration total $16.59. R4a (RacePlanr replay feasibility) started.
- 23:00 UTC: R4a feasibility done (report: `~/agent-config-evals/round2/r4a-raceplanr-feasibility.md`, kept out
  of this public repo). Verdict: feasible with about a day of harness work. The poteto-mode work in
  RacePlanr is Rust (telemetry crates) and the Tauri/Vue desktop app, not the API; no Postgres needed;
  cargo tests run offline (415 pass, 16 s warm, 51 s cold, 3 GB target dir per run). PR-test dry checks
  on three issues fail before and pass after. Needs: fixtures loaded from a private path, a Rust
  toolchain in the scrubbed run env, a per-run target dir, spec amendments. Candidates: two small
  single-test fixes, one medium part of a spec issue, one large whole spec issue.
- **Lead decision on the backend design (R4):**
  1. R4b builds a synthetic **`ts-backend-legacy`** fixture (bigger, messier, older patterns, dead code,
     partial docs) with 7–8 tasks whose difficulty comes from finding the cause, not from longer
     requirement lists: two symptom-only bug reports, money/rounding and timezone invariants, a
     tenant-isolation sweep (find every IDOR), a measured query/latency budget on a seeded large
     dataset, OpenAPI conformance, and two spec-sized features for poteto-mode. Mutation-checked,
     calibrated to 30–60% of hidden cases failing (cap $20).
  2. R4c (only if a usage window remains before the comparisons): 3 private RacePlanr replay tasks
     (medium and large spec issue plus one small fix), kept outside this repo. Otherwise reported as
     feasible, not built.
  Calibration runs are `--a main` single-arm, so with reuse they double as arm A of R5.2 and R5.3.
- 00:45 UTC (Nov 17): R4b built `ts-backend-legacy` + `backend-legacy` G1–G8 (gate passes, 77 checks; verify 242) and started calibration; usage limit hit after one run (G7 18 of 18, $2.14). Lead resumed the calibration eval directly (`~/agent-config-evals/2026-11-16T23-57-57-r2-legacy-calibration`, loop in `round2/r4b-calibration.log`); R4b agent to be resumed only for failure classification.
