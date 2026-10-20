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
- Portable skills for deterministic full-stack TypeScript quality tooling, hands-on
  verification, and browser automation.
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
obsolete skill files, leftover role files, dropped policy packs, and native wrappers only when the prior ownership lock
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
.claude/skills/<portable-skill>/             managed native Claude registrations
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

Generated routing covers module extensions (`.mts` and `.cts` included), test files,
tooling and configuration through a baseline route, and adds framework-specific checks.
The baseline requires the existing `verify:full` gate when present, otherwise the build
when available, alongside fast checks. Root source and package-local React dependencies
are detected. An existing routing map remains project-owned: update it deliberately
when `check` reports source/configuration files without required verification.

`check` verifies direct `npm|pnpm|yarn|bun run <script>` references against the root
package scripts and reports other task-runner commands as unverified. It does not execute
those commands. Routing globs support `**`, `*` and `?`; `**/*` also matches root files.
Execute the required gates separately before declaring a product change complete.

Project locks now record per-file hashes. Sync removes obsolete `.agents/skills/` and
`.claude/skills/` files only when their prior installed hashes still match, preserving
local edits and unrelated files. Version 1 project locks migrate without deleting
unhashed obsolete output; a fresh hash-bearing installation is needed to prove later
cleanup safe. Preserved obsolete files become unmanaged after synchronization.

## Leftover native agents

This repository does not ship shared roles or native harness wrappers. `sync --user`
removes leftover `~/.agents/agents/<role>.md` files and previously installed wrappers
under `~/.codex/agents/`, `~/.claude/agents/`, and `~/.cursor/agents/` when the lock
still owns them and the files are unchanged. Locally modified leftovers stay in place.

Hands-on verification lives in `skills/manual-qa/`. Client discovery details are
documented in the [Codex](adapters/codex/README.md),
[Claude Code](adapters/claude/README.md), and [Cursor](adapters/cursor/README.md) adapters.

## Portable skills

The installer copies every `skills/<name>/` directory that contains a `SKILL.md`:

- `fullstack-typescript-quality`, which loads `fullstack-typescript-static`,
  `fullstack-typescript-tests`, and `fullstack-typescript-mutation`
- `manual-qa`
- `agent-browser`, the Apache-2.0 discovery stub from
  [`vercel-labs/agent-browser` at commit `72007a6`](https://github.com/vercel-labs/agent-browser/tree/72007a6788d863611b23bed0b59d0d659c638d8e)

The vendored `agent-browser` skill keeps its original files and a `LICENSE.txt`. The
pinned upstream inventory and normalized-content hashes are recorded in
`skills/agent-browser-skills.lock.json`.

`agent-browser` is a discovery stub. Usage instructions stay in the CLI
(`agent-browser skills get core`) so they match the installed binary. `manual-qa` loads
that stub for browser UI. `policy/routing.md` carries the task type → skill mapping.

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
