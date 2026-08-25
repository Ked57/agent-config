# Codex adapter

Install the personal baseline:

```sh
node bin/agent-config.mjs init --user
```

Codex discovers the managed policy block in `~/.codex/AGENTS.md` (or
`$CODEX_HOME/AGENTS.md` when configured) for every repository. Repository `AGENTS.md`
files are discovered later and take precedence when they conflict.

Use project-scoped installation only when the team wants the guidance and quality
routing committed with the repository:

```sh
node bin/agent-config.mjs init --project /path/to/workspace
```

Codex then reads the generated repository `AGENTS.md`, which indexes the shared conditional
policy packs under `.agents/policy/`. The workspace also receives portable skills and
quality-routing files. Commit these project files.
