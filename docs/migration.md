# Cursor migration inventory

Inspected on 2026-08-10 from a local Cursor configuration directory.

Observed but intentionally kept client-local:

- MCP servers: `primevue` (stdio wrapper), `Figma` (HTTP), and `atlassian`
  (HTTP).
- The PrimeVue NVM wrapper used by the local MCP registration.

MCP registration and wrappers are managed separately in each client. They are inventory
notes, not files provided by this portable repository.

Not copied:

- Cursor's 19 `skills-cursor` entries: its manifests mark these as
  Cursor-managed/built-in skills. They are product-provided rather than your
  portable configuration, and Cursor can update them independently.
- Cursor plugin cache: no locally authored plugin manifest was present; cached
  marketplace content should be installed/updated by Cursor.
- Hooks: no user hook registration or hook scripts were found.
- Authentication, telemetry, project history, extensions, and IDE state:
  these are machine-local and may contain secrets or personal data.

Add any new cross-client skill under `skills/<skill-name>/SKILL.md`; the installer copies
it to user-level client skill directories and, for project installs, the workspace's
`.agents/skills/` directory when it is part of the managed source list.
Hooks remain client-specific until this repository defines portable hook support. Document
client-specific registration in the relevant adapter rather than duplicating shared policy
inside a hook.
