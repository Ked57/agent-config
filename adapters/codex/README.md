# Codex adapter

Install the personal baseline:

```sh
node bin/agent-config.mjs init --user
```

Codex discovers the managed policy block in `~/.codex/AGENTS.md` (or
`$CODEX_HOME/AGENTS.md` when configured) for every repository. The same body is also
installed as `~/.agents/AGENTS.md`. Its "Start here" step
sends the agent to `~/.agents/policy/routing.md`. Coding tasks are done with the routed
packs and skills; after implementation, shared policy requires `manual-qa` when a
runnable surface changed. All of these are installed by the same command. Repository
`AGENTS.md` files are discovered later and take precedence when they conflict.

Use project-scoped installation only when the team wants the guidance and quality
routing committed with the repository:

```sh
node bin/agent-config.mjs init --project /path/to/workspace
```

Codex then reads the generated repository `AGENTS.md`, whose managed block carries the
same "Start here" step; the routing pack, conditional policy packs, and portable skills
are mirrored under `.agents/` alongside the quality-routing file. Commit these project
files.

## Skills

This installer does not write native Codex agent files. Procedures live in
`~/.agents/skills/<name>/SKILL.md`. Edit the corresponding source under `skills/`, then
run `node bin/agent-config.mjs sync --user --dry-run` to inspect the changes before
syncing. See [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
if you register a native Codex agent yourself.
