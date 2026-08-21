# Cursor adapter

Install portable, project-scoped guidance first:

```sh
node bin/agent-config.mjs init --project /path/to/workspace
```

This creates `.cursor/rules/00-agent-config.mdc`, a thin bridge to the workspace
`AGENTS.md`. The shared TypeScript, React, domain, and Vue/PrimeVue conditional policy packs
live under `.agents/policy/`, so Codex, Claude Code, and Cursor follow the same source
of truth. These repository files are intended to be committed.

Keep Cursor global rules minimal: respect repository `AGENTS.md` and communicate in
the requested language. Retire duplicate global TypeScript, Vue, testing, and
completion rules after a workspace has been migrated.
