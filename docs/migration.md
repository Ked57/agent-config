# Cursor migration inventory

Inspected on 2026-08-10 from `/Users/clementfassot/.cursor`.

Imported into the portable source:

- MCP servers: `primevue` (stdio wrapper), `Figma` (HTTP), and `atlassian`
  (HTTP).
- The PrimeVue NVM wrapper, rewritten without a hard-coded home path.

Not copied:

- Cursor's 19 `skills-cursor` entries: its manifests mark these as
  Cursor-managed/built-in skills. They are product-provided rather than your
  portable configuration, and Cursor can update them independently.
- Cursor plugin cache: no locally authored plugin manifest was present; cached
  marketplace content should be installed/updated by Cursor.
- Hooks: no user hook registration or hook scripts were found.
- Authentication, telemetry, project history, extensions, and IDE state:
  these are machine-local and may contain secrets or personal data.

Add any new cross-client skill under `.agents/skills/<skill-name>/SKILL.md`.
Add a hook script to `hooks/` and a short client-specific registration note in
the relevant adapter folder.
