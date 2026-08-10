# Codex adapter

Run `node scripts/render-config.mjs`, then merge `out/codex-mcp.toml` into
`~/.codex/config.toml`. The rendered file contains only MCP entries generated
from the canonical source.

Codex reads repository `AGENTS.md` guidance and the portable `.agents/skills/`
tree. Put trusted project-only settings, hooks, and MCP registration in the
project's `.codex/config.toml`; do not replace an existing global config.
