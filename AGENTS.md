# Shared agent guidance

Start here: read `~/.agents/policy/routing.md` and route the task. This repository is Node.js
tooling (`bin/agent-config.mjs`, `tests/*.test.mjs`, `node --test`) on the agent-configuration
topic. Changes to `bin/`, `tests/`, `policy/`, or `skills/` are coding tasks: do the work
with the routed packs and skills.

This repository is the source of truth for portable configuration shared by Cursor,
Codex, and Claude Code.

- Keep portable policy in `policy/` and reusable skills in `skills/`. Cursor bridge
  files must defer to the policy packs installed under `.agents/policy/`; do not
  duplicate policy in `.mdc` files.
- Keep each meaning in one place: `policy/routing.md` routes, `policy/shared-policy.md`
  states the completion contract (installed as `~/.agents/AGENTS.md`, not under
  `~/.agents/policy/`), and `skills/<name>/SKILL.md` holds each procedure.
- Refer to installed files by `~`-relative global paths (`~/.agents/AGENTS.md`,
  `~/.agents/policy/<pack>.md`, `~/.agents/skills/<name>/SKILL.md`). This
  repository's `AGENTS.md` is tooling-repo guidance, not the user-scoped shared policy.
- Installed agents discover self-invoking skills from `policy/routing.md` skill
  routing and each skill's description. Update both when adding a skill that should
  fire on its own.
- Skills decide when to start subagents; keep that procedure in the skill. Name the
  models a skill's subagents use as `{{models.<role>}}` placeholders: the installer fills
  them per harness from `models.json`, overridden by `~/.agent-config/models.json` for a
  user install.
- Do not add credentials, access tokens, session files, or absolute user-home
  paths. MCP registration is intentionally managed separately in each client.
- Keep `adapters/` as client-specific registration documentation, not the
  canonical location for shared behaviour.
- `bin/agent-config.mjs` must preserve project-owned files and update only
  generated files or explicitly marked managed blocks.
- After changing installable `policy/` or `skills/` sources, run
  `node bin/agent-config.mjs sync --user` so the local install matches the checkout.
- `evals/` is the A/B eval suite (`npm run eval`, see `evals/README.md`). It must only install
  arms into temporary homes and keep results outside the repository.
- Before committing, run `npm run verify` and ensure the repository contains no
  secrets.
