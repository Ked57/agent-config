# agent-config

Private, version-controlled source for portable coding-agent configuration shared by
Cursor, Claude Code, and Codex.

## What it provides

- A concise shared completion, verification, safety, and anti-slop policy.
- Scoped TypeScript, Vue + PrimeVue, and DDD domain-module rules.
- The `fullstack-typescript-quality` skill for installing and auditing deterministic
  quality tooling.
- A workspace installer that creates thin Cursor/Claude bridges, portable skills,
  and a project-owned verification routing map.

## Install into a workspace

From this repository, run:

```sh
node bin/agent-config.mjs init --project ~/dev/my-webapp
```

The installer detects TypeScript and Vue, then creates or updates:

```text
AGENTS.md                                  shared policy managed block
CLAUDE.md                                  thin Claude Code bridge
.cursor/rules/00-agent-config.mdc          thin Cursor bridge
.cursor/rules/10-agent-config-typescript.mdc
.cursor/rules/20-agent-config-domain-module.mdc
.cursor/rules/30-agent-config-vue-primevue.mdc  Vue workspaces only
.agents/skills/fullstack-typescript-quality/SKILL.md
.agents/scripts/agent-check.mjs
.agents/agent-config.json                  project-owned command/routing map
.agents/agent-config.lock.json
```

`AGENTS.md` and `CLAUDE.md` are updated only inside explicit managed blocks. If a
workspace already has unmanaged instructions, the installer preserves them and asks
for a manual merge instead of overwriting them.

## Sync, inspect, and validate

```sh
node bin/agent-config.mjs sync --project ~/dev/my-webapp
node bin/agent-config.mjs status --project ~/dev/my-webapp
node bin/agent-config.mjs check --project ~/dev/my-webapp
```

Use the installed verification router to see the checks applicable to a change:

```sh
node .agents/scripts/agent-check.mjs --files src/domain/project.service.ts
```

The router reports commands from `.agents/agent-config.json`; it does not execute
them automatically.

## Ownership model

- **Source-owned:** policy, Cursor bridge/rules, portable skills, and runtime script.
- **Project-owned:** the project architecture section in `AGENTS.md`,
  `.agents/agent-config.json`, package scripts, test configuration, and client-local
  credentials/settings.
- **Client-specific:** OAuth, plugins, MCP registration, native hook registration,
  and IDE state.

## Development

```sh
npm run verify
```

This syntax-checks the scripts, renders and validates MCP fragments, and executes
the installer integration tests.
