# Claude Code adapter

Install the personal baseline:

```sh
node bin/agent-config.mjs init --user
```

The installer adds a managed block to `~/.claude/CLAUDE.md` that imports the canonical
Codex user policy. It also installs the portable skills under `~/.claude/skills/`.
Repository instructions have higher priority than user memory.

Use project-scoped installation only when the team wants the guidance committed:

```sh
node bin/agent-config.mjs init --project /path/to/workspace
```

The project installer creates a thin `CLAUDE.md` bridge that points Claude Code to the
workspace-local `AGENTS.md`. `AGENTS.md` indexes the shared conditional policy packs
under `.agents/policy/`, alongside skills and quality routing. Commit these project files.

Claude-specific settings and native hook registrations remain in `.claude/`.
When adding a Claude hook, make it call the project-owned verification command from
`.agents/agent-config.json`; do not duplicate policy in the hook body.

## Native agents

Native agents are installed in `~/.claude/agents/`. Markdown frontmatter sets the
model alias and effort; the body explicitly loads `~/.agents/agents/<role>.md`.
Use `/agents` to inspect discovery after installing or reloading the session. See
[Claude Code subagents](https://code.claude.com/docs/en/sub-agents).

Edit the corresponding source under `harnesses/claude/agents/`, then run
`node bin/agent-config.mjs sync --user --dry-run` to inspect the changes before syncing.
Model availability depends on the installed harness version and account.

Claude subagents cannot spawn further subagents. Run the orchestrator in the main
session (`claude --agent orchestrator`), or let the normal main session assume the
orchestrator role through task routing. Delegate planner, coder, and reviewer from
that main session.
