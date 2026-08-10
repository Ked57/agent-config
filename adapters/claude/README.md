# Claude Code adapter

Run `node scripts/render-config.mjs`, then merge `out/claude-mcp.json` into
your Claude Code MCP configuration. Keep OAuth tokens and credentials in
Claude Code's own local configuration/auth store.

Use the root `AGENTS.md` as shared instructions where your Claude Code setup
loads it; client-specific settings and hook event registration remain in
Claude Code's configuration.
