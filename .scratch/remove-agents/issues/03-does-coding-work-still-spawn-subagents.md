Type: grilling
Blocked by: 06

# Does coding work still spawn subagents

## Question

After roles and native agents are gone, how does a coding task actually run?

Today `policy/orchestration.md` has the main session spawn Planner → Designer → Coder → Manual QA → Reviewer, preferring native agents, else a generic subagent given the role file. Skills are a different dispatch: the main session loads `SKILL.md` and follows it. Some skills already spawn for isolation (`code-review` runs Standards and Spec as parallel subagents).

Options:

- **In-process.** The main session follows the routed skills. Spawn only when a skill asks for isolation. This is the recommendation: a second, always-on role graph is the bloat; skills already know when they need a subprocess.
- **Keep a spawn graph, drop native agents.** Orchestration still stages work, but each stage is "spawn a generic subagent, tell it to follow an existing skill." Roles die; the workflow graph stays; skills stay as they are.
- **Keep native agents as empty shells.** Rejected by the destination unless the harness research in [Harness behavior without custom native agents](06-harness-behavior-without-custom-native-agents.md) shows a harness that cannot delegate without a named agent file. Empty shells that load a skill would also leave the dual system in place.

This ticket waits on that research: whether Cursor, Claude Code, and Codex can still spawn generic subagents when this app stops installing custom native agents.
