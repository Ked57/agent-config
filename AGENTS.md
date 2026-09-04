# Shared agent guidance

Start here: read `~/.agents/policy/routing.md` and route the task. This repository is Node.js
tooling (`bin/agent-config.mjs`, `tests/*.test.mjs`, `node --test`) on the agent-configuration
topic, so routing lands on `~/.agents/skills/writing-for-agents/SKILL.md` for every edit to
`policy/`, `agents/`, `skills/`, or an `AGENTS.md`. Changes to `bin/`, `tests/`, `policy/`,
`agents/`, or `skills/` are coding tasks: read `~/.agents/policy/orchestration.md` and run
them through its roles. Questions and explanations are answered directly.

This repository is the source of truth for portable configuration shared by Cursor,
Codex, and Claude Code.

- Keep portable policy in `policy/`, one file per sub-agent role in `agents/`, and
  reusable skills in `skills/`. Cursor bridge files must defer to the policy packs
  installed under `.agents/policy/`; do not duplicate policy in `.mdc` files.
- Keep each meaning in one place: `policy/routing.md` routes, `policy/orchestration.md`
  spawns, `agents/<role>.md` holds everything a spawned role needs.
- Refer to installed files by `~`-relative global paths (`~/.agents/AGENTS.md`,
  `~/.agents/policy/<pack>.md`, `~/.agents/agents/<role>.md`,
  `~/.agents/skills/<name>/SKILL.md`). This repository's `AGENTS.md` is tooling-repo
  guidance, not the user-scoped shared policy.
- Do not add credentials, access tokens, session files, or absolute user-home
  paths. MCP registration is intentionally managed separately in each client.
- Keep `adapters/` as client-specific registration documentation, not the
  canonical location for shared behaviour.
- `bin/agent-config.mjs` must preserve project-owned files and update only
  generated files or explicitly marked managed blocks.
- Before committing, run `npm run verify` and ensure the repository contains no
  secrets.
