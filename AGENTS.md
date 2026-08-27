# Shared agent guidance

This repository is the source of truth for portable configuration shared by Cursor,
Codex, and Claude Code.

- Keep portable policy in `policy/` and reusable skills in `skills/`. Cursor bridge
  files must defer to the policy packs installed under `.agents/policy/`; do not
  duplicate policy in `.mdc` files.
- Installed agents discover self-invoking skills from `policy/shared-policy.md` skill
  routing and each skill's description. Update both when adding a skill that should
  fire on its own.
- Do not add credentials, access tokens, session files, or absolute user-home
  paths. MCP registration is intentionally managed separately in each client.
- Keep `adapters/` as client-specific registration documentation, not the
  canonical location for shared behaviour.
- `bin/agent-config.mjs` must preserve project-owned files and update only
  generated files or explicitly marked managed blocks.
- Before committing, run `npm run verify` and ensure the repository contains no
  secrets.
