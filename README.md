# agent-config

Public, version-controlled source for portable coding-agent configuration shared by
Cursor, Claude Code, and Codex.

## What it provides

- A concise shared completion, verification, safety, and anti-slop policy that starts
  every task at the task router.
- Two always-installed packs: `routing.md` (tech, skill, and topic routing, then the
  coding/non-coding exit) and `orchestration.md` (how the Orchestrator spawns roles).
- One self-contained file per sub-agent role: Orchestrator, Planner, Coder, Reviewer, each
  with its model fallback list, inputs, handoff contract, what to load, and exit criteria.
- Conditional TypeScript, React, Vue + PrimeVue, and DDD domain-module policy packs shared by all harnesses.
- Portable skills for distinctive frontend design, high-fidelity Figma implementation,
  deterministic full-stack TypeScript quality tooling, and Matt Pocock's engineering
  and productivity workflows.
- A user installer that gives Cursor, Claude Code, and Codex the same personal policy
  without changing application repositories.
- An optional workspace installer that detects npm, pnpm, Yarn, or Bun; creates thin
  client bridges and portable skills; and seeds a project-owned verification routing map.

## Install for your user

Run once on each machine:

```sh
node bin/agent-config.mjs init --user
```

This creates or updates:

```text
~/.agents/AGENTS.md                        portable shared policy (byte copy of policy/shared-policy.md)
~/.codex/AGENTS.md                         Codex entrypoint (managed block wrapping the same policy)
~/.claude/CLAUDE.md                       Claude bridge to ~/.agents/AGENTS.md
~/.cursor/plugins/local/agent-config/     Cursor plugin with an always-on bridge rule
~/.agents/policy/routing.md               task router, read first for every task
~/.agents/policy/orchestration.md         sub-agent orchestration for coding tasks
~/.agents/policy/<tech-pack>.md           typescript, react, vue-primevue, domain-module
~/.agents/agents/<role>.md                orchestrator, planner, coder, reviewer
~/.agents/skills/<portable-skill>/
~/.claude/skills/<portable-skill>/
~/.agent-config/agent-config.lock.json
```

The user installer writes every `policy/*.md` pack except `policy/shared-policy.md`,
which becomes `~/.agents/AGENTS.md` (and the managed block in `~/.codex/AGENTS.md`)
instead of `~/.agents/policy/shared-policy.md`. `README.md`, `adapters/*/README.md`,
`docs/`, `cloud-agent-install.md`, and this repository's `AGENTS.md` stay in the
checkout: they are human docs or tooling-repo guidance, not portable agent policy.

The managed block in `~/.codex/AGENTS.md` carries only the shared policy; every pack, role,
and skill it points at is a real file under `~/.agents/`, so `~/.agents/...` references
resolve in every harness. Cursor's always-on rule and Claude's user `CLAUDE.md` both
point at `~/.agents/AGENTS.md`.

Existing Codex and Claude instructions outside the managed blocks are preserved.
Standalone generated files are updated only when the user lock proves ownership, and
the installer refuses to write through symlinked targets. Restart or reload Cursor after
the first installation so it discovers the local plugin.

```sh
node bin/agent-config.mjs sync --user
node bin/agent-config.mjs status --user
node bin/agent-config.mjs check --user
```

For persistent remote environments, use [cloud-agent-install.md](cloud-agent-install.md).

## Optional: install into a workspace

From this repository, run:

```sh
node bin/agent-config.mjs init --project ~/dev/my-webapp
```

The installer scans actual project source before creating conditional policy packs:

```text
.agents/policy/routing.md                  always
.agents/policy/orchestration.md            always
.agents/agents/<role>.md                   always
.agents/policy/typescript.md               only when TypeScript source exists
.agents/policy/react.md                    only when React source exists
.agents/policy/vue-primevue.md             only when Vue source exists
.agents/policy/domain-module.md            only when the four-file convention exists
```

It then creates or updates the shared files below:

```text
AGENTS.md                                  shared policy with the "Start here" routing step
CLAUDE.md                                  thin Claude Code bridge to AGENTS.md
.cursor/rules/00-agent-config.mdc          thin Cursor bridge to AGENTS.md
.agents/policy/routing.md                  task router, always
.agents/policy/orchestration.md            sub-agent orchestration, always
.agents/agents/<role>.md                   orchestrator, planner, coder, reviewer, always
.agents/policy/typescript.md               TypeScript work, when detected
.agents/policy/react.md                    React work, when detected
.agents/policy/domain-module.md            domain work, when the convention is detected
.agents/policy/vue-primevue.md             Vue work, when detected
.agents/skills/<portable-skill>/
.agents/agent-config.json                  project-owned command/routing map
.agents/agent-config.lock.json
.prettierignore                            managed ignore block for generated guidance
```

`AGENTS.md` and `CLAUDE.md` are updated only inside explicit managed blocks. If a
workspace already has unmanaged instructions, the installer preserves them and asks
for a manual merge instead of overwriting them. Conditional packs are installed only
when matching source code or the domain convention is detected, and the installer
refuses to modify managed targets reached through symlinks.

## Sync, inspect, and validate a workspace

```sh
node bin/agent-config.mjs sync --project ~/dev/my-webapp
node bin/agent-config.mjs status --project ~/dev/my-webapp
node bin/agent-config.mjs check --project ~/dev/my-webapp
```

Project agents read `.agents/agent-config.json` directly to identify the verification
commands relevant to their changed files. `check` validates this file's structure,
command references, managed content, and lock ownership metadata.

## Portable skills

The installer copies every `skills/<name>/` directory that contains a `SKILL.md`. That
includes this repository's frontend and quality skills, plus skills vendored under the
MIT License from [`mattpocock/skills`](https://github.com/mattpocock/skills) and
[`jakubkrehel/skills` at commit `267330e`](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e).
Each vendored skill keeps its original files and a `LICENSE.txt`; the pinned upstream
inventory and normalized-content hashes are recorded in `skills/jakubkrehel-skills.lock.json`.

Run `setup-matt-pocock-skills` once in a repository before using the engineering
workflow skills (issue tracker, triage labels, and domain-doc layout). `ask-matt` is the
human-invoked router over those skills; `policy/routing.md` carries the agent-side
task type → skill mapping so agents route without invoking it.

Jakub Krehel's seven model-invoked skills cover existing-interface work by discipline:
`better-interface` for cross-discipline audits, plus
`better-accessibility`, `better-colors`, `better-layout`, `better-typography`, `better-ui`,
and `better-writing` for focused work. The four named workflows are user-invoked only:
`break` stress-tests one component, `explain-interface` explains how a site or effect was
built, `interface-review` scopes a review to a branch, pull request, range, or working
tree, and `variant` builds alternatives behind a picker.

These skills improve or inspect an existing interface. `frontend-design` still owns
original visual direction and substantial redesign without a supplied source-of-truth
design; `figma-design-to-code` still owns faithful implementation of a supplied Figma
node.

## Routing and orchestration

Three layers, each a single source of truth, installed for every user and workspace:

- `policy/routing.md` — the task router, read first for every task. Tech (file type →
  pack), skill (task type → Pocock skill), topic (discipline → packs, skills, evidence),
  then the exit: coding task → orchestration; question or documentation-only edit →
  answer directly. This is the only place that rule is stated.
- `policy/orchestration.md` — sub-agent orchestration only. Points at the role files,
  states the spawn contract (a sub-agent reads its role file plus the Orchestrator's brief,
  which carries the routing result), and the handoff chain.
- `agents/<role>.md` — one self-contained file per role. `orchestrator.md` owns the
  workflow graph, the three loops (review → coder, review → planner, prototype fan-out),
  the spawn prompt template, and the win condition. `planner.md`, `coder.md`, and
  `reviewer.md` each carry mandate, ordered model fallbacks, inputs, output contract,
  what to load, and exit criteria.

### Routing chain per harness

Every harness reaches the same leaf. Each hop below is a file the installer writes
(`sync --user` for `~` paths, `init`/`sync --project` for repository paths):

```text
Cursor      ~/.cursor/plugins/local/agent-config/rules/00-agent-config.mdc  (alwaysApply)
            └─► ~/.agents/AGENTS.md
            + .cursor/rules/00-agent-config.mdc ─► AGENTS.md [shared-policy block]  (project install)
Codex       ~/.codex/AGENTS.md  [user-policy block; same body as ~/.agents/AGENTS.md]
            + AGENTS.md [shared-policy block]  (project install)
Claude Code ~/.claude/CLAUDE.md  (@-imports ~/.agents/AGENTS.md)
            + CLAUDE.md ─► AGENTS.md [shared-policy block]  (project install)

            all ─► "Start here" ─► ~/.agents/policy/routing.md
                                    ├─ non-coding ─► answer with routed packs and skills
                                    └─ coding ─► ~/.agents/policy/orchestration.md
                                                  └─► ~/.agents/agents/orchestrator.md
                                                        └─► spawns planner | coder | reviewer
                                                             each reads ~/.agents/agents/<role>.md
                                                             + ~/.agents/policy/<tech-pack>.md
                                                             + ~/.agents/skills/<name>/SKILL.md
```

Cursor Cloud Agents replace the plugin rule with the account User Rule from
[cloud-agent-install.md](cloud-agent-install.md); the rest of the chain is unchanged. A
project-scoped install mirrors the `~/.agents/` files under `.agents/`, and `check` in both
scopes fails when any hop is missing or stale.

## Frontend skill scopes

- `frontend-design` owns original visual direction and substantial redesigns. It grounds
  palette, typography, composition, and motion in the product while preserving an
  existing design system when one is in scope.
- `figma-design-to-code` owns faithful implementation of a supplied Figma node. It
  requires structured node context, repository component and token reuse, and rendered
  comparison with the Figma reference.

Use both only when a Figma design leaves a real implementation gap, such as responsive
reflow or an unspecified state. Defined Figma details remain the source of truth.

## Ownership model

- **User-owned:** personal instructions outside managed blocks and all client credentials,
  account state, MCP registration, and IDE preferences.
- **Source-owned:** policy packs, role files, client bridges, portable skills, and installer implementation.
  During migration, the CLI removes only legacy Cursor rule files proven owned by its prior
  lock file.
- **Project-owned:** the project architecture section in `AGENTS.md`,
  `.agents/agent-config.json`, package scripts, test configuration, and unmanaged portions
  of `.prettierignore` and client-local credentials/settings.
- **Client-specific:** OAuth, plugins, MCP registration, native hook registration,
  and IDE state.

## Development

```sh
npm run verify
```

This syntax-checks the scripts and executes the installer integration tests.

## License

[MIT](LICENSE)
