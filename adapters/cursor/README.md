# Cursor adapter

Install portable, project-scoped guidance first:

```sh
node bin/agent-config.mjs init --project /path/to/workspace
```

This creates `.cursor/rules/00-agent-config.mdc` plus scoped TypeScript, domain,
and—when Vue is detected—Vue + PrimeVue rules. These are repository files and are
intended to be committed.

Keep Cursor global rules minimal: respect repository `AGENTS.md` and communicate in
the requested language. Retire duplicate global TypeScript, Vue, testing, and
completion rules after a workspace has been migrated.
