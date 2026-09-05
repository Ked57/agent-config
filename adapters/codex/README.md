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

## Native agents

Native agents are installed in `$CODEX_HOME/agents/` (default `~/.codex/agents/`).
Their standalone TOML files set the model, reasoning effort, and explicit instruction
to read `~/.agents/agents/<role>.md`. Codex discovers them without an additional
registration table in `config.toml`. Start a new session after syncing. See [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

Edit the corresponding source under `harnesses/codex/agents/`, then run
`node bin/agent-config.mjs sync --user --dry-run` to inspect the changes before syncing.
Model availability depends on the installed harness version and account.
