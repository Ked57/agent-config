# Claude Code adapter

Install the personal baseline:

```sh
node bin/agent-config.mjs init --user
```

The installer adds a managed block to `~/.claude/CLAUDE.md` that imports
`~/.agents/AGENTS.md`, whose "Start here" step routes through `~/.agents/policy/routing.md`.
Coding tasks are done with the routed packs and skills; after implementation, shared
policy requires `manual-qa` when a runnable surface changed. It also installs the
portable skills under `~/.claude/skills/`.
Repository instructions have higher priority than user memory.

Use project-scoped installation only when the team wants the guidance committed:

```sh
node bin/agent-config.mjs init --project /path/to/workspace
```

The project installer creates a thin `CLAUDE.md` bridge that points Claude Code to the
workspace-local `AGENTS.md`, whose managed block carries the same "Start here" step. The
routing pack, conditional policy packs, and skills are mirrored under `.agents/`
alongside quality routing. Commit these project files.

Claude-specific settings and native hook registrations remain in `.claude/`.
When adding a Claude hook, make it call the project-owned verification command from
`.agents/agent-config.json`; do not duplicate policy in the hook body.

## Skills

This installer does not write native Claude Code agent files. Procedures live in
`~/.agents/skills/<name>/SKILL.md`. Edit the corresponding source under `skills/`, then
run `node bin/agent-config.mjs sync --user --dry-run` to inspect the changes before
syncing. See [Claude Code subagents](https://code.claude.com/docs/en/sub-agents) if you
register a native Claude agent yourself.
