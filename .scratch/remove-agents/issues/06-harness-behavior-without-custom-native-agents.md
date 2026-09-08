Type: research
Status: claimed

# Harness behavior without custom native agents

## Question

From official Cursor, Claude Code, and Codex documentation (not secondary write-ups), what happens if this app stops installing custom native agents?

Need facts, not a recommendation:

- How each harness discovers custom agents vs skills.
- Whether the main session can still spawn a generic subagent (Task / Agent tool / Codex spawn) when `~/.cursor/agents`, `~/.claude/agents`, and `$CODEX_HOME/agents` have no installer-owned files.
- Whether any harness requires a named native agent file in order to delegate, pick a model, or isolate context.
- What "skill" means in each harness compared to this repo's `SKILL.md` packages, and how skills are discovered (description / model-invocation vs user-invoked).
- Any documented context-load or bloat guidance that treats custom agents as always-discovered.

Write findings as Markdown under `.scratch/remove-agents/research/harness-behavior-without-custom-native-agents.md`, citing each claim's primary source.
