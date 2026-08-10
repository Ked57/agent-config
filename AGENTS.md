# Shared agent guidance

This repository is the source of truth for portable agent configuration shared by
Cursor, Codex, and Claude Code.

- Keep reusable skills in `.agents/skills/` and conform to the Agent Skills
  `SKILL.md` format.
- Keep MCP definitions in `mcp/servers.json`; never add credentials, access
  tokens, session files, or absolute user-home paths to it.
- Put executable shared hook logic in `hooks/`, then register it through the
  appropriate client adapter. Hook event configuration is client-specific.
- Treat `adapters/` as generated/translation infrastructure, not the canonical
  location for shared behavior.
- Before committing, run `node scripts/render-config.mjs --check` and ensure
  the repository contains no secrets.
