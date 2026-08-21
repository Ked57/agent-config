# Claude Code adapter

Install portable, project-scoped guidance first:

```sh
node bin/agent-config.mjs init --project /path/to/workspace
```

The installer creates a thin `CLAUDE.md` bridge that points Claude Code to the
workspace-local `AGENTS.md`. `AGENTS.md` indexes the shared conditional policy packs
under `.agents/policy/`, alongside skills and quality routing. Commit these project files.

Claude-specific settings and native hook registrations remain in `.claude/`.
When adding a Claude hook, make it call the project-owned verification command from
`.agents/agent-config.json`; do not duplicate policy in the hook body.
