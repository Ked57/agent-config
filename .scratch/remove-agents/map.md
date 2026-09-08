Label: wayfinder:map

# Remove agents; keep skills

## Destination

A spec that removes agent roles from this distribution and folds their procedures into skills, with every remaining product decision locked so implementation can start.

## Notes

Domain: this repository's portable agent-configuration (policy, skills, installer, adapters). Consult `writing-for-agents`, `grilling`, and `domain-modeling` every session. Planning only: produce decisions, not the deletion.

Working language for this effort (not yet a glossary): **role** means a shared procedure file under `agents/<role>.md`; **native agent** means a harness config under `harnesses/{cursor,claude,codex}/agents/` installed to `~/.cursor/agents`, `~/.claude/agents`, or `$CODEX_HOME/agents`; **skill** means a `skills/<name>/SKILL.md` package; **orchestration** means `policy/orchestration.md`, the coding-task spawn graph. Avoid calling all of these "agents."

Project install already skips native agents ("policy-and-skills only") but still copies roles into `.agents/agents/`. User install still writes both roles and native agents. The user's "too" is read against that split.

No `docs/agents/issue-tracker.md` exists; this map uses the local-markdown tracker under `.scratch/remove-agents/`.

## Decisions so far

<!-- the index: one line per closed ticket, enough to judge relevance, then zoom the link for the detail the ticket holds -->

## Not yet specified

- How `policy/routing.md` and `policy/orchestration.md` read after spawn-vs-in-process is decided: deleted, rewritten as a thin coordinator, or absorbed into routing.
- Exact skill file splits and which unique role text survives, once mapping is chosen.
- Installer, lock, and test surgery: `bin/native-agents.mjs`, `tests/native-agents.test.mjs`, always-copy of `.agents/agents/` on project install.
- Adapter and README rewrites, including the routing-chain diagram.
- Fate of draft PR "Add senior craft to shared agent roles" once roles are leaving.
- Whether `writing-for-agents` still talks about roles after they are gone.
- A later sketch of routing without roles, once the spawn decision lands.

## Out of scope

- Changing Cursor, Claude Code, or Codex product features for subagents or skills.
- Removing or rewriting unrelated skills.
- MCP registration (already client-local).
- Implementing the removal inside this map.
