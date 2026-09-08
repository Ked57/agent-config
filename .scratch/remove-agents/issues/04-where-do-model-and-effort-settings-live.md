Type: grilling
Blocked by: 03

# Where do model and effort settings live

## Question

Native agent files are currently the only place this app stores per-role model IDs and reasoning effort (Cursor `model: "...[effort=low]"`, Claude `model` + `effort`, Codex `model` + `model_reasoning_effort`). Shared role files explicitly contain no model settings.

If coding work runs in-process on the main session, those settings have nowhere to apply. If stages still spawn, something has to name a model.

Options:

- **Drop them.** The main session's model runs the skills. Recommendation if spawn dies.
- **Per-skill hints.** Only for skills that still spawn, and only if a harness can honor a model hint without a native agent file.
- **Keep a tiny native-agent table** solely for model/effort, with empty bodies that load a skill. This preserves the bloat the destination is removing; treat as last resort if research shows a harness requires a named agent to pick a model.
