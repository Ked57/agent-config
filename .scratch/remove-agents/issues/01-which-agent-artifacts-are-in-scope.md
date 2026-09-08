Type: grilling
Status: resolved

# Which agent artifacts are in scope

## Question

Does "remove agents" cover every artifact this app uses to mean an agent, or a subset?

Today that stack is four layers:

1. **Roles** — `agents/planner.md`, `agents/designer.md`, `agents/coder.md`, `agents/manual-qa.md`, `agents/reviewer.md`, installed to `~/.agents/agents/` (user) and `.agents/agents/` (project).
2. **Native agents** — `harnesses/{cursor,claude,codex}/agents/` with model and effort, installed only on user sync to `~/.cursor/agents`, `~/.claude/agents`, `$CODEX_HOME/agents`. Project install already skips these.
3. **Orchestration** — `policy/orchestration.md` tells the main session to spawn those roles; `policy/routing.md` and `policy/shared-policy.md` send coding work there.
4. **Installer coupling** — `bin/native-agents.mjs` requires shared roles to exist and to match native files one-for-one.

Recommended: all four. Native agents exist only to wrap roles; leaving roles in place keeps the bloat. Skills stay as they are either way — this ticket is about what gets deleted, not what skills absorb.

## Answer

All four: roles, native agents, orchestration, and installer coupling. Skills stay unchanged.
