# agent-config

Private, version-controlled source for portable coding-agent configuration shared by
Cursor, Claude Code, and Codex.

## What it provides

- A concise shared completion, verification, safety, and anti-slop policy.
- Conditional TypeScript, Vue + PrimeVue, and DDD domain-module policy packs shared by all harnesses.
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
AGENTS.md                                  concise shared policy + conditional pack index
CLAUDE.md                                  thin Claude Code bridge to AGENTS.md
.cursor/rules/00-agent-config.mdc          thin Cursor bridge to AGENTS.md
.agents/policy/typescript.md               TypeScript work, when detected
.agents/policy/domain-module.md            domain work, when TypeScript is detected
.agents/policy/vue-primevue.md             Vue work, when detected
.agents/skills/fullstack-typescript-quality/SKILL.md
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

Project agents read `.agents/agent-config.json` directly to identify the verification
commands relevant to their changed files.

## Ownership model

- **Source-owned:** policy packs, Cursor bridge, portable skills, and runtime script. During
  migration, the CLI removes only legacy Cursor rule files proven owned by its prior lock file.
- **Project-owned:** the project architecture section in `AGENTS.md`,
  `.agents/agent-config.json`, package scripts, test configuration, and client-local
  credentials/settings.
- **Client-specific:** OAuth, plugins, MCP registration, native hook registration,
  and IDE state.

## Development

```sh
npm run verify
```

This syntax-checks the scripts and executes the installer integration tests.
