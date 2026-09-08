# Agent configuration

Portable coding-agent configuration shared by Cursor, Claude Code, and Codex.

## Language

**Skill**:
A load-on-demand procedure for a kind of work.
_Avoid_: Agent, role

**Role**:
A named sub-agent persona this distribution spawns for a coding stage.
_Avoid_: Skill, agent (unqualified)

**Native agent**:
A harness-registered subagent that wraps a role with that harness's model settings.
_Avoid_: Skill, role

**Orchestration**:
The coding-task workflow that spawns roles after routing.
_Avoid_: Routing
