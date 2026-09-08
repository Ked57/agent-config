Type: grilling
Blocked by: 03

# Where do model and effort settings live

## Question

Native agent files are currently the only place this app stores per-role model IDs and reasoning effort (Cursor `model: "...[effort=low]"`, Claude `model` + `effort`, Codex `model` + `model_reasoning_effort`). Shared role files explicitly contain no model settings.

If coding work runs in-process on the main session, those settings have nowhere to apply. If stages still spawn, something has to name a model.

Options:

- **Drop them.** The main session's model runs whatever skills routing already loads. Recommendation if spawn dies. Does not edit skills.
- **Keep a tiny native-agent table** solely for model/effort. This preserves the bloat the destination is removing; treat as last resort if research shows a harness requires a named agent to pick a model.
- **Per-skill model hints** are off this map: they would edit skills, and skills stay unchanged.
