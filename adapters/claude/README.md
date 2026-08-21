# Claude Code adapter

Install portable, project-scoped guidance first:

```sh
node bin/agent-config.mjs init --project /path/to/workspace
```

The installer creates a thin `CLAUDE.md` bridge that points Claude Code to the
workspace-local `AGENTS.md`, along with `.agents/` skills and quality routing.
Commit these project files.

Claude-specific settings and native hook registrations remain in `.claude/`.
When adding a Claude hook, make it call the project-owned verification command or
`.agents/scripts/agent-check.mjs`; do not duplicate policy in the hook body.
