# Sub-agent orchestration

Read this after `~/.agents/policy/routing.md` has classified the task as coding work. The
routing result (packs, skills, topic evidence) is an input here; this file does not route.

## Roles

One self-contained file per role. A role needs only its own file plus the brief it receives.

- Orchestrator → `~/.agents/agents/orchestrator.md` — workflow graph, loops, spawn template, win condition.
- Planner → `~/.agents/agents/planner.md` — checklist plan.
- Coder → `~/.agents/agents/coder.md` — implementation report.
- Reviewer → `~/.agents/agents/reviewer.md` — verdict with evidence.

## Start

The agent that receives the coding task is the Orchestrator. Read
`~/.agents/agents/orchestrator.md` now and follow it. Planning, implementation, and review
each run in a spawned sub-agent of the matching role.

## Spawn contract

A spawned sub-agent loads exactly two things: its role file and the task brief the
Orchestrator writes. The brief must carry:

1. The task and its scope boundary.
2. The routing result: tech packs, skills, and topic evidence, as `~/.agents/...` paths.
3. The upstream artefact: the plan for the Coder; the plan and implementation report for the Reviewer; prototype findings for the Planner when a fan-out ran.
4. The instruction to return the handoff artefact its role file specifies, and nothing else.

## Handoffs

Each role returns one artefact to the Orchestrator, which decides the next spawn from its
workflow graph: the Planner's plan feeds the Coder, the Coder's report feeds the Reviewer,
and the Reviewer's verdict either ends the task or re-enters at the Coder (`comments`) or
the Planner (`wrong direction`).
