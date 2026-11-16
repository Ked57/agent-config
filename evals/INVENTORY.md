# Component inventory

Everything `node bin/agent-config.mjs sync --user` installs, how each piece gets used, and whether
the Claude-Code-only eval suite can install and exercise it in an isolated home. Written for the
`feat/repo-evals` brief; see `evals/PROGRESS.md` for the decisions it feeds.

Verified on 2026-11-16 by running the checkout's `sync --user` (external plugins on) with
`env -i PATH LANG HOME=<scratch> CLAUDE_CONFIG_DIR=<scratch>/.claude DISABLE_TELEMETRY=1 DO_NOT_TRACK=1`
in a home under `/var/tmp`: exit 0 in 36 s, every plugin line `installed`, and an
`ls -la --time-style=full-iso` of live `~/.claude/plugins/*.json`, `~/.agents`, `~/.agents/skills`,
`~/.claude/skills` and `~/.cursor` was identical before and after. No model calls.

Usage legend: **R** = routed by a line in `policy/routing.md`; **D** = the model may pick it from its
skill `description`; **S** = slash command only (`disable-model-invocation: true`); **L** = loaded by
another component.

## 1. Policies (`policy/*.md` → `~/.agents/policy/<name>.md`)

| Component | For | Usage (routing line) | Harnesses | Isolated install | Exercisable |
|---|---|---|---|---|---|
| `shared-policy.md` → `~/.agents/AGENTS.md` | completion contract: tests, checks, manual QA, simplicity | loaded every session: Claude via `~/.claude/CLAUDE.md` `@<home>/.agents/AGENTS.md` import; Codex via a managed block in `~/.codex/AGENTS.md`; Cursor via the always-apply rule in `~/.cursor/plugins/local/agent-config/rules/00-agent-config.mdc` | all three | `sync --user`, offline | yes (whole-arm effect only) |
| `routing.md` | task router | first step of `~/.agents/AGENTS.md` ("Read `~/.agents/policy/routing.md` and follow it") | all three | `sync --user`, offline | yes, via what it routes |
| `typescript.md` | TS type safety, code design, tests | R: "TypeScript (`.ts`, `.tsx`, `.mts`, `.cts`, or Vue SFC scripts) → `~/.agents/policy/typescript.md`" | all three | offline | yes |
| `react.md` | React components and hooks | R: "React components/hooks (`.jsx`, `.tsx`, or React imports) → `~/.agents/policy/react.md`" | all three | offline | **no fixture**: neither fixture uses React |
| `vue-primevue.md` | Vue 3 SFC, forms, PrimeVue, a11y, tests | R: "Vue components/composables/forms → `~/.agents/policy/vue-primevue.md`; apply PrimeVue rules only when that dependency exists" | all three | offline | yes (`vue-primevue` fixture) |
| `domain-module.md` | `<domain>.model/interface/service/mock.ts` layout | R: "Established `<domain>.model\|interface\|service\|mock.ts` convention, or an explicit request for it → `~/.agents/policy/domain-module.md`" | all three | offline | only via the second trigger: neither fixture has the convention |

The Claude bridge imports an **absolute** path (`@/var/tmp/.../home/.agents/AGENTS.md`). A per-run
copy of a template home must rewrite it (as for `.claude/plugins/*.json`) or the run loads the
template home's file, which the isolation check would flag.

## 2. Repo skills (`skills/<name>/` → `~/.agents/skills/<name>/` and `~/.claude/skills/<name>/`)

| Skill | For | Usage (quote) | Isolated install | Exercisable / blockers |
|---|---|---|---|---|
| `agent-browser` (+ `LICENSE.txt`; pinned by `skills/agent-browser-skills.lock.json`, upstream `vercel-labs/agent-browser@72007a6`, not installed itself) | drive a browser from the CLI | R: "Browser automation → `agent-browser`"; L by `manual-qa`; D: "Use when the user needs to interact with websites … 'test this web app' … exploratory testing, dogfooding, QA". Frontmatter has `hidden: true`, yet Claude Code 2.1.311 still lists it | offline copy. Needs the `agent-browser` binary (`~/.local/bin/agent-browser`, on `PATH`) and a Chrome; the live `~/.agent-browser/browsers/chrome-157.0.8103.38` used read-only via `AGENT_BROWSER_ARGS` | yes on Vue; ts-backend has no browser surface |
| `manual-qa` | exercise the running surface and report pass/fail/blocked | R: "Implemented runnable UI, API, or CLI change → `manual-qa`"; D: "Use after implementing a change to a browser UI, native app, HTTP API, or CLI"; also demanded by shared-policy "Definition of done" item 4 | offline | yes. API QA needs only `bun`/`curl`; UI QA needs agent-browser + Chrome as above |
| `fullstack-typescript-quality` | orchestrate install/audit of quality tooling | R: "TypeScript quality-tooling work → `fullstack-typescript-quality`"; D: "Use when installing or auditing TypeScript web-app quality tooling." Also referenced by `vue-primevue.md` (missing `vue-tsc` gate) | offline | yes, but the gates it installs (sonarjs, quality-metrics, knip, Stryker, Cypress) are new devDependencies: **needs npm network at run time** |
| `fullstack-typescript-static` | ESLint complexity/Halstead/line limits/`no-explicit-any`, Knip | L by quality: "loads `fullstack-typescript-static`, `fullstack-typescript-tests`, and `fullstack-typescript-mutation`"; D: "Loaded by fullstack-typescript-quality for …" | offline | with the parent |
| `fullstack-typescript-tests` | Vitest, Cypress CT, coverage, CRAP | L (as above) | offline | with the parent; Cypress needs a binary download |
| `fullstack-typescript-mutation` | Stryker on pure TS | L (as above) | offline | with the parent |
| `codex-review` (+ `cursor-agent.md`, also written to `~/.cursor/agents/codex-review.md`) | read-only Codex review of the branch vs `origin/main` | R: "Codex review of the current branch against `origin/main` → `codex-review`. The parent delegates to the Cursor subagent `codex-review`, which runs Codex."; D: "Use when the user asks for a Codex review of the branch" | offline copy | **no**: Claude falls back to a general-purpose subagent that runs `codex`, which needs Codex auth (live `~/.codex` is off limits) and a git remote `origin/main`; the output is a review, not code |

## 3. External packs (`bin/external-plugins.mjs`)

| Pack | Claude Code | Codex | Cursor | Isolated install (Claude) | Network |
|---|---|---|---|---|---|
| `taste-skill` | plugin `taste-skill@taste-skill` (marketplace `Leonxlnx/taste-skill`); 1 skill `taste-skill:design-taste-frontend` (D) | plugin, `codex plugin add` | `npx skills add` then moved to `~/.cursor/skills/design-taste-frontend` | `claude plugin marketplace add Leonxlnx/taste-skill --scope user` + `claude plugin install taste-skill@taste-skill --scope user -y`: **works** | yes, git clone **over ssh** (see flags) |
| `emilkowalski-ui` | no plugin: `npx --yes skills@latest add emilkowalski/skills -g -a cursor -y --copy -s …` writes `~/.agents/skills/<8>`, then mirrored to `~/.claude/skills/<8>` | reads `~/.agents/skills` | same copy | **works** via `sync --user` (writes `~/.agents/.skill-lock.json`) | yes, npm + GitHub |
| `mattpocock-skills` | plugin `mattpocock-skills@mattpocock` (marketplace `mattpocock/skills`) | plugin | 27 skills via `npx skills add`, moved to `~/.cursor/skills` | `claude plugin marketplace add mattpocock/skills --scope user` + `claude plugin install mattpocock-skills@mattpocock --scope user -y`: **works** | yes, ssh clone |
| `pstack` | plugin `pstack@cursor-plugins` (marketplace `cursor/plugins`) | none ("pstack has no Codex adapter") | `git clone --depth 1 --sparse https://github.com/cursor/plugins.git` into `~/.agent-config/sources/cursor-plugins`, copied to `~/.cursor/plugins/local/pstack` | confirmed by the lead and again here | yes |

Skills each pack exposes to Claude Code, and how they fire:

| Pack | Skills (usage) |
|---|---|
| `taste-skill` | `design-taste-frontend` (D: "Use this whenever you build, design, redesign, restyle, polish or review a landing page … Also for app screens: dashboards, admin and analytics views, settings"; R: "Public page or app screen that needs a designed look → `design-taste-frontend`") |
| `emilkowalski-ui` | all D and R: `emil-design-eng` ("UI implementation or visual critique"), `break-ui` ("Worst-case data and layout breakage"), `animate` ("New motion"), `animation-performance` ("Dropped frames or which property to animate"), `animation-vocabulary` ("Naming a motion effect"), `find-animation-opportunities` ("Places that should move"), `improve-animations` ("Motion audit and a fix plan"), `review-animations` ("Review of animation code") |
| `mattpocock-skills` | D (no routing line): `diagnosing-bugs` ("Use when the user says 'diagnose'/'debug this', or reports something broken/throwing/failing/slow"), `tdd` ("Use when the user wants to build features or fix bugs test-first, mentions 'red-green-refactor'"), `prototype`, `research`, `domain-modeling`, `codebase-design`, `code-review`, `pr`, `wizard`, `grilling`, `writing-for-agents`. S: `ask-matt`, `grill-with-docs`, `triage`, `improve-codebase-architecture`, `setup-matt-pocock-skills`, `to-spec`, `to-tickets`, `wayfinder`, `implement`, `implement-spec`, `retro`, `grill-me`, `handoff`, `teach`, `to-questionnaire`, `wait-what` |
| `pstack` | 58 skills; **57 are S** (every `principle-*`, `poteto-mode`, `tdd`, `typescript-best-practices`, `unslop`, `no-comments`, `architect`, `swarm`, `sharpen`, …). Only `setup-pstack` is D. Agents: `pstack:poteto-agent`, `pstack:comment-sicko` |

`poteto-mode` (`description`: "poteto's agent style for concise, detailed responses, deliberate
subagents, unslopped prose, simple code, and verified work. Use for poteto, /poteto-mode, or requests
to work in this style.", `disable-model-invocation: true`) never fires on its own; the arm must send
`/pstack:poteto-mode` (or `/poteto-mode`) as a prompt prefix. It first reads
`../../docs/harness/claude-code.md` (maps Cursor names to Claude Code), and its delegate
`poteto-agent` needs the absolute `SKILL.md` path from the parent; without one it searches
`~/.cursor/plugins/`, which a Claude-only arm does have (sync writes `~/.cursor/plugins/local/pstack`),
but that copy is the Cursor sparse clone, not the Claude plugin cache.

## 4. Other files `sync --user` writes

| File | For | Claude-only eval relevance |
|---|---|---|
| `~/.claude/CLAUDE.md` (managed block `claude-user-bridge`) | `@<home>/.agents/AGENTS.md` import | the entry point for every policy; absolute path, see section 1 |
| `~/.codex/AGENTS.md` (block `user-policy`), honours `CODEX_HOME` | Codex baseline | unused by Claude runs; harmless |
| `~/.cursor/plugins/local/agent-config/.cursor-plugin/plugin.json`, `rules/00-agent-config.mdc` | Cursor bridge (always-apply rule) | unused, **cannot be exercised** |
| `~/.cursor/agents/codex-review.md` | Cursor subagent for `codex-review` | unused, **cannot be exercised** |
| `~/.agent-config/agent-config.lock.json` | sync ownership and hashes | none |
| `~/.agents/agents/*.md` via `bin/native-agents.mjs` | shared native agents from `agents/` | **writes nothing**: the repo has no `agents/` directory |
| `adapters/{claude,codex,cursor}/README.md` | human registration docs | **not installed** |
| Project-scope only (`sync` without `--user`): `AGENTS.md` block, `CLAUDE.md` bridge, `.cursor/rules/00-agent-config.mdc`, `.agents/{policy,skills}`, `.agents/agent-config.json`, `.prettierignore` | per-repo install | not used by the arms; the fixtures are never `sync`ed |
| `~/.codex/plugins/**`, `~/.codex/config.toml` (294 MB), `~/.cursor/skills/**` (49 MB), `~/.npm` (17 MB) | Codex and Cursor copies of the packs | dead weight in a Claude arm: about 360 MB of the 550 MB template home |

## 5. Flags: cannot install or exercise in isolation

1. **Marketplace clones go over git ssh.** Fresh `known_marketplaces.json` stores `"source": "github"`;
   the clones' `origin` is `git@github.com:…`. ssh resolves `~/.ssh` from the passwd entry, not
   `$HOME`, so isolated installs silently use the **live** `~/.ssh/id_ed25519_github` (read-only;
   `known_hosts` unchanged). On a machine without that key these installs need an https fallback.
2. **Versions are not pinned.** Fresh installs got `pstack` 0.15.42, `mattpocock-skills` 1.3.2,
   `taste-skill` 2.5.1; the live home has 0.15.32, 1.3.1, 2.1.5. Two arms built at different times
   can differ in plugin content. Build both arms in one go, or record the `gitCommitSha` from each
   arm's `installed_plugins.json` in the record.
3. **Cursor-only**: `.mdc` bridges, `~/.cursor/agents/codex-review.md`, the Cursor-local pstack copy,
   Cursor skill copies of taste/matt. Nothing in a Claude run reads them.
4. **`codex-review`**: delegates to a Cursor subagent that runs Codex. `codex` is installed
   (`~/.local/bin/codex`) and `codex plugin add` works in a scratch home without auth, but a review
   run needs Codex credentials (not allowed: live `~/.codex`) and produces no code to test.
5. **Codex plugin installs** run during every non-skip `sync --user` (they need `codex` on `PATH`;
   it is). Not exercised by the suite.
6. **Browser skills** (`agent-browser`, UI `manual-qa`) need the `agent-browser` binary and the live
   Chrome under `~/.agent-browser/browsers` (read-only). The suite already sets `AGENT_BROWSER_ARGS`.
7. **`fullstack-typescript-*`** installs new devDependencies, so a run needs npm network and adds
   deps the dependency diff will flag (expected for that task, not a failure).
8. **pstack** is slash-only: measurable only with a `/pstack:poteto-mode` prompt prefix (Comparison 2).
   The other 56 S-skills fire only when `poteto-mode` tells the agent to read them.
9. **Routing lines without a Claude owner**: none dangling. `design-taste-frontend` resolves as
   `taste-skill:design-taste-frontend` (the line says so). The emil names resolve through
   `~/.agents/skills/<name>/SKILL.md`. mattpocock and pstack have **no** routing lines at all.
10. **Live-only skills**: `vault-run` and `step-ssh` are the user's own skills (live
    `~/.claude/skills/`, plus claude.ai-synced `~/.claude/skills/synced/`), not from this repo. No arm
    may contain them; the per-run isolation check must fail if one appears.
11. **`policy/react.md`** has no fixture; **`domain-module.md`** has no fixture with the convention.

## 6. Component → eval coverage

"Observable effect" is what a hidden test or deterministic check could see if the component works.
Task sets: `ts-backend` (B1–B11, N1–N2), `ts-backend-hard` (H1–H8, agent E), `poteto-spec` (S1–S6,
agent G), `vue-primevue` (L/C/F/N, agent D), `components-*` (K1–K…, agent F, this brief).

| Component | Task shape where it should change the outcome | Covered by |
|---|---|---|
| `shared-policy.md` | any coding task: tests added, gates run, QA done | all sets, as whole-arm effect (Comparison 1) |
| `routing.md` | any task: right owners read | all sets via routing telemetry; no outcome of its own |
| `typescript.md` | lazy solution uses `any`, `as`, `!`, an unchecked index, non-exhaustive switch, or unvalidated input; a stricter lint/type check sees it | partly B1–B11 (gates only, which already forbid `any`); **components-backend K1–K3** for the specific rules |
| `react.md` | React component work | **gap**: no React fixture |
| `vue-primevue.md` | PrimeVue reuse, a11y names, form validation, states | `vue-primevue` L/C/F (agent D); **components-vue** for rules agent D does not cover |
| `domain-module.md` | "add a domain following the convention" / explicit request; files with the right exports | **components-backend K4** (explicit request) |
| `manual-qa` | a defect that unit tests and typecheck miss but a real request shows | `--http` smoke is fixture-level, not per task; **components-backend K5** |
| `agent-browser` | UI defect visible only in the rendered app | via `manual-qa` on `vue-primevue` (telemetry only); outcome **gap** unless agent D's tests catch a render-only defect |
| `fullstack-typescript-quality` (+3) | "set up quality tooling": gates exist and run with the skill's thresholds | **components-backend K6** |
| `codex-review` | review output | **gap**: Cursor + Codex auth, no code outcome |
| `taste-skill` | page looks designed | **gap**: visual; needs a screenshot rubric or judge |
| `emilkowalski-ui` (8) | motion, polish, worst-case data | **gap** for 7 (visual/advisory); `break-ui` could be tested with a long-data render test, not planned. C3/C4 touch motion but test behaviour only |
| `mattpocock-skills:diagnosing-bugs`, `tdd` | bug with a non-obvious root cause; symptom patch fails a hidden regression test | **components-backend K7** (diagnosis); `tdd` only via "tests added" (telemetry, judge) |
| other mattpocock D-skills (`research`, `pr`, `wizard`, `grilling`, …) | non-coding outputs | **gap**: no code outcome |
| `pstack` / `poteto-mode` | spec-sized feature: fewer misses on stated requirements, simpler diff | `poteto-spec` S1–S6 (agent G), Comparison 2 with a prompt prefix |
| `pstack:poteto-agent`, `comment-sicko` | only inside poteto-mode | with `poteto-spec`, telemetry only |
| Cursor bridges, Codex block, native agents, adapters | n/a | **cannot be exercised** by a Claude-only suite |
