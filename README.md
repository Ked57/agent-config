# agent-config

Public, version-controlled source for portable coding-agent configuration shared by
Cursor, Claude Code, and Codex.

## What it provides

- A concise shared completion, verification, safety, and anti-slop policy that starts
  every task at the task router.
- One always-installed pack: `routing.md` (tech, skill, and topic routing, then the
  coding/non-coding exit). After implementation, shared policy requires the `manual-qa`
  skill when a runnable UI, API, or CLI surface changed.
- Conditional TypeScript, React, Vue + PrimeVue, and DDD domain-module policy packs shared across Cursor, Claude Code, and Codex.
- Portable skills for distinctive frontend design, high-fidelity Figma implementation,
  complexity audits, deterministic full-stack TypeScript quality tooling, hands-on
  verification, and Matt Pocock's engineering and productivity workflows.
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
~/.agents/policy/<tech-pack>.md           typescript, react, vue-primevue, domain-module
~/.agents/skills/<portable-skill>/         includes manual-qa
~/.claude/skills/<portable-skill>/
~/.agent-config/agent-config.lock.json
```

The user installer writes every `policy/*.md` pack except `policy/shared-policy.md`,
which becomes `~/.agents/AGENTS.md` (and the managed block in `~/.codex/AGENTS.md`)
instead of `~/.agents/policy/shared-policy.md`. `README.md`, `adapters/*/README.md`,
`docs/`, `cloud-agent-install.md`, and this repository's `AGENTS.md` stay in the
checkout: they are human docs or tooling-repo guidance, not portable agent policy.

The managed block in `~/.codex/AGENTS.md` carries only the shared policy; every pack
and skill it points at is a real file under `~/.agents/`, so `~/.agents/...` references
resolve in every harness. Cursor's always-on rule and Claude's user `CLAUDE.md` both
point at `~/.agents/AGENTS.md`.

Existing Codex and Claude instructions outside the managed blocks are preserved.
Standalone generated files are updated only when the user lock proves ownership, and
the installer refuses to write through symlinked targets. Restart or reload Cursor after
the first installation so it discovers the local plugin.

```sh
node bin/agent-config.mjs sync --user
node bin/agent-config.mjs sync --user --dry-run
node bin/agent-config.mjs status --user
node bin/agent-config.mjs check --user
```

The dry run previews file diffs and action counts without changing the installation.
`check --user` detects missing, modified, and obsolete managed files. Sync removes
obsolete leftover role files, dropped policy packs, and native wrappers only when the prior ownership lock
and content hash prove they are unchanged installer output; locally modified obsolete
files are preserved.
Preserved obsolete files become unmanaged after sync. Legacy locks without content
hashes never authorize deletion. Changing `CODEX_HOME` installs into the new root;
files in the previous root remain in place, and conflicting files in the new root
are preserved.

Sync validates sources, destination paths, and ownership conflicts before writing.
This prevents partial changes from validation failures; filesystem failures during
writing are not a transaction across all files.

For persistent remote environments, use [cloud-agent-install.md](cloud-agent-install.md).

## Optional: install into a workspace

From this repository, run:

```sh
node bin/agent-config.mjs init --project ~/dev/my-webapp
```

The installer scans actual project source before creating conditional policy packs:

```text
.agents/policy/routing.md                  always
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

Project sessions read `.agents/agent-config.json` directly to identify the verification
commands relevant to their changed files. `check` validates this file's structure,
command references, managed content, and lock ownership metadata.

## Leftover native agents

This repository does not ship shared roles or native harness wrappers. `sync --user`
removes leftover `~/.agents/agents/<role>.md` files and previously installed wrappers
under `~/.codex/agents/`, `~/.claude/agents/`, and `~/.cursor/agents/` when the lock
still owns them and the files are unchanged. Locally modified leftovers stay in place.

Hands-on verification lives in `skills/manual-qa/`. Client discovery details are
documented in the [Codex](adapters/codex/README.md),
[Claude Code](adapters/claude/README.md), and [Cursor](adapters/cursor/README.md) adapters.

## Portable skills

The installer copies every `skills/<name>/` directory that contains a `SKILL.md`. That
includes this repository's frontend, quality, and manual-qa skills, plus skills vendored under the
MIT License from [`mattpocock/skills`](https://github.com/mattpocock/skills),
[`jakubkrehel/skills` at commit `267330e`](https://github.com/jakubkrehel/skills/tree/267330e1adfc66a718fb65fa6918c1f06d0a689e),
and [`emilkowalski/skills` at commit `d23d7f8`](https://github.com/emilkowalski/skills/tree/d23d7f88a2e21c9e4b1418c7abe420f5c1052ba7),
and the Apache-2.0 discovery stub from
[`vercel-labs/agent-browser` at commit `72007a6`](https://github.com/vercel-labs/agent-browser/tree/72007a6788d863611b23bed0b59d0d659c638d8e).
Each vendored skill keeps its original files and a `LICENSE.txt`; the pinned upstream
inventory and normalized-content hashes are recorded in
`skills/jakubkrehel-skills.lock.json`, `skills/emilkowalski-skills.lock.json`, and
`skills/agent-browser-skills.lock.json`.

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

Emil Kowalski's model-invoked skills cover motion and design-engineering craft:
`emil-design-eng` for animation taste and the details that make UI feel right,
`animate` and `animate-expo` for building web or React Native motion,
`find-animation-opportunities` for hunting places that should move,
`improve-animations` for auditing existing motion, `animation-vocabulary` for naming
effects, `apple-design` for Apple-style fluid interfaces, `ask-sonner` for Sonner, and
`write-swift` for Swift. The three named workflows are user-invoked only:
`review-animations` reviews motion against a strict bar, `pick-ui-library` picks from a
curated library list, and `design-prototype` (Emil's `prototype`, renamed to sit beside
Matt Pocock's `prototype`) builds picker-based UI variants. Jakub Krehel's `variant`
remains the interface-review picker workflow.

`agent-browser` is the installed discovery stub for the agent-browser CLI. Usage
instructions stay in the CLI (`agent-browser skills get core`) so they match the
installed binary. `manual-qa` loads that stub for browser UI.

## Routing and skills

Two layers, each a single source of truth, installed for every user and workspace:

- `policy/routing.md` — the task router, read first for every task. Tech (file type →
  pack), skill (task type → skill), topic (discipline → packs, skills, evidence),
  then the exit: coding task → do the work with the routed packs and skills; question
  or documentation-only edit → answer directly. This is the only place that exit is
  stated.
- `policy/shared-policy.md` — the completion contract. After implementation, when a
  runnable UI, API, or CLI surface changed, read and run `manual-qa`.

The `manual-qa` procedure lives only in `skills/manual-qa/SKILL.md`.

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
                                    └─ coding ─► do the work with routed packs and skills
                                                 after implementation, when a runnable
                                                 surface changed ─► ~/.agents/skills/manual-qa/SKILL.md
```

Cursor Cloud Agents replace the plugin rule with the account User Rule from
[cloud-agent-install.md](cloud-agent-install.md); the rest of the chain is unchanged. A
project-scoped install mirrors the `~/.agents/` files under `.agents/`, and `check` in both
scopes fails when any hop is missing or stale.

## Frontend skill scopes

- `frontend-design` owns original visual direction and substantial redesigns. It grounds
  palette, typography, composition, and motion in the product while preserving an
  existing design system when one is in scope. Stack exemplars live in its `EXAMPLES.md`.
  Building the motion itself routes to `animate` or `animate-expo`.
- `figma-design-to-code` owns faithful implementation of a supplied Figma node or other
  exact visual spec. It requires structured target context, repository component and
  token reuse, and rendered comparison with the spec.
- `complexity-audit` owns measuring and reducing cyclomatic complexity. Metrics come
  from a tool; extracts must stay behaviour-preserving and pass the deletion test.

Always-on routing for these skills lives in `policy/routing.md`. Conditional packs add
stack-specific pointers (`shadcn` in the React pack, PrimeVue composition in the Vue pack,
`complexity-audit` in the TypeScript pack).

Use `frontend-design` and `figma-design-to-code` together only when a spec leaves a real
implementation gap, such as responsive reflow or an unspecified state. Defined spec
details remain the source of truth.

## Ownership model

- **User-owned:** personal instructions outside managed blocks and all client credentials,
  account state, MCP registration, and IDE preferences.
- **Source-owned:** policy packs, client bridges, portable
  skills, and installer implementation.
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
