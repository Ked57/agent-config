# Codex adapter

Install portable, project-scoped guidance first:

```sh
node bin/agent-config.mjs init --project /path/to/workspace
```

Codex reads the generated repository `AGENTS.md`, which indexes the shared conditional
policy packs under `.agents/policy/`. The workspace also receives portable skills and
quality-routing files. Commit these project files.
