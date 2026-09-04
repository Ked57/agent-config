# Claude Code adapter

Install the personal baseline:

```sh
node bin/agent-config.mjs init --user
```

The installer adds a managed block to `~/.claude/CLAUDE.md` that imports
`~/.agents/AGENTS.md`, whose "Start here" step routes through `~/.agents/policy/routing.md`,
then `~/.agents/policy/orchestration.md` and `~/.agents/agents/<role>.md` for coding
tasks. It also installs the portable skills under `~/.claude/skills/`.
Repository instructions have higher priority than user memory.

Use project-scoped installation only when the team wants the guidance committed:

```sh
node bin/agent-config.mjs init --project /path/to/workspace
```

The project installer creates a thin `CLAUDE.md` bridge that points Claude Code to the
workspace-local `AGENTS.md`, whose managed block carries the same "Start here" step. The
routing and orchestration packs, role files, conditional policy packs, and skills are
mirrored under `.agents/` alongside quality routing. Commit these project files.

Claude-specific settings and native hook registrations remain in `.claude/`.
When adding a Claude hook, make it call the project-owned verification command from
`.agents/agent-config.json`; do not duplicate policy in the hook body.
