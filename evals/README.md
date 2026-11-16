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

# Test one changed policy without a branch: main plus that file (and its routing line) from feat/x
npm run eval -- --b main --b-add policy/typescript.md=feat/x --b-add policy/routing.md=feat/x

# Full agent-config against bare Claude Code; poteto mode on against off; pstack ablated
npm run eval -- --a BARE --b WORKTREE --tasks ts-backend
npm run eval -- --a WORKTREE --b WORKTREE --b-prefix "/pstack:poteto-mode" --tasks ts-backend
npm run eval -- --a WORKTREE --b WORKTREE --b-remove plugin:pstack --tasks ts-backend

# A/A control: how noisy is the judge on identical arms?
npm run eval -- --b main --smoke --reps 2

# Validate new tasks and their checks cheaply: one arm, no judge
npm run eval -- --tasks ts-backend --single-arm --only B1-task-comments --reps 1 --http

# Continue after a stop (budget, Ctrl-C, crash); finished runs and judgments are skipped
npm run eval -- --resume ~/agent-config-evals/<dir> [--max-usd 30]

# One report over evals of different task sets (and fixtures) with the same arms
npm run eval -- --combine ~/agent-config-evals/<backend-dir> ~/agent-config-evals/<vue-dir> --name full-vs-bare
```

`npm run eval -- --help` lists every option. Results go to `~/agent-config-evals/<timestamp>-<name>/`
(override the parent with `AGENT_CONFIG_EVALS_HOME`), never into this repository.

## Arms

An arm is a **ref** plus toggles. `--a` (default `main`) and `--b` take any git ref, `WORKTREE` for
the current checkout with uncommitted changes, or `BARE` for an empty home: Claude Code with nothing
installed. A git or `WORKTREE` arm is extracted into `<sandbox>/<eval>/arms/<arm>/src` and installed
with **that ref's own** `bin/agent-config.mjs sync --user` into `arms/<arm>/home` (its template home),
with `HOME`, `CLAUDE_CONFIG_DIR` and `CODEX_HOME` pointed there.

**External plugins.** The install includes the ref's external plugins (`bin/external-plugins.mjs`:
`claude plugin marketplace add` and `claude plugin install --scope user`, `npx skills add -g`, a git
sparse clone for Cursor), so the arm gets what a user of that ref gets. The installer passes its own
environment to those commands, so they all land in the template home. This needs network (GitHub
over git, npm) and takes about a minute per arm. `--plugins skip` sets
`AGENT_CONFIG_EXTERNAL_PLUGINS=skip` for an offline install without them. The ref's installer decides:
an older ref with no `external-plugins.mjs` installs no plugins either way. `arms.json` records per
arm the policies, skills, Claude Code plugins (id, version, `gitCommitSha`, the skills and agents each
ships, plus `claude plugin list --json`), and the arm's probe (below). Plugin versions are not pinned:
both arms are built back to back so they fetch the same upstream state, and a difference shows up as a
watched `plugin:<name>`.

**Toggles** edit the extracted tree before the install, or the installed home after it:

- `--b-add policy/<name>.md[=<src>]` or `--b-add skills/<name>[=<src>]`: `<src>` is a ref (same path),
  `<ref>:<path>`, or a local file or directory. Without `=<src>` the working tree's copy is used. A new
  policy pack only fires if routing mentions it, so add `policy/routing.md` from the same source too.
- `--b-remove policy/<name>.md` or `--b-remove skills/<name>`.
- `--b-remove plugin:<id>` (an id from the ref's `bin/external-plugins.mjs`: `taste-skill`,
  `emilkowalski-ui`, `mattpocock-skills`, `pstack`) removes that plugin after the install: Claude Code
  plugins with `claude plugin uninstall --scope user`, skills-only packs by deleting their copies under
  `.claude/skills`, `.agents/skills` and `.cursor/skills` (a skill the repo installs itself stays). The
  arm's probe must then show none of its skills or agents. Adding a plugin to a ref that lacks it is not
  supported; build the arm from a ref that declares it.
- `--a-add` and `--a-remove` work the same way. A `BARE` arm takes no toggles.

**Prompt prefixes.** `--b-prefix "<text>"` (or `--a-prefix`) puts `<text>` and a space before every
task prompt in that arm, for example `--b-prefix "/pstack:poteto-mode"` to run every task in poteto mode.
A task can set its own `"promptPrefix": { "A": "...", "B": "..." }`, which wins over the flag (an empty
string means no prefix for that arm). Each run record stores the exact `prompt` sent. Headless
`claude -p "/pstack:poteto-mode <task>"` expands plugin slash commands: the session log shows
`<command-name>/pstack:poteto-mode</command-name>` followed by the skill's body, and the run record lists
it under `isolation.commands`. The stream-json transcript does not echo it. The judge sees the task's
prompt without any prefix.

The suite compares the two installs, reports which files differ, and **watches** each changed
policy, skill or plugin (routing excluded; a plugin as `plugin:<name>`) for firing and false triggers.
`--watch <name>` adds more.

### Isolation and safety

**Layout.** Results stay in `~/agent-config-evals/<timestamp>-<name>/`. Everything an agent process
touches lives in a sandbox outside the home tree, `$AGENT_CONFIG_EVALS_SANDBOX` (default
`/var/tmp/agent-config-evals`), recorded in `config.json` as `sandbox`:

| Path | Contents |
|---|---|
| `<sandbox>/<eval>/arms/<arm>/{src,home}` | the extracted ref and its template home, built once |
| `<sandbox>/<eval>/runs/<id>/{home,app,tmp}` | one run: a copy of the template home, the worked copy, its `TMPDIR` |
| `<sandbox>/<eval>/judge/home` | the judge's config home (the judge itself runs from an empty temp directory) |
| `<sandbox>/.cache/` | the prepared fixtures, the npm cache for installs, Playwright |

The suite refuses to start when the sandbox sits inside your home, or when the sandbox or any
ancestor holds `.claude`, `CLAUDE.md`, `CLAUDE.local.md`, `AGENTS.md` or `.mcp.json`: Claude Code loads
those as project config whatever `HOME` says. (Earlier evals ran under the results dir and loaded the
live `~/.claude/skills` and `~/.claude/CLAUDE.md` in both arms. Their saved runs can still be reported,
rechecked and rejudged, not extended.)

**Each run** copies the part of its arm's template home that Claude Code reads (`cp -a` of `.claude`,
`.agents`, `.agent-config` and `.cursor/plugins/local`, about 200 MB and 1.5 s; the Codex and Cursor
copies stay in the template) and rewrites the template's absolute path to the run home in every file
that names it (the CLAUDE.md import, `installed_plugins.json`,
`known_marketplaces.json`, the install lock). The agent runs with cwd = its `app`, `HOME` and
`CLAUDE_CONFIG_DIR` in the run home, `TMPDIR`/`TMP`/`TEMP` in the run's `tmp`, and a scrubbed
environment: only `PATH` and the locale pass through, plus auth, telemetry switches and `--env`.
`--strict-mcp-config` keeps MCP servers out. When the agent exits, its process group is killed, then
every process whose environment carries the run's `HOME` or `TMPDIR` or whose cwd sits in the run dir
(dev servers started with `setsid` or relative paths included). After measurement, the worked copy
moves to `<results>/runs/<id>/app` (a rename on one filesystem, a copy otherwise), the session logs are
copied to `<results>/runs/<id>/session/`, and the run's home and tmp are deleted.

**How it is verified.**

- At arm build, one probe session per arm (`claude-haiku-5-5`, "Reply with the single word ok.", about
  $0.002) runs in a copy of the template home from an empty cwd, and one runs in an empty home to learn
  Claude Code's built-ins. Every skill, plugin and agent the arm's probe lists that is not built in must
  resolve to a file under the arm home, every installed plugin must load, a removed plugin must be
  gone, and no instruction file may load from outside the probe's home. Otherwise the arm build fails.
  The probe's init event (`skills`, `plugins` with source and version, `agents`, `mcp_servers`,
  `slash_commands`) is stored in `arms.json` as the arm's `expected`, the empty home's as `builtins`;
  the probe transcripts are kept in `<results>/probes/`.
- After every run, its first `system/init` event must match the arm's expectation exactly (skills,
  plugins by name and version, agents), with no MCP server, cwd = the run's `app`, and memory and
  plugin paths under the run home. Every instruction file the session log records as loaded
  (`attachment.type: "instructions"`, which lists CLAUDE.md and its `@` imports) must sit under the run
  home or the `app`. The result is the run record's `isolation` (`ok`, `problems`, `instructions`,
  `commands`). An extra component or a missing one the arm installed fails the check, but a missing
  built-in (account state and CLI flags can hide them) is only recorded in `isolation.notes`.
- A run that fails gets `status: "isolation"` and an `error` naming the difference. It is excluded
  from aggregation and judging and listed in the report's integrity warnings. By default the eval stops
  at the first such run; `--no-strict-isolation` keeps going.
- Every arm build snapshots your live config and aborts if anything changed: `~/.claude/CLAUDE.md`,
  `settings.json`, `skills/`, `agents/`, `plugins/installed_plugins.json` and `known_marketplaces.json`,
  `~/.agents/**`, `~/.agent-config/**`, `~/.codex/AGENTS.md` and `config.toml`, and the top level of
  `~/.claude/plugins` (and its `marketplaces` and `cache`), `~/.cursor/plugins` (and `plugins/local`),
  `~/.cursor/skills`, `~/.cursor/agents`, `~/.codex/plugins` and `~/.codex/skills`. Plugin caches are
  not walked, and Cursor and Codex session state is not watched.

**What is not isolated.**

- The filesystem. Agents run as you, with `--dangerously-skip-permissions`. A run can read or write
  anything you can by absolute path, and reach the other arm's template home and the other runs of
  this eval by relative path (`../../../arms/B/home`). The checks above show what a session *loaded*,
  not everything it *read*; reads show in the transcript's tool calls. Don't point a task set at a
  fixture holding anything you care about.
- The network, and ports: concurrent runs share localhost.
- Known, accepted read-only dependency: `claude plugin marketplace add` clones marketplaces over git
  SSH, and OpenSSH reads your live `~/.ssh` key and `known_hosts` (it finds them through the password
  database, not `HOME`). Nothing is written there; installs that need it fail without a key.
- `agent-browser` (used by the `manual-qa` skill) is pointed at the Chrome under your
  `~/.agent-browser` (read-only use) with a per-run session and `--no-sandbox`. Override with
  `--env AGENT_BROWSER_ARGS=`.
- Gates, hidden-test checks, `--http` and `--browser` are harness processes: they run with your
  environment in the run's working copy, with `TMPDIR` set to `<sandbox>/.tmp` (local disk, no eval
  name in the path) and temp names from `mkdtemp` or random ids.
- **Deletions and kills are fenced.** Every recursive delete goes through `removeTree(target, root)`,
  which refuses a target that is not strictly inside `root` and a `root` that is shallower than three
  path segments (`/var/tmp` is refused) or is your home or one of its ancestors. Run cleanup deletes
  only inside `<sandbox>/<eval>-<hash>/` (and the run's own dir in the results). Stray-process kills
  match whole environment entries (`HOME=<run home>`, `TMPDIR=<run tmp>`, both of which must lie in
  the run dir) or a cwd inside the run dir by whole path segments, never a path prefix, and skip the
  suite itself and its parent.
- Auth: `ANTHROPIC_API_KEY` or `CLAUDE_CODE_OAUTH_TOKEN` from your env if set. Otherwise the
  short-lived access token from your Claude login is read (read-only) at each spawn. The refresh
  token is never copied, so isolated runs can't rotate your login. Very long evals can outlive the
  access token; `--resume` picks up the refreshed one.
- Telemetry is off for every process: `DISABLE_TELEMETRY`, `DISABLE_ERROR_REPORTING`,
  `DISABLE_AUTOUPDATER`, `DO_NOT_TRACK`, and the npm update notifier.

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
cached under `<sandbox>/.cache/fixtures/<name>-<hash>`; editing any fixture file changes
the hash. After an eval, the cached copy is checked for writes made through hard links.

The shipped `vue-primevue` fixture is a small admin console (dashboard with a DataTable, settings
form, users list and detail, projects grid with a sidebar, image-heavy gallery, FAQ). It uses Vite 8,
Vue 3.5, strict TypeScript with `vue-tsc`, Tailwind 4, PrimeVue 4.5 (Aura, styled) with
`tailwindcss-primeui`, Pinia, vue-router, Vitest and ESLint. Its images are generated by
`scaffold.mjs`; the lockfile pins every dependency, including the hidden tests' jsdom and Testing
Library dev dependencies.

**Vue hidden tests.** `fixtures/vue-primevue/hidden/` holds one behavioural test per task except
C5. Each boots the app through the project's own `src/main.ts` (so services and theme options the
agent registered are live) on a fresh module graph per test, in jsdom, and drives it by role, label
and text with Testing Library. `harness.ts` stubs what jsdom lacks (`matchMedia`,
`IntersectionObserver`, the clipboard, native `<dialog>`, the Popover API, exclusive
`<details name>`, View Transitions) and loads the project's `index.html` head, running its inline
scripts. `vitest.hidden.config.ts` is copied next to `vite.config.ts` and reuses it, so the agent's
`vitest.config.ts` cannot change the hidden run. jsdom has no layout or CSS: C3 checks that a
navigation starts a transition, C4 that the header changes state on scroll and returns at the top,
and C5 (container-sized grid) has static checks only. The `mutants/<task>/` patches are the gate for
these tests (`npm run eval:mutants -- --set vue-primevue`).

The `ts-backend` fixture is a small multi-tenant tasks API with organisations, users, API tokens,
projects, tasks and a billing webhook. It has bearer-token auth (an Elysia `requireAuth` macro),
TypeBox request validation, JSON request logging, drizzle-kit SQL migrations plus a seed, and 16
Vitest tests that run against a real temporary database. Gates: `tsc --noEmit`, ESLint, Prettier,
Vitest, and `bun build`. The `http` step (`--http`) migrates and seeds a scratch database,
boots the server, and checks six endpoints.

The stack follows your own backend code on this machine:

| Repo | What it is | Stack |
|---|---|---|
| RacePlanr `apps/api` | the only TypeScript HTTP server | Bun 1.3 runtime and package manager; Elysia with TypeBox `t` validation and a macro-based auth guard; Drizzle ORM on Postgres (`pg`) with drizzle-kit SQL migrations; better-auth; Vitest; Prettier; `tsc --noEmit` |
| difftrail | a CLI and library monorepo, no server | pnpm, ESLint with typescript-eslint, Prettier, Vitest, TypeScript 6 |

The fixture keeps Bun, Elysia, Drizzle with drizzle-kit migrations, TypeBox validation, the macro
auth guard, the `{ code, message }` error style and Vitest. It changes three things:

- **SQLite via libSQL instead of Postgres**, so it runs without Docker. Tests use real temp-file
  databases rather than mocks, so hidden acceptance tests can check real queries, migrations and
  transactions.
- **Plain hashed API tokens instead of better-auth**, which would need email and secret setup.
- **ESLint added**, from difftrail and agent-config's TypeScript quality stack. RacePlanr's API only
  runs Prettier.

TypeScript is pinned to 6.0 to match difftrail; typescript-eslint doesn't support 7 yet. drizzle-kit's generated `drizzle/meta/*_snapshot.json` files are left out of diffs, since
they made up about 60% of every migration diff the judge had to read.

**Hidden acceptance tests.** `fixtures/ts-backend/hidden/` holds tests the agent and the judge
never see. A task's `command` check copies them in after the diff is taken, runs them, and removes
them. Each test exercises only the HTTP contract stated in the task prompt. On the untouched
fixture, `task-update-rules` passes (it checks that behaviour is preserved) and every other hidden
test fails for the reason its task targets.

### Mutation gate

A hidden test or task check is only trusted once it tells right from wrong solutions.
`fixtures/<fixture>/mutants/<task id>/` holds patches
against the template and a `manifest.json`:

```jsonc
{
  "task": "B5-webhook-idempotency",
  "baselinePasses": false,  // true for behaviour-preservation tasks: the untouched fixture passes the hidden check
  "references": [{ "file": "reference-aa-A-r2.patch", "source": "validation-ts-backend-aa A r2" }],
  "knownFailing": [{ "file": "known-failing-aa-A-r1.patch", "source": "…", "reason": "why this real solution is wrong" }],
  "mutants": [{ "file": "m4-wrong-key.patch", "wrong": "what is wrong", "violates": "the prompt sentence", "expect": "killed" }]
}
```

`npm run eval:mutants` copies a prepared fixture once per patch (to
`${AGENT_CONFIG_EVALS_SANDBOX:-/var/tmp/agent-config-evals}/mutants/`), applies it with `git apply` and
scores the task's checks exactly as `--recheck` does. It fails when a reference fails a required
check, a known-failing solution passes, the untouched fixture passes, a mutant marked `killed`
survives, or a task kills fewer than 80% of its mutants (`expect: "survives"` mutants count against
the rate and need a `why`). Options: `--set`, `--fixture`, `--task`, `--concurrency` (default 4),
`--json <file>`, `--keep`. It makes no model calls. The full ts-backend run takes about 4.5 minutes
at concurrency 4 (the B9 backoff and B11 startup tests dominate), so `npm run verify` runs only
`tests/evals-mutants.test.mjs`: every task with a hidden test has a valid manifest, every patch
applies to the template, at least 5 mutants per task (3 for controls) and a declared kill rate of
at least 80%. Run the gate after changing any hidden test, check or prompt.

Make a patch from a worked app (a saved run's `app/`, or a copy you broke by hand) with
`npm run eval:mutants -- --fixture ts-backend --make-patch <app> > <task>/m7-….patch`. It diffs
against the template with the fixture's `diffExclude` (so no drizzle snapshots) and strips
timestamps. A mutant should differ from a real solution only in its bug: keep the solution's own
tests in it, or a "tests added" check kills it for the wrong reason.

## Task sets

`tasks/<name>.json` holds prompts written the way a user would ask, never naming the policy under
test.

```jsonc
{
  "name": "vue-primevue",
  "fixture": "vue-primevue",
  "categories": { "library": { "label": "Library-covered" }, "control": { "label": "Non-web controls", "control": true } },
  "smoke": ["L1-confirm-delete", "N1-query-parser-util"],
  "featurePatterns": { "containerQueries": "@container|container-type" },
  "tasks": [{
    "id": "L1-confirm-delete",
    "category": "library",
    "prompt": "…",
    "expectsComponents": ["vue-primevue", "plugin:pstack"],
    "checks": [
      { "id": "acceptance", "type": "command", "run": "vitest run src/__hidden__/x.test.ts", "copy": { "hidden/x.test.ts": "src/__hidden__/x.test.ts" }, "reporter": "vitest-json" },
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
- `command` checks run a shell command in the worked copy (with `node_modules/.bin` on `PATH`) and
  pass on exit 0, or on failure with `"expect": "fail"`. `copy` maps fixture-relative files (hidden tests)
  to app-relative paths; they are copied in after the diff is taken and removed afterwards.
  `timeoutSec` defaults to 600; a timeout scores 0.
- `"reporter": "vitest-json"` on a `command` check scores it by test case: the suite appends
  `--reporter=json --outputFile=<temp file outside the app>` to `run` (so `run` must end with the
  `vitest run ...` call; CLI flags override any reporter the agent configured), and records `passed`,
  `total` (passed plus failed; skipped tests don't count) and `score = passed / total`. The score is 0
  when a test file fails to load, no test runs, no report is written or the command times out. Failed
  test names go into `detail`. `pass` still needs exit 0 and every test passing. `expect` is ignored.
- Every check result carries a `score`: the Vitest fraction above, otherwise 1 for a pass and 0 for a fail.
- A task's `files` (`{ "fixture-relative source": "app-relative target" }`, e.g. a spec document) are
  copied into the worked copy before the agent starts, and into the base the diff is taken against, so
  they never count as the agent's change.
- Checks default to `level: "required"`. `info` checks are scored and reported but don't count.
- `expectsComponents` (or the older `expectsPolicies`) lists the components a task should fire:
  policy and skill names, and plugins as `plugin:<name>`. A watched component firing on a task that
  doesn't list it is a **false trigger** (reported separately for `control` categories). A listed
  component that didn't fire is a **miss**.
- A policy counts as fired when the agent read its file. If the task set defines a
  `policySignals.<policy>.commandPattern` regex, it counts as fired only when the agent ran a matching command.
- A skill fires on a `Skill` tool call naming it (bare or `<plugin>:<skill>`), a read of its `SKILL.md`,
  or a slash invocation: the prompt sent starts with `/<skill>` or `/<plugin>:<skill>`, or the session
  shows the command expanded (`<command-name>`). A plugin fires when any of its skills fires that way.
- `featurePatterns` counts how many runs used each pattern, on added lines with comments stripped.

## What gets measured

The **primary metric** is the run score: the mean `score` of the task's required checks (hidden
tests scored by test case where the check uses the Vitest reporter), or 0 when a fixture gate failed or
the run did not finish. Each run also records `allPass` (every required check and gate passed). Tasks
with no required checks have no score and are left out of the primary metric; the report counts them.
Runs that fail the isolation check (`status: "isolation"`) are excluded from every figure and listed
in a warning. Old result dirs without check scores are scored from each check's `pass`.

**The comparison is over tasks, not runs.** An arm's task score is the mean of its run scores over the
reps; reps of one task are not independent samples, they only make that task's mean more precise. For
every task run in both arms, d_t = B_t − A_t. The report gives mean d, SD(d), a paired-t 95% CI over the
T tasks, a seeded task-level bootstrap 95% CI (10,000 resamples of tasks), the **MDE** (minimum
detectable effect: the true difference found 80% of the time at two-sided α = 0.05,
(t₀.₉₇₅,T−1 + t₀.₈,T−1) × SD(d) / √T, which tends to 2.8 × SD(d) / √T), and how many tasks an MDE of
0.10 and 0.20 would need at the observed SD. More tasks shrink the CI; more reps barely do when the
effect differs by task.

**Verdict vocabulary** (decided by the paired-t CI of the primary metric):

| Verdict | When |
|---|---|
| **B better** / **A better** | the 95% CI excludes 0 |
| **no difference larger than ±0.10** | the CI lies inside ±0.10 |
| **no difference observed; metric at ceiling/floor on N of T tasks** | SD(d) = 0 and mean d = 0 (for example both arms pass everything): the metric could not show a difference |
| **cannot conclude** | anything else, with the MDE and the tasks needed; always when fewer than 5 tasks are paired |

The report always counts the tasks at the ceiling (both arms 1.0) and the floor (both 0): a metric at
the ceiling is uninformative, however narrow its CI. The same statistics are computed for the all-pass
rate and the judge's overall score (secondary). The judge never sets or upgrades the headline: when the
primary verdict is "no difference" or "cannot conclude" the headline adds "judge (secondary) favours
B/A/neither" from the judge's own task-level CI. Cost is a separate headline line: the ratio of task
means (B / A − 1) with a task-bootstrap CI, plus wall time and turns; it is never folded into the quality
verdict. Per-category figures are descriptive means without verdicts. In an A/A eval (identical arms) the
same statistics are reported, and any "better" verdict is flagged as a false positive.

| Area | Source |
|---|---|
| Gates | each fixture gate passes or fails |
| Checks | the task's own checks, each with a score (see above) |
| Dependencies | dependencies added to the manifest |
| Features | which `featurePatterns` each run used |
| Component telemetry | policies, skills and plugins read or invoked; per watched component and arm: runs and tasks where it fired, false triggers and misses against `expectsComponents` |
| Cost | USD, input, output and cache tokens, wall time, turns, tool calls |
| Judge (secondary) | 1–5 scores on the fixture's `judgeDimensions`, plus a pairwise preference |
| Browser (`--browser`) | Playwright build, serve and screenshot of each route, with console errors (Playwright installs into the eval cache on first use) |
| HTTP (`--http`) | the fixture's `http` spec: prepare commands, boot the service on a free port, compare each request's status with the expected one |

### Judge and noise

The judge sees only the task, the fixture's `judgeContext` and the two diffs. Arms are anonymised
as "Patch 1/2" and paths rewritten to `a/` and `b/`. Each pair is judged `--judge-reps` times (default 2) with the
patch order alternated. A patch is preferred only when every verdict prefers it, so both orders must
agree: a position flip, or one vote plus one tie, is a tie. With `--judge-reps 1` the single verdict
stands. Malformed replies are retried twice. Reports on older result dirs re-derive saved preferences
with this rule and say how many changed.

The rubric comes from the fixture's `judgeDimensions` (default `correctness`, `accessibility`, `fit`,
`platform`, `scope`; also available: `tests`, `maintainability`). `ts-backend` uses correctness, tests,
fit, scope and maintainability, so its overall score isn't diluted by dimensions that are constant on
backend work. "Overall" is the unweighted mean of the fixture's dimensions.

The judge is **secondary**. Its overall score is compared at task level like the primary metric (each
task's A/B pairs averaged), reported with its own CI, and used only as a tiebreaker (see "What gets
measured"). For every task with at least 2 reps, `--judge-controls` (default 1) **A#1-vs-A#2** pairs are
judged too: the mean absolute overall-score difference between runs of the **same** arm, with a
bootstrap CI over pairs, is reported as a descriptive noise figure. It gates nothing. In an A/A eval
(identical arms), every pair is a control.

`--judge-command "<cmd>"` sends the prompt on stdin to any CLI and reads the JSON reply from stdout,
for example `codex exec -` or `llm -m <model>`. That gives you a judge from another model family.
Its cost isn't tracked.

**Default judge: Sonnet 5.5** (`claude-sonnet-5-5`); agent runs stay on Opus. Override it with
`--judge-model`. Sonnet was chosen by re-judging two earlier evals' saved pairs with both models:

| Saved eval | Pairs | Same preference | Opposite decisive calls | B−A margin correlation | Sonnet noise floor | Opus noise floor | Cost per judgment, Sonnet vs Opus |
|---|---|---|---|---|---|---|---|
| vue-primevue A/A (identical arms) | 8 | 88% | 0/4 | 0.92 | 0.14 | 0.16 | $0.046 vs $0.097 |
| earlier 15-judgment policy A/B (retired) | 15 | 73% | 2/12 | 0.81 | 0.24 (5 control pairs) | 0.14 | $0.062 vs $0.132 |

Sonnet costs about half as much per judgment and calls fewer ties (more decisive verdicts). It
reached the same verdict on both evals. Its noise floor was equal on the A/A eval and higher on the
5 control pairs of the policy A/B, which is too few pairs to separate from chance. If a result hinges on a close
call, re-judge it with Opus (below).

**Judge sets and re-judging.** Verdicts are stored per judge under
`results/judge/<judge-set>/`, for example `claude-sonnet-5-5` or `claude-opus-5-5-high`.
`npm run eval -- --resume <dir> --rejudge --judge-model <model>` skips the agent runs and judges the
saved pairs with that judge. The report then uses that set and adds a **Judge comparison** section
against every other set: preference agreement, opposite decisive calls, score deltas, margin
correlation, cost, and each judge's noise floor. Evals from before judge sets are moved under their
original judge's id the first time they are resumed.

## Budget, resume and parallelism

- `--concurrency` (default 3) applies to runs and to judgments. Gates and hidden tests run in the
  harness next to the running agents, so at most 2 runs measure (gates, checks, `--http`,
  `--browser`) at once, and the fixtures' `test` gates use `vitest run --testTimeout=30000` because
  Vitest's 5 s default trips under that load. A hidden-test check sets its own timeouts in the task set.
- `--max-usd` stops starting new runs or judgments once spend (agent plus judge) reaches the cap.
  In-flight work finishes, so the overshoot is at most about `concurrency` runs. A run killed at
  `--timeout-min` has no result event; its spend is taken from the session log's last running total
  (`cost.usdSource: "session-log"`). Arm probes (about $0.002 each) are not counted.
- `--max-runs` caps the total number of runs.
- The queue goes rep by rep with shuffled task and arm order, so a stop leaves the arms balanced.
- Rerunning with `--resume <dir>` skips every run or judgment with a result file. A run interrupted
  mid-way has none: its sandbox dir is wiped and the run is redone. The arms are reused from the
  sandbox path in `config.json`.
- **The sandbox can vanish.** The default `/var/tmp` may be a service-private tmp (systemd
  `PrivateTmp=yes`, as for an agent daemon) that is recreated empty whenever the service restarts, for
  example after an out-of-memory kill. Finished runs live in the results dir and are kept. On
  `--resume`, a missing or half-built arm is rebuilt from the same ref and toggles, re-probed, and
  compared with `arms.json`: identical installed files and plugin versions and commits → the eval goes
  on (the report's integrity warnings and `audit.jsonl` note the rebuild); otherwise it stops, unless
  `--accept-arm-drift` is passed, which records the drift and goes on. The fixture cache and judge home
  are rebuilt as needed.
- `--min-free-mb <n>` (default 1500, 0 disables): before starting an agent run, wait while
  `MemAvailable` is lower, logging once a minute. A global out-of-memory kill takes the whole eval down.
- **Usage limits.** A run or judgment that the provider cuts off (a result with `is_error` and a 429,
  "You've hit your session limit · resets …", a rate or usage limit, or an overload/5xx), or an agent
  that died from a signal without a result, is not recorded: nothing new starts, the partial report is
  written with the reason under `summary.providerStop` (including the reset time when given), and the
  suite exits with code **75**. Its spend is counted in that session only. To run a long eval
  unattended:

  ```sh
  dir=~/agent-config-evals/<timestamp>-<name>   # from the first run's log
  npm run eval -- <flags> --out "$dir"; code=$?
  while [ "$code" = 75 ]; do sleep 1800; npm run eval -- --resume "$dir"; code=$?; done
  ``` Ctrl-C finishes in-flight work and writes a partial report; a second
  Ctrl-C aborts.
- `--report-only --resume <dir>` re-aggregates without calling any model. It keeps the judge set the
  last report used, even if `config.json` names another (it says so in the integrity warnings); pass
  `--judge-model` to switch.
- `--strict-isolation` (the default) or `--no-strict-isolation` may be changed on resume; the arms,
  `--plugins`, prefixes, tasks, model and reps may not.
- `--rejudge --resume <dir>` re-runs only the judging, with the judge flags you pass.

### Combining evals across fixtures

A task set has one fixture, but a comparison may need tasks from several (full agent-config against
bare Claude Code on the backend and the Vue tasks). `npm run eval -- --combine <dir> <dir> ... --name
<name>` writes a new results dir (`<AGENT_CONFIG_EVALS_HOME>/<timestamp>-<name>/`, or `--out`) whose run
records and judgments are the union of the inputs', and reports it like any eval: the task-level
paired statistics run over every task together. It calls no model and only reads the inputs.

- It refuses unless every input has the same provider, model, effort and single-arm setting, and per
  arm the same ref and commit, toggles, prefix, plugin mode, plugin versions and commits, and installed
  files (a digest of the arm inventory). Each task set may appear once.
- A task id used by more than one task set becomes `<task set>.<id>`. Every task, run and judgment
  keeps `sourceSet`, `sourceTask` and `fixture`; runs also keep `sourceRun`. Diffs, transcripts and
  session logs are copied; worked copies stay in the source dirs.
- `config.json` lists the inputs under `combined.inputs` (dir, task set, fixture, fixture hash, run
  count), and `audit.jsonl` records the combine. The report ends with a **Per fixture (descriptive)**
  table: paired tasks, runs and mean scores per fixture. The verdict is the pooled one.
- A combined dir can't be resumed, rechecked or rejudged: do that on the source dirs, then combine
  again.

## Output

`<results>/REPORT.md` starts with the **verdict**: a quality line (primary verdict, mean d, paired-t
and bootstrap CIs, MDE, and the judge tiebreak when it applies) and a cost line (ratio with its CI),
then the sample (paired tasks × reps, runs counted and excluded) and the ceiling/floor counts. Then:
integrity warnings (isolation exclusions, A/A false positives, re-derived ties, fixture and recheck
notes, plugins at different versions in the two arms), setup (per arm: ref and sha, toggles, prompt
prefix, plugin mode, plugins with version and commit, skill and policy counts; a "Rechecked N time(s)" line
after `--recheck`), the task-level comparison table (primary, all-pass, judge), per-task results (score
A/B, d, hidden test cases passed/run, reps, all-pass, judge preference), per-category means
(descriptive), cost (ratios with CIs, means, and where the money went), component telemetry (with
subagent calls per `subagent_type`), judge (secondary: dimension means, noise figure, judge-set comparison) and notable diffs.

`summary.json` carries the same numbers under stable keys: `primary`, `allPass`, `judge` and `cost`
each have `mean`, `ci`, `bootstrapCi`, `mde`, `tasks` and `verdict` (`{ code, text }`; codes `B better`,
`A better`, `no difference`, `cannot conclude`; cost uses `B costs more`/`B costs less`), plus `sd`,
`tasksNeeded`, `ceiling`, `floor` and `perTask` (`cost` also has `wallMin` and `turns`). `headline`
holds the two headline lines, `sample` the sample sizes and exclusions, and `spend` the money
(`runsUsd`, `runsUsdByArm`, `judgeUsd`, `judgeUsdPerJudgment`, `otherJudgeSetsUsd`, `totalUsd`).
The raw data sits alongside it:

| Path | Contents |
|---|---|
| `summary.json` | aggregated results |
| `results/runs/*.json` | one record per run |
| `results/judge/<judge-set>/*.json` | one record per judgment |
| `runs/<task>__<arm>__r<n>/` | `transcript.jsonl`, `diff.patch`, and the worked `app/` |
| `config.json`, `taskset.json`, `arms.json` | what was run |

**Disk use.** Per run the results dir keeps the transcript, session logs, `diff.patch`, the HTTP and
browser artefacts and the worked `app/`. Once a run is measured, the fixture's `linkPaths`
(`node_modules`, `public/images`) are dropped from its saved app (`prunedLinkPaths` in the run
record): moved out of the sandbox they would become a private copy of a few hundred MB per run. A run
whose `package.json` added dependencies (`deps.added`) keeps its own copy (`prunedLinkPaths: []`),
because the pristine `node_modules` would not match it. `--recheck` links the missing dirs back from
the prepared fixture cache (of the current fixture version) for each run's checks and removes them
again. `--keep-linked` keeps them in every saved app, as before.

## Providers

`lib/providers/` holds the agent providers. One implements `runAgent` (with the run's home, cwd and
`tmp`; it kills its process group on exit), `parseTranscript` (to the normalised
`{ events: { reads, commands, skills }, usage, costUsd, ... }`), `probe` (the cheap arm probe whose init
event becomes the arm's expectation), `sessionRoot(home)` (where its session logs live) and `ask` (for
judging).
Only `claude` ships today (Claude Code headless, `--model` default `claude-opus-5-5`, `--effort`
default `medium`). Adding Codex means a `codex.mjs` that runs `codex exec --json` with `CODEX_HOME`
inside the arm home (the installer already writes `~/.codex/AGENTS.md` there) and maps its events.
The orchestrator doesn't change.

## Limits

- Two fixtures so far (`vue-primevue`, `ts-backend`). Results generalise only as far as the fixture and
  tasks resemble your work.
- Hidden tests pin the HTTP contract each prompt states. A valid solution with a different contract
  (for example a 422 where the test accepts only 400) fails them. Read the check detail before
  trusting a failure.
- External plugins are installed from their upstream marketplaces at arm build time, so two arms
  built minutes apart could get different plugin versions. `arms.json` records each version and a
  version difference shows up as a watched `plugin:<name>`.
- Isolation covers what Claude Code loads, not what an agent can read: see "What is not isolated".
- The isolation check relies on Claude Code's init event and session log format (verified on 2.1.311);
  a format change shows up as failed probes or isolation failures, not as silent leaks.
- The default judge is the same model family as the agent; use `--judge-command` for a second
  opinion. Judges read diffs, not running UI; use `--browser` for that.
- Diffs can still reveal an arm through code comments that mention the policy.
