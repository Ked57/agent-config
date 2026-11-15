# A/B evals for agent-config changes

Measures whether a policy, skill or routing change actually changes agent behaviour. Two
agent-config **arms** are built from git refs. The same **tasks** run against fresh copies of a
**fixture** project under each arm, with headless agents. Each run is scored with deterministic
gates and checks, routing telemetry, cost, and a blind pairwise LLM judge whose noise floor is
measured alongside it.

```sh
# Does feat/x improve on main? (3 reps of every task in the default task set)
npm run eval -- --a main --b feat/x --tasks vue-primevue --reps 3

# Fast check: the task set's smoke subset, 1 rep
npm run eval -- --b feat/x --smoke

# Test one added policy without a branch: main plus that file (and its routing line) from feat/x
npm run eval -- --b main --b-add policy/modern-web.md=feat/x --b-add policy/routing.md=feat/x

# A/A control: how noisy is the judge on identical arms?
npm run eval -- --b main --smoke --reps 2

# Continue after a stop (budget, Ctrl-C, crash); finished runs and judgments are skipped
npm run eval -- --resume ~/agent-config-evals/<dir> [--max-usd 30]
```

`npm run eval -- --help` lists every option. Results go to `~/agent-config-evals/<timestamp>-<name>/`
(override the parent with `AGENT_CONFIG_EVALS_HOME`), never into this repository.

## Arms

`--a` (default `main`) and `--b` take any git ref, or `WORKTREE` for the current checkout with
uncommitted changes. Each arm is extracted with `git archive` and installed with **that ref's own**
`bin/agent-config.mjs sync --user`, with `HOME` pointed at `<results>/arms/<arm>/home` and
`AGENT_CONFIG_EXTERNAL_PLUGINS=skip`. Toggles edit the extracted tree before the install:

- `--b-add policy/<name>.md[=<src>]` or `--b-add skills/<name>[=<src>]`: `<src>` is a ref (same path),
  `<ref>:<path>`, or a local file or directory. Without `=<src>` the working tree's copy is used. A new
  policy pack only fires if routing mentions it, so add `policy/routing.md` from the same source too.
- `--b-remove policy/<name>.md` or `--b-remove skills/<name>`. `--a-add` and `--a-remove` work the same way.

The suite compares the two installs, reports which files differ, and **watches** each changed
policy or skill (routing excluded) for firing and false triggers. `--watch <name>` adds more.

### Isolation and safety

- Agents run with a scrubbed environment: only `PATH` and the locale pass through, with
  `HOME`/`CLAUDE_CONFIG_DIR` set to the arm's home. They cannot see your `~/.claude`, `~/.agents` or
  `~/.codex`.
- Every arm build snapshots your live config (`~/.claude/CLAUDE.md`, `settings.json`, `skills/`,
  `~/.agents/**`, `~/.codex/AGENTS.md`) and aborts if anything changed.
- Telemetry is off for every process: `DISABLE_TELEMETRY`, `DISABLE_ERROR_REPORTING`,
  `DISABLE_AUTOUPDATER`, `DO_NOT_TRACK`, and the npm update notifier.
- Auth: `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` from your env if set. Otherwise the
  short-lived access token from your Claude login is read (read-only) at each spawn. The refresh
  token is never copied, so isolated runs can't rotate your login. Very long evals can outlive the
  access token; `--resume` picks up the refreshed one.
- `agent-browser` (used by the `manual-qa` skill) is pointed at your installed Chrome with a
  per-run session and `--no-sandbox`. Override with `--env AGENT_BROWSER_ARGS=`.
- Agents run with `--dangerously-skip-permissions` inside throwaway fixture copies. Don't point a
  task set at a fixture holding anything you care about.

## Fixtures

`fixtures/<name>/` holds:

- `fixture.json`: setup commands, gates, dependency manifest, browser routes, and judge context.
- `template/`: the project's source files.
- Optionally, generator scripts for anything large or binary.

A second fixture (a Node API, a Rust CLI) only needs a new folder.

```jsonc
{
  "name": "vue-primevue",
  "setup": ["npm ci", "node {fixtureDir}/scaffold.mjs ."],   // run once in a staging copy of template/
  "linkPaths": ["node_modules", "public/images"],              // hard-linked into each run, not copied
  "diffExclude": ["node_modules", "dist", "*.tsbuildinfo"],
  "gates": { "lint": "eslint . --max-warnings 0", "typecheck": "vue-tsc --build --force", "test": "vitest run", "build": "vite build" },
  "dependencies": { "type": "npm", "file": "package.json" },   // for the new-dependency diff
  "browser": { "build": "vite build", "serve": "vite preview --port {port} --strictPort", "routes": ["/", "/settings"] },
  "judgeContext": "Stack description and what to penalise, shown to the judge."
}
```

Gates run from the fixture definition, not from the project's `package.json`, so an agent editing
scripts can't weaken them. They run with `node_modules/.bin` on `PATH`. The prepared project is
cached under `~/agent-config-evals/.cache/fixtures/<name>-<hash>`; editing any fixture file changes
the hash. After an eval, the cached copy is checked for writes made through hard links.

The shipped `vue-primevue` fixture is a small admin console (dashboard with a DataTable, settings
form, users list and detail, projects grid with a sidebar, image-heavy gallery, FAQ). It uses Vite 8,
Vue 3.5, strict TypeScript with `vue-tsc`, Tailwind 4, PrimeVue 4.5 (Aura, styled) with
`tailwindcss-primeui`, Pinia, vue-router, Vitest and ESLint. Its images are generated by
`scaffold.mjs`; the lockfile pins every dependency.

## Task sets

`tasks/<name>.json` holds prompts written the way a user would ask, never naming the policy under
test.

```jsonc
{
  "name": "vue-primevue",
  "fixture": "vue-primevue",
  "categories": { "library": { "label": "Library-covered" }, "control": { "label": "Non-web controls", "control": true } },
  "smoke": ["L1-confirm-delete", "N1-query-parser-util"],
  "policySignals": { "modern-web": { "commandPattern": "modern-web-guidance@\\S+\\s+(search|retrieve)" } },
  "featurePatterns": { "containerQueries": "@container|container-type" },
  "tasks": [{
    "id": "L1-confirm-delete",
    "category": "library",
    "prompt": "…",
    "expectsPolicies": ["vue-primevue", "modern-web"],
    "checks": [
      { "id": "primevue-confirm", "type": "pattern", "in": "added", "pattern": "useConfirm", "expect": "present" },
      { "id": "no-dialog", "type": "pattern", "in": "added", "pattern": "<dialog\\b", "expect": "absent" },
      { "id": "final", "type": "pattern", "in": "final", "files": ["src/stores/*.ts"], "pattern": "countsByRole", "expect": "present" },
      { "id": "ui-untouched", "type": "changed", "files": ["src/views/**"], "expect": "none", "level": "info" }
    ]
  }]
}
```

- `pattern` checks match a regex against the run's added diff lines (`in: "added"`, optionally limited
  by `files`) or against the final contents of the matching files (`in: "final"`).
- `changed` checks assert that some (`any`) or none (`none`) of the globbed files changed.
- Checks default to `level: "required"`. `info` checks are reported but not counted as failures.
- `expectsPolicies` feeds the routing telemetry. A watched policy firing on a task that doesn't list
  it is a **false trigger** (reported separately for `control` categories). A listed policy that
  didn't fire is a **miss**.
- A policy counts as fired when the agent read its file. If the task set defines a `commandPattern`
  signal for it, it counts as fired only when the agent actually ran that command.
- `featurePatterns` counts how many runs used each pattern (modern CSS, native APIs and so on).

## What gets measured

| Area | Source |
|---|---|
| Gates | each fixture gate passes or fails |
| Checks | the task's own checks |
| Dependencies | dependencies added to the manifest |
| Features | which `featurePatterns` each run used |
| Routing telemetry | policies and skills read or invoked, signal hits, false-trigger and miss rates for watched policies (from the stream-json transcript) |
| Cost | USD, input, output and cache tokens, wall time, turns, tool calls |
| Judge | 1–5 scores on correctness, accessibility, fit, platform and scope, plus a pairwise preference |
| Browser (`--browser`) | Playwright build, serve and screenshot of each route, with console errors (Playwright installs into the eval cache on first use) |

### Judge and noise

The judge sees only the task, the fixture's `judgeContext` and the two diffs. Arms are anonymised
as "Patch 1/2" and paths rewritten to `a/` and `b/`. Each pair is judged `--judge-reps` times (default 2) with the
patch order alternated. If verdicts disagree, including flips caused by position, the result is a
tie. Malformed replies are retried twice.

For every task with at least 2 reps, `--judge-controls` (default 1) **A#1-vs-A#2** pairs are judged
too. They set the noise floor: the mean absolute overall-score difference between runs of the
**same** arm. The report counts a B-vs-A difference only when it beats that floor **and** a sign test
on the decisive verdicts gives p < 0.1. In an A/A eval (identical arms), every pair is a control.

`--judge-command "<cmd>"` sends the prompt on stdin to any CLI and reads the JSON reply from stdout,
for example `codex exec -` or `llm -m <model>`. That gives you a judge from another model family.
Its cost isn't tracked.

## Budget, resume and parallelism

- `--concurrency` (default 3) applies to runs and to judgments.
- `--max-usd` stops starting new runs or judgments once spend (agent plus judge) reaches the cap.
  In-flight work finishes, so the overshoot is at most about `concurrency` runs.
- `--max-runs` caps the total number of runs.
- The queue goes rep by rep with shuffled task and arm order, so a stop leaves the arms balanced.
- Rerunning with `--resume <dir>` skips every run or judgment with a result file. Ctrl-C finishes
  in-flight work and writes a partial report; a second Ctrl-C aborts.
- `--report-only --resume <dir>` re-aggregates without calling any model.

## Output

`<results>/REPORT.md` has these sections: recommendation (a heuristic verdict with reasons),
setup, per-task results, per-category summary, cost overhead, policy and skill telemetry, judge
noise floor, and notable diffs. The raw data sits alongside it:

| Path | Contents |
|---|---|
| `summary.json` | aggregated results |
| `results/runs/*.json` | one record per run |
| `results/judge/*.json` | one record per judgment |
| `runs/<task>__<arm>__r<n>/` | `transcript.jsonl`, `diff.patch`, and the worked `app/` |
| `config.json`, `taskset.json`, `arms.json` | what was run |

## Providers

`lib/providers/` holds the agent providers. One implements `runAgent`, `parseTranscript` (to the
normalised `{ events: { reads, commands, skills }, usage, costUsd, ... }`) and `ask` (for judging).
Only `claude` ships today (Claude Code headless, `--model` default `claude-opus-5-5`, `--effort`
default `medium`). Adding Codex means a `codex.mjs` that runs `codex exec --json` with `CODEX_HOME`
inside the arm home (the installer already writes `~/.codex/AGENTS.md` there) and maps its events.
The orchestrator doesn't change.

## Limits

- One fixture so far. Results generalise only as far as the fixture and tasks resemble your work.
- External plugins (Taste, Matt Pocock, Emil, pstack) are skipped in both arms so installs stay
  offline and identical. Routing lines naming them point at skills that aren't installed.
- The default judge is the same model family as the agent; use `--judge-command` for a second
  opinion. Judges read diffs, not running UI; use `--browser` for that.
- Diffs can still reveal an arm through code comments that mention the policy.
