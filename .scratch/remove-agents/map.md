Label: wayfinder:map

# Remove agents; keep skills

## Destination

A spec that removes agent roles and native agents from this distribution. Skills stay as they are: role procedures are not copied, merged, or recreated as skills. The map is done when every remaining product decision is locked so implementation can start.

## Notes

Domain: this repository's portable agent-configuration (policy, installer, adapters — not skills). Consult `writing-for-agents`, `grilling`, and `domain-modeling` every session. Planning only: produce decisions, not the deletion.

Working language: **skill**, **role**, **native agent**, and **orchestration** as in `CONTEXT.md`. Unqualified "agent" is the bloat being removed (roles + native agents together), and all four layers of that stack are in scope.

Project install already skips native agents ("policy-and-skills only") but still copies roles into `.agents/agents/`; those copies are in the deletion. User install still writes both roles and native agents.

No `docs/agents/issue-tracker.md` exists; this map uses the local-markdown tracker under `.scratch/remove-agents/`.

## Decisions so far

- [Fold roles into skills or replace one-for-one](issues/02-fold-roles-into-skills-or-replace-one-for-one.md): Skills are unchanged. Role procedures do not move into skills.
- [Which agent artifacts are in scope](issues/01-which-agent-artifacts-are-in-scope.md): All four layers — roles, native agents, orchestration, and installer coupling.

## Not yet specified

- How `policy/routing.md` reads after orchestration is gone: routing-only, or a thin leftover coordinator that is not role-spawning.
- Installer, lock, and test surgery details once cleanup policy is chosen.
- Adapter and README rewrites, including the routing-chain diagram.
- Fate of draft PR "Add senior craft to shared agent roles" once roles are leaving.
- Whether `writing-for-agents` still talks about roles after they are gone.

## Out of scope

- Changing Cursor, Claude Code, or Codex product features for subagents or skills.
- Editing skills, including folding role procedures into them.
- [Home for the Designer procedure](issues/07-home-for-the-designer-procedure.md): a skill home is off the destination; skills are unchanged.
- MCP registration (already client-local).
- Implementing the removal inside this map.
