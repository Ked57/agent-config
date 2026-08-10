# Cursor adapter

Run `node scripts/render-config.mjs`, then merge `out/cursor-mcp.json` into
`~/.cursor/mcp.json`. Do not overwrite that file blindly: it may contain
machine-local or authenticated servers.

For repository-scoped sharing, symlink or copy `.agents/skills/` into the
project and add Cursor-only scoped rules in `.cursor/rules/` when needed.
