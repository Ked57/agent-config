# Codex adapter

Install the personal baseline:

```sh
node bin/agent-config.mjs init --user
```

Codex discovers the managed policy block in `~/.codex/AGENTS.md` (or
`$CODEX_HOME/AGENTS.md` when configured) for every repository. The same body is also
installed as `~/.agents/AGENTS.md`. Its "Start here" step
sends the agent to `~/.agents/policy/routing.md`, then to
`~/.agents/policy/orchestration.md` and `~/.agents/agents/<role>.md` for coding tasks;
all of these are installed by the same command. Repository `AGENTS.md` files are
discovered later and take precedence when they conflict.

Use project-scoped installation only when the team wants the guidance and quality
routing committed with the repository:

```sh
node bin/agent-config.mjs init --project /path/to/workspace
```

Codex then reads the generated repository `AGENTS.md`, whose managed block carries the
same "Start here" step; the routing and orchestration packs, role files, conditional
policy packs, and portable skills are mirrored under `.agents/` alongside the
quality-routing file. Commit these project files.

## Native agents

Native agents are installed in `$CODEX_HOME/agents/` (default `~/.codex/agents/`).
Their standalone TOML files set the model, reasoning effort, and explicit instruction
to read `~/.agents/agents/<role>.md`. Codex discovers them without an additional
registration table in `config.toml`. Start a new session after syncing. See [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents).

Edit the corresponding source under `harnesses/codex/agents/`, then run
`node bin/agent-config.mjs sync --user --dry-run` to inspect the changes before syncing.
Model availability depends on the installed harness version and account.
