# Sub-agent orchestration

Read this after `~/.agents/policy/routing.md` classifies the task as coding work. The main
agent coordinates the task directly; coordination is not a separate delegated role.

## Roles

Each role owns its procedure and output contract; routing stays in the router.

- Planner → `~/.agents/agents/planner.md` — buildable checklist plan.
- Designer → `~/.agents/agents/designer.md` — design direction and artifacts.
- Coder → `~/.agents/agents/coder.md` — implementation and automated verification.
- Manual QA → `~/.agents/agents/manual-qa.md` — hands-on browser, computer, API, or CLI checks.
- Reviewer → `~/.agents/agents/reviewer.md` — independent review of code and evidence.

## Workflow graph

```text
original UI, no exact spec → Designer → Planner → Coder
unresolved implementation → Planner → Coder
clear implementation      → Coder

changed runnable behavior → Manual QA → Reviewer
no runnable behavior      → Reviewer
review-only request       → Reviewer → report
manual-QA-only request    → Manual QA → report
```

The main agent selects needed stages and reuses sufficient plans or designs. An exact
visual spec goes to Coder. Run Manual QA after implementation when a runtime surface can
be exercised; record why it is not applicable otherwise. Missing tools or access mean
blocked QA, not that QA is unnecessary. Review-only and QA-only requests do not authorize
repairs. For implementation tasks:

- QA failures or Reviewer `comments` go to Coder, followed by affected QA and review again.
- Reviewer `wrong direction` goes to Planner with evidence before further implementation.
- QA `blocked` or Reviewer `pending` leaves required work open; resolve the dependency and
  continue independent work. Diagnose repeated failures before retrying an unchanged loop.

## Spawn contract

Use the matching native role when available; otherwise give a general sub-agent the role
file and disclose the fallback. If delegation is unavailable, perform the needed stages
sequentially and disclose the lack of independence. Honor harness model settings.

A role starts with its file and brief, then reads applicable packs, skills, and repository
evidence. Preserve user decisions across handoffs. Keep shared-file edits sequential;
parallel writers own disjoint files. Give QA a stable build and isolated test data.

```text
Read `~/.agents/agents/<role>.md` and follow it.
Task: outcome, acceptance criteria, scope, owned files, and existing user decisions.
Routing: applicable ~/.agents/policy/<pack>.md and ~/.agents/skills/<name>/SKILL.md;
         required checks and topic evidence.
Upstream: relevant reports, exact changed-file/revision scope, and unresolved items.
QA context when needed: build, launch instructions, entry points, test data, scenarios.
Return: the role's artefact, with unresolved work explicit.
```

## Win condition

The requested behavior is delivered, required automated checks pass, applicable manual QA
passes, and review has no unresolved actionable findings. Required unavailable evidence
remains pending. Report the outcome, observed evidence, and remaining limitations.
