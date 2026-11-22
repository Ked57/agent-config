# A/B evals for agent-config changes

Measures whether a policy, skill or routing change actually changes agent behaviour. Two
agent-config **arms** are built from git refs. The same **tasks** run against fresh copies of a
**fixture** project under each arm, with headless agents. Each run is scored with deterministic
gates and checks, routing telemetry, cost, and a blind pairwise LLM judge whose noise floor is
measured alongside it.

## Regression smoke (start here)

Two rounds of A/B evals (history: [`history/README.md`](history/README.md)) showed that synthetic tasks
cannot separate configs on quality: Opus 5.5 passes them with or without this config. What the suite
does measure well is **which policies and skills fire** and **what a task costs**. `npm run eval:smoke`
checks exactly that, cheaply, after every config change:

```sh
npm run eval:smoke                          # the working tree, uncommitted changes included
npm run eval:smoke -- --ref main            # a branch or commit instead
npm run eval:smoke -- --only C3-page-transition,P1-landing-page   # rerun a few tasks
npm run eval:smoke -- --resume ~/agent-config-evals/<dir>         # after a usage limit (exit 75)
npm run eval:smoke -- --from ~/agent-config-evals/<dir>           # report again, no agent runs
npm run eval:smoke -- --update-baseline     # run, then write evals/smoke-baseline.json
```

It runs one arm, one rep of each task in [`smoke.json`](smoke.json) on Sonnet 5.5 (`claude-sonnet-5-5`,
medium effort), at concurrency 1, with the judge off (a single arm has nothing to compare against). Each
task set is a normal `npm run eval -- --single-arm` under `~/agent-config-evals/<timestamp>-smoke/<set>/`,
with the same isolation, arm cache and result reuse; `SMOKE.md` there holds the report.

| Task | Covers | Expected to fire | Must not fire |
|---|---|---|---|
| L1-confirm-delete | Vue/PrimeVue UI, library component | routing, vue-primevue, typescript, emil-design-eng, manual-qa | react |
| C3-page-transition | Vue/PrimeVue UI, motion | routing, vue-primevue, animate | react |
| C5-container-card-grid | Vue/PrimeVue UI, layout | routing, vue-primevue, emil-design-eng, manual-qa | react |
| P1-landing-page | Designed page without a mockup | routing, vue-primevue, emil-design-eng, taste-skill, manual-qa | react |
| D2-account-settings | Design from a mockup (PNG hand-off) | routing, vue-primevue, emil-design-eng, manual-qa | react, taste-skill |
| N1-query-parser-util | Pure-utility control in a UI repo | routing, typescript | manual-qa, agent-browser, emil-design-eng, react |
| B6-login-rate-limit | TS backend feature | routing, typescript | manual-qa, agent-browser, vue-primevue, emil-design-eng |
| B7-tenant-isolation | Backend bug fix (reported defect) | routing, typescript | same |
| B3-project-list-n-plus-one | Backend bug fix (performance) | routing, typescript | same |
| K5-token-cli | TS backend CLI | routing, typescript | same |
| N1-parse-duration | Pure-utility control | routing, typescript | same |
| N2-readme | Non-code control (docs) | routing | same |

**Verdicts.** Per task, against the expectations in `smoke.json` and the numbers in
[`smoke-baseline.json`](smoke-baseline.json):

- **Fail** (exit 1): a forbidden component fired on any task; an expected component fired on fewer of
  the tasks expecting it than its minimum rate (`minFireRate` in `smoke.json`, default 100%: today
  `manual-qa` 50%, `typescript` 70%, `emil-design-eng` 75%); a fixture gate failed that the baseline
  run passed; or a run errored or broke isolation. The report ends with the per-component firing table.
- **Warn** (exit 0): a single task missing an expected component (while the rate holds), a gate failing
  as it did in the baseline, cost or turns more than 30% off the baseline (`costTolerance`), a required
  check scoring below its baseline, or firing of a component the spec does not mention that differs
  from the baseline ("newly fired", "no longer fired").

**Cost.** A full run costs about **$2.20** (measured 2026-11-17: $2.35 and $2.15 for the 12 tasks;
$1.59 for the first 11) and takes about 15 minutes, plus about 3 minutes once to generate the design
mockups. Each task set's sandbox is deleted when it finishes; budget about 1 GB of free disk while it runs. Tasks with an
unchanged config and task are reused from earlier results at no cost.

**Noise.** One rep is one sample, and Sonnet skips optional steps more often than Opus. In the three
runs of 2026-11-17: no forbidden component ever fired (0 of 21 task runs), so that check is strict;
`manual-qa` fired on 4 and then 2 of the 4 UI tasks that expect it, and `typescript.md` was skipped on
2 of 7 tasks once, hence the per-component minimum rates. C3 never loaded `emil-design-eng` or ran
manual QA although it read the policy asking for both, so neither is expected there. N2's README failed
the Prettier gate in 2 of 3 runs (the baseline records it). A firing failure that a rerun with `--only`
does not repeat is noise; one that repeats is real.

**Workflow.**

1. Change the config (`policy/`, `skills/`, `bin/external-plugins.mjs`).
2. `npm run eval:smoke`. Read `SMOKE.md`: each FAIL and each warning.
3. Decide: a failure from your change → fix the change; an expectation your change makes wrong on
   purpose → edit `smoke.json` in the same commit; drift → check the transcript in
   `<set>/runs/<task>__A__r1/`.
4. Once it is right, `npm run eval:smoke -- --update-baseline --from <that dir>` (or rerun with
   `--update-baseline`) and commit `smoke-baseline.json` with the change. Refresh it from `main`
   after a merge: `npm run eval:smoke -- --ref main --update-baseline`.

The full A/B machinery below is still there for cost comparisons and ablations.

## Design defects: Figma → PrimeVue (start here for UI work)

Asks where a Figma-to-page build falls short, not whether one config beats another. The `vue-design` screens
come through the Figma MCP stub as a design-kit file would: PrimeVue components are kit instances named in
designer words with variant properties ("Dropdown", "Status chip", `Type=Danger, Style=Outlined`), colours are
`Brand/500` and `Gray/200` variables, text styles `Heading/H1` (see
[`FIGMA-STUB-FIDELITY.md`](fixtures/vue-primevue/design/FIGMA-STUB-FIDELITY.md)). Each run's checks record
**findings**, what a design review would flag (an element 6 px off, a hand-built dropdown, a wrong text colour, a
state that cannot be reached), and `eval:defects` counts them per category:

```sh
# Baseline: the config on main with poteto-mode, on the PrimeVue-heavy screens
npm run eval -- --single-arm --a main --a-prefix "/pstack:poteto-mode" --tasks vue-design \
  --only D2-account-settings,D5-invoices-table,D6-customer-detail --reps 2 --no-judge --name figma-main
# The working tree's config on the same screens
npm run eval -- --single-arm --a WORKTREE --a-prefix "/pstack:poteto-mode" --tasks vue-design \
  --only D2-account-settings,D5-invoices-table,D6-customer-detail --reps 2 --no-judge --name figma-worktree
# Findings per category, the second column against the first
npm run eval:defects -- ~/agent-config-evals/<figma-main dir> ~/agent-config-evals/<figma-worktree dir>
```

`DEFECTS.md` has the mean findings per run by category (missing, component, spacing, size, typography,
colour, radius, state, behaviour, a11y), and per task the check scores and the findings that recur across
runs. Renders are deterministic, so a category that drops between two configs dropped because the builds
changed; with 2 reps per task, read a change of less than about one finding per run as noise. The
categories and thresholds are in [`design/README.md`](fixtures/vue-primevue/design/README.md) "Findings".
`--recheck` re-scores saved runs, so findings can be added to evals run before they existed.

## A/B comparisons

```sh
# Does feat/x improve on main? (3 reps of every task in the default task set)
npm run eval -- --a main --b feat/x --tasks vue-primevue --reps 3

# Fast check: the task set's smoke subset, 1 rep
npm run eval -- --b feat/x --smoke

# Test one changed policy without a branch: main plus that file (and its routing line) from feat/x
npm run eval -- --b main --b-add policy/typescript.md=feat/x --b-add policy/routing.md=feat/x

# Config against config: a fix branch; one skill removed; poteto mode on against off; pstack ablated
npm run eval -- --a main --b fix/x --tasks ts-backend
npm run eval -- --a main --b main --b-remove skills/manual-qa --tasks ts-backend
npm run eval -- --a main --b main --b-prefix "/pstack:poteto-mode" --tasks ts-backend
npm run eval -- --a main --b main --b-remove plugin:pstack --tasks ts-backend

# The same tasks with a Figma MCP server against attached PNG mockups (task-set input modes)
npm run eval -- --a main --b main --a-mode figma --b-mode files --tasks vue-design

# A/A control: how noisy is the judge on identical arms?
npm run eval -- --b main --smoke --reps 2

# Validate new tasks and their checks cheaply: one arm, no judge
npm run eval -- --tasks ts-backend --single-arm --only B1-task-comments --reps 1 --http

# Continue after a stop (budget, Ctrl-C, crash); finished runs and judgments are skipped
npm run eval -- --resume ~/agent-config-evals/<dir> [--max-usd 30]

# One report over evals of different task sets (and fixtures) with the same arms
npm run eval -- --combine ~/agent-config-evals/<backend-dir> ~/agent-config-evals/<vue-dir> --name full-vs-bare
```

With reuse on (the default), repeated comparisons against an unchanged arm cost nothing for that arm:
its finished runs are copied from the earlier eval (see "Reusing runs").

`npm run eval -- --help` lists every option. Results go to `~/agent-config-evals/<timestamp>-<name>/`
(override the parent with `AGENT_CONFIG_EVALS_HOME`), never into this repository.

## Arms

An arm is a **ref** plus toggles. `--a` (default `main`) and `--b` take any git ref, `WORKTREE` for
the current checkout with uncommitted changes, or `BARE` for an empty home: Claude Code with nothing
installed (kept for reference; comparisons are config against config). A git or `WORKTREE` arm is extracted into `<sandbox>/<eval>/arms/<arm>/src` and installed
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

**Arm cache.** A built template home is cached in
`${AGENT_CONFIG_EVALS_HOME:-~/agent-config-evals}/.cache/arms/<key>/` (`home/` plus `entry.json` with
the arm's inventory, plugin versions and commits, `builtAt`, and the home path its files embed). The key
hashes everything that determines the build: the ref's commit, the content of the extracted tree after
toggles (which covers a `WORKTREE` checkout and what each `--x-add` resolved to), the removals including
`plugin:<id>`, `--plugins`, and the suite's `ARM_BUILD_VERSION`. An entry younger than
`--arm-cache-hours` (default 24) is copied into the sandbox arm dir instead of running the installer: the
template's path is rewritten in the files that name it (as for a run home), the copy's file digests must
equal the cached inventory (else the arm is built fresh), and the log says `Arm A: reused cached build
from <date> (plugins ...)`. Only the part of the home a run reads is cached (about 200 MB per arm). The
arm probe still runs in every eval, so the expectation is checked against what actually loads.
`--arm-cache-hours 0` disables the cache (no read, no write); `--rebuild-arms` builds fresh and replaces
the entry. `BARE` arms are not cached. An install that fails on the network (HTTP 429, "rate limit",
"Could not resolve host", a timeout) is retried after 60, 180 and 300 s; if it still fails and an expired
entry exists, that entry is used with a warning in the log, `audit.jsonl` (`arm-cache-fallback`) and the
report's integrity warnings. `arms.json` records per arm `cache.status` (`stored`, `reused`,
`expired-fallback` or `off`) and the key.

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
| `~/agent-config-evals/.cache/arms/<key>/` | cached arm template homes (see Arms); outside the sandbox so they survive a service restart |

The arm cache is the one piece of agent config under the home tree. That is safe because no agent
process ever runs with its cwd or `HOME` there: builds, probes and runs use copies in the sandbox.

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
  access token: a run that ends in an authentication error (HTTP 401/403, "OAuth token revoked",
  `authentication_error`, "invalid x-api-key", "token has expired") is discarded and retried once at
  once with a freshly read token; if that fails too, the eval stops with exit code 75 and asks you to
  log in again (`claude`), then `--resume`.
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

**Vue design tasks.** The `vue-design` set builds screens from a design hand-off on the same fixture. Its
scorer, screen specs and export tools live in `fixtures/vue-primevue/design/` (see its README for the metric
and how to add a screen); the Figma MCP stub and the frame mockups in `fixtures/vue-primevue/figma-stub/`. The
template carries what the screens need and nothing else: bundled Inter fonts (`public/fonts`, linked from
`index.html`) and seed data modules such as `src/services/analytics.ts`.

The `ts-backend` fixture is a small multi-tenant tasks API with organisations, users, API tokens,
projects, tasks and a billing webhook. It has bearer-token auth (an Elysia `requireAuth` macro),
TypeBox request validation, JSON request logging, drizzle-kit SQL migrations plus a seed, and 16
Vitest tests that run against a real temporary database. Gates: `tsc --noEmit`, ESLint, Prettier,
Vitest, and `bun build`. The `http` step (`--http`) migrates and seeds a scratch database,
boots the server, and checks six endpoints.

The stack is a typical Bun API: Bun 1.3 runtime and package manager, Elysia with TypeBox `t`
validation and a macro-based auth guard, Drizzle ORM with drizzle-kit SQL migrations, Vitest,
Prettier and `tsc --noEmit`. Two choices keep it self-contained:

- **SQLite via libSQL instead of Postgres**, so it runs without Docker. Tests use real temp-file
  databases rather than mocks, so hidden acceptance tests can check real queries, migrations and
  transactions.
- **Plain hashed API tokens** instead of an auth library that needs email and secret setup.

ESLint with typescript-eslint follows agent-config's TypeScript quality stack. TypeScript is pinned to 6.0; typescript-eslint doesn't support 7 yet. drizzle-kit's generated `drizzle/meta/*_snapshot.json` files are left out of diffs, since
they made up about 60% of every migration diff the judge had to read.

**Hidden acceptance tests.** `fixtures/ts-backend/hidden/` holds tests the agent and the judge
never see. A task's `command` check copies them in after the diff is taken, runs them, and removes
them. Each test exercises only the HTTP contract stated in the task prompt. On the untouched
fixture, `task-update-rules` passes (it checks that behaviour is preserved) and every other hidden
test fails for the reason its task targets.

**`ts-backend-legacy`** is the same stack grown into a time-tracking and invoicing API a team has
lived in for years (about 5k lines of source, 76 tests): old controllers with raw SQL helpers and
hand-rolled validation next to newer routes and services, legacy date and money helpers, a
deprecated v1 reports module still mounted, feature flags, dead code, a partly stale
`docs/architecture.md` and a partial `docs/openapi.yaml`. Its `backend-legacy` task set (G1–G8)
makes tasks hard by what the agent has to find rather than by longer requirement lists:
symptom-only bug reports (a log excerpt, a support ticket), invariants that imply concurrency and
integer cents, a sweep for every cross-tenant hole, a measured query and latency budget on a large
dataset generated at test time, OpenAPI conformance, and two spec issues (`files` ships them under
`docs/issues/`). The flaws the tasks depend on are listed in `fixtures/ts-backend-legacy/PLANTED.md`,
which never reaches an agent or judge. G8 compares v1 responses byte for byte with
`hidden/G8-golden.json`, captured from the untouched template (`CAPTURE=1` rewrites it).

**Quality setup.** `quality-fresh` (on `ts-backend`) and `quality-legacy` (on `ts-backend-legacy`) each send
one plain "set up our quality tooling" prompt. Both seed `src/lib/ids.mock.ts` and a test that uses it (task
`files`), so the `<domain>.mock.ts` convention exists. The `lint-probe` check copies `hidden/quality/` into the
worked app, which plants one violation per lint gate the static skill requires: complexity, cognitive
complexity, `max-params`, `any`, `as unknown as`, floating promises, a prose comment, a disabled gate,
`ts-ignore`, `.only`, retries, timeouts, sleeps, `timers/promises`, and `vi.mock` of a project module. It then
scores the share the project's own ESLint rejects, and also that a single-line `WARNING:` comment passes. The
legacy set also requires `eslint-suppressions.json`. The probe and seed files are byte-identical in both
fixtures (a test enforces it). Their mutation gates use real agent runs as references (`installAfterPatch`
installs the plugins those runs added) next to a hand-built reference limited to the fixture's packages.
Results on Opus 5.5 (medium effort), 2026-11-22: five runs of each scored 1.00 with every gate passing, at
$1.37 to $2.64 per fresh run and $1.73 to $3.61 per legacy run. The last two of each ran with the seeded mock
and caught its ban too. Legacy runs changed at most one existing source file and baselined the rest.

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

**Score gate.** A task whose checks are continuous (`json-score`) rarely fails outright, so its manifest
can judge by score instead: `"scoreGate": { "referenceMin": 0.9, "untouchedMax": 0.2, "mutantMaxDrop": 0.05 }`.
A score is the (weighted) mean of the task's required check scores. Every reference must score at least
`referenceMin`, the untouched fixture at most `untouchedMax`, and a mutant counts as killed (a known-failing
solution as failing) when it scores at least `mutantMaxDrop` below the lowest reference. The 80% kill-rate
rule applies to that count. The gate table prints the scores of the references, the untouched fixture and
each mutant for every task; `--json` adds each run's per-check scores (`checkScores`).

A reference that adds dependencies cannot run against the prepared fixture's linked `node_modules`.
Set `"installAfterPatch": "<command>"` (for example `"bun install"`) in the manifest: a patch that changes
`package.json` then gets a private, freshly installed `node_modules` (the linked one is removed first, so
the cache is never written). This needs the network; patches that leave `package.json` alone skip it.

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
  `timeoutSec` defaults to 600; a timeout scores 0. `"browserTools": true` installs Playwright with Chromium,
  pngjs and axe-core (pinned) into `<sandbox>/.cache/tools` on first use and passes that dir as `EVAL_TOOLS_DIR`
  (browser-based scorers load their packages from there, never from the fixture).
- `"reporter": "json-score"` on a `command` check scores it continuously: the command runs with
  `EVAL_SCORE_FILE=<temp file outside the app>` in its environment and must write
  `{ "score": <0..1>, "components": { "<name>": <0..1> }, "detail": "<short text>" }` there. The result
  carries `score`, `components` and `detail`; `pass` is `score >= passAt` (`"passAt"` on the check,
  default 1). A command that exits non-zero but wrote a valid file keeps its score (exit 1 may mean "below
  threshold"). No file, an invalid one or a timeout scores 0 with the output's tail as detail.
- `"reporter": "vitest-json"` on a `command` check scores it by test case: the suite appends
  `--reporter=json --outputFile=<temp file outside the app>` to `run` (so `run` must end with the
  `vitest run ...` call; CLI flags override any reporter the agent configured), and records `passed`,
  `total` (passed plus failed; skipped tests don't count) and `score = passed / total`. The score is 0
  when a test file fails to load, no test runs, no report is written or the command times out. Failed
  test names go into `detail`. `pass` still needs exit 0 and every test passing. `expect` is ignored.
- Every check result carries a `score`: the Vitest fraction or the JSON score above, otherwise 1 for a pass and 0 for a fail.
- `"weight"` (a positive number, default 1) weights a required check in the run score; the run score is the
  weighted mean of the required check scores (`vue-design` weighs visual 0.4, layout 0.3, behaviour 0.2, a11y 0.1).
- A task's `files` (`{ "fixture-relative source": "app-relative target" }`, e.g. a spec document) are
  copied into the worked copy before the agent starts, and into the base the diff is taken against, so
  they never count as the agent's change.
- `modes` and `defaultMode` define input modes (see "Input modes" below).
- Checks default to `level: "required"`. `info` checks are scored and reported but don't count.
- `expectsComponents` (or the older `expectsPolicies`) lists the components a task should fire:
  policy and skill names, and plugins as `plugin:<name>`. A watched component firing on a task that
  doesn't list it is a **false trigger** (reported separately for `control` categories). A listed
  component that didn't fire is a **miss**.
- A policy counts as fired when the agent read its file. If the task set defines a
  `policySignals.<policy>.commandPattern` regex, it counts as fired only when the agent ran a matching command.
- A skill fires on a `Skill` tool call naming it (bare or `<plugin>:<skill>`), a read of its `SKILL.md`
  (a Read path or a shell command naming `<skill>/SKILL.md` under any root, such as
  `cat "$S/emil-design-eng/SKILL.md"`; a brace list `skills/{a,b}/SKILL.md`; or `skills/<skill>/` and a bare
  `SKILL.md` in the same command, such as `cd skills/<skill> && cat SKILL.md`; the name must match whole),
  or a slash invocation: the prompt sent starts with `/<skill>` or `/<plugin>:<skill>`, or the session
  shows the command expanded (`<command-name>`). A plugin fires when any of its skills fires that way.
- `featurePatterns` counts how many runs used each pattern, on added lines with comments stripped.

### Input modes

A task set can define how the task reaches the agent, and each arm picks one. The `vue-design` set,
for example, gives the agent a Figma frame link read through an MCP server in one mode and PNG mockups
attached as files in the other.

```jsonc
{
  "defaultMode": "figma",
  "modes": {
    "figma": {
      "serverFiles": "figma-stub",   // fixture-relative dir, copied into each run
      "mcpServers": { "figma": { "command": "node", "args": ["{serverDir}/server.mjs"], "env": { "FIGMA_DATA": "{serverDir}/frames.json" } } }
    },
    "files": {}
  },
  "tasks": [{
    "id": "D1-dashboard", "prompt": "Build the frame at https://www.figma.com/design/…", "files": { "specs/d1.md": "docs/d1.md" },
    "modes": { "files": { "prompt": "Build the screen in docs/d1.png", "files": { "mockups/d1.png": "docs/d1.png" } } }
  }]
}
```

- `--a-mode <name>` / `--b-mode <name>` set an arm's mode (default: `defaultMode`); the Setup table shows it.
  Two arms that differ only in mode are a real comparison, not an A/A control.
- A task's `modes.<mode>.prompt` replaces its prompt in that mode and `modes.<mode>.files` adds to its
  `files`. A task without an entry for the mode, or a set without modes, runs as before.
- A mode with `mcpServers` gets a per-run `--mcp-config` (next to `--strict-mcp-config`, which keeps every
  other server out). Only local stdio servers are allowed: `url` and `type: http|sse` are refused. The
  mode's `serverFiles` dir is copied to `<sandbox run>/mcp/<mode>/` and the placeholders `{serverDir}`,
  `{runDir}` (the run's sandbox dir), `{appDir}` and `{fixtureDir}` are expanded in `command`, `args` and
  `env`. Use `{serverDir}`: the repository holds the hidden tests and reference designs, and the agent can
  read any path its config names. **Whatever `serverFiles` holds is visible to the agent** (it runs with
  every permission next to that copy), so keep only what the server needs there. Each server starts through
  `env -u ANTHROPIC_API_KEY -u CLAUDE_CODE_OAUTH_TOKEN`, with telemetry off.
- The arm probe stays MCP-free. A run's isolation check expects exactly its mode's servers, each
  `connected`; another server, or a missing or failed one, fails the run. A mode without servers still
  requires none.
- Each run records its MCP tool calls by tool name (`mcpCalls`, from `mcp__<server>__<tool>` calls in
  the transcript); the report's telemetry section has a per-arm table.

## What gets measured

The **primary metric** is the run score: the mean `score` of the task's required checks, weighted by their `weight` (default 1) (hidden
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

- `--concurrency` (default 1: one agent at a time, the usual setting) applies to runs and to judgments. Gates and hidden tests run in the
  harness next to the running agents, so at most 2 runs measure (gates, checks, `--http`,
  `--browser`) at once, and the fixtures' `test` gates use `vitest run --testTimeout=30000` because
  Vitest's 5 s default trips under that load. A hidden-test check sets its own timeouts in the task set.
- `--max-usd` stops starting new runs or judgments once spend (agent plus judge) reaches the cap.
  In-flight work finishes, so the overshoot is at most about `concurrency` runs. A run killed at
  `--timeout-min` has no result event; its spend is taken from the session log's last running total
  (`cost.usdSource: "session-log"`). Arm probes (about $0.002 each) are not counted.
- `--max-runs` caps the total number of runs. Reused runs count toward neither cap.
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
  `--accept-arm-drift` is passed, which records the drift and goes on. The rebuild takes a fresh entry
  from the arm cache when there is one, so it usually costs seconds and no network. The fixture cache and judge home
  are rebuilt as needed.
- `--min-free-mb <n>` (default 1500, 0 disables): before starting an agent run, wait while
  `MemAvailable` is lower, logging once a minute. A global out-of-memory kill takes the whole eval down.
- **Usage limits.** A run or judgment that the provider cuts off (a result with `is_error` and a 429,
  "You've hit your session limit · resets …", a rate or usage limit, or an overload/5xx), or an agent
  that died from a signal without a result, is not recorded: nothing new starts, the partial report is
  written with the reason under `summary.providerStop` (including the reset time when given), and the
  suite exits with code **75**. An authentication error is handled the same way after one immediate
  retry (see Isolation, Auth). To run a long eval unattended:

  ```sh
  dir=~/agent-config-evals/<timestamp>-<name>   # from the first run's log
  npm run eval -- <flags> --out "$dir"; code=$?
  while [ "$code" = 75 ]; do sleep 1800; npm run eval -- --resume "$dir"; code=$?; done
  ``` Ctrl-C finishes in-flight work and writes a partial report; a second
  Ctrl-C aborts.
- **Discarded spend.** A discarded run's spend (from its session log) is kept in
  `results/discarded.json` and counts toward `--max-usd` across resumes; the report's spend line shows
  it as "discarded runs $x (n run(s) ...)" and includes it in the total.
- `--redo <id,id> --resume <dir>` redoes recorded runs (for example one that a provider error ended
  before this suite recognised it): their records, saved run dirs and every judgment that used them
  move to `<dir>/discarded/<timestamp>/` (same layout), their recorded cost joins the discarded spend,
  `audit.jsonl` gets a `redo` entry, and the runs are run again.
- `--report-only --resume <dir>` re-aggregates without calling any model. It keeps the judge set the
  last report used, even if `config.json` names another (it says so in the integrity warnings); pass
  `--judge-model` to switch.
- `--strict-isolation` (the default) or `--no-strict-isolation` may be changed on resume; the arms,
  `--plugins`, prefixes, tasks, model and reps may not.
- `--rejudge --resume <dir>` re-runs only the judging, with the judge flags you pass.

### Reusing runs

Every new run record carries an `inputsKey`: a sha256 over a canonical JSON of the run's inputs, kept
readable in the record as `inputs`. The inputs are the provider, model, effort, timeout and `--env`; the
arm's identity (commit, or `BARE`/`WORKTREE`; toggles; plugin mode; each plugin's version and commit; the
installed-files digest, which also covers toggle contents and `WORKTREE` arms) and the effective prompt
prefix; the input mode (name, server specs, a content hash of its `serverFiles`); the task id, the exact
prompt sent, a hash of its checks with the contents of every file a check copies in (the hidden tests) and
of its pre-run `files` (binary files included); the fixture's template hash (`runFixtureHash`: `fixture.json`,
`template/` and the scripts its `setup` names as `{fixtureDir}/<path>`, but not `hidden/`, `mutants/`, specs or
MCP stubs, which enter only through the task's own copies, files and server files, so editing another
task's hidden test keeps every key); the rep number; and `--http` and
`--browser`. The arm letter is not an input.

- Before running pending work, the suite indexes every finished run (`*/results/runs/*.json`, combined
  dirs and unreadable files skipped) under the evals home. A pending run whose key matches a run with
  `status: "ok"` (never an isolation or error run) is **reused**: its record, `diff.patch`, transcript,
  session logs and other artefacts are copied under this eval's run id, with the arm letter remapped, and
  `reusedFrom: { dir, runId, madeAt, at }` set. The log says `reused <id> from <dir>`. Rep n reuses rep n
  only, and no source run stands in twice in one eval.
- The worked `app/` is not copied. `--recheck` on a reused run re-scores the source dir's app if it still
  exists (and leaves the source record alone); otherwise it skips the run with a warning.
- A reused run's recorded cost stays in its record, so cost comparisons between the arms stay valid, but
  it is not part of this eval's spend or `--max-usd`. The report's Setup says "Arm A: 12 of 12 runs reused
  from `<dir>` (made <date>)", marks reused tasks in the per-task table, separates new spend from the
  recorded cost of reused runs, and adds an integrity note: reused runs were not made in the same time
  window as the new ones (their inputs, plugin versions included, are identical by key). Judging works on
  the copied diffs as usual, and `--combine` keeps `reusedFrom`.
- `--no-reuse` turns it off; `--reuse-from <dir>` (repeatable) searches only those dirs, which may lie
  outside the evals home. `--dry-run` prints how many runs would be reused and how many run.
- `--reuse-allow-plugin-drift` also reuses, when no exact match exists, a run whose key differs only in
  external plugin versions and commits (and their files), provided the plugin set and the repo-owned
  installed files are identical and none of the drifted plugins fired in it (repo-owned files come from
  the record's `inputs.installedParts`, or for older records from the source eval's `arms.json`). Such a
  run carries `reusedFrom.pluginDrift`, the report adds an integrity warning and a Setup note per arm,
  and `--dry-run` splits `reusedStrict` from `reusedWithPluginDrift`.
- `--recheck` updates a run's key when the checks changed, so later evals with the same checks can reuse it.
- `node evals/run.mjs --backfill-keys <dir>` adds keys to an eval made before keys existed. It recomputes
  them from the dir's `config.json`, `arms.json` and `taskset.json` and the repository's check files,
  only when the template hash the eval ran with equals the current one and each task's prompt, prefix,
  checks, files and the set's modes equal the current task set's. Otherwise it refuses that run and says
  why. New evals record that hash (`runFixtureHash`) and the repo commit (`repoCommit`) in `config.json`.
  For older ones it is recovered from git history (the recorded commit, else the newest commit whose full
  fixture hash matches `fixtureHash`), else from the prepared fixture cache of that version if every
  current template file is identical there, else only with `--assume-template-unchanged`. The method used
  goes to `audit.jsonl` with the written records. No model calls. The full fixture hash still guards the
  fixture cache and `--resume`.

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
| `results/runs/*.json` | one record per run (with `inputsKey`, `inputs` and, for a reused run, `reusedFrom`) |
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
