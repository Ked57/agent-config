# feat/repo-evals progress

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
| 1.1 | Isolation: per-run HOME and TMPDIR outside the home tree, plugins installed, init verification | agent A | in flight |
| 1.2 | Decision rule: task-level paired CI, MDE, "cannot conclude" | agent B | done (`1db5fa0`), reviewed |
| 1.3 | Primary metric: hidden-test and required-check pass rate; judge as tiebreaker | agent B | done (`1db5fa0`); `run.mjs` wiring requests sent to agent A |
| 1.4 | Mutant gate (`npm run eval:mutants`) | agent C | in flight |
| 1.5 | Weak tests: B5 strict, B6, B8, B9, B10, N2 | agent C | in flight |
| 1.6 | Vue behavioural hidden tests; MWG wording removed from the Vue task set | agent D | in flight |
| 2 | `ts-backend-hard` task set (from the stream 7 drafts) | agent E | in flight |
| 2 | `poteto-spec` task set (4–6 spec-sized tasks) | agent G | in flight |
| 2 | Component tasks from the inventory's mapping | not started | waits for F |
| 2 | Prompt prefixes per arm, ablation arms (`--b-remove plugin:x`), bare arm | agent A | in flight |
| 3 | Comparison 1: full agent-config vs bare Claude Code | lead | waits for 1 and 2 |
| 3 | Comparison 2: poteto-mode on vs off | lead | waits for 1 and 2 |
| — | `evals/NEXT.md` ablation proposal | lead | not started |

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
