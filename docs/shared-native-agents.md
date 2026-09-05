# Shared native agents

Approved design: keep behavior in `agents/<role>.md`, installed under
`~/.agents/agents/`. Keep model IDs, reasoning effort, and native settings in
`harnesses/{codex,claude,cursor}/agents/`. Native instructions explicitly load the
shared role. Extend the existing installer; there is no shared model-tier schema
or separate sync executable.

## Acceptance criteria

- Import the existing orchestrator, planner, coder, and reviewer behavior, removing
  model-selection prose. Import the routing/orchestration needed to reach them.
- Every role has a native configuration for each harness and every pointer resolves
  to its installed shared Markdown. Shared behavior contains no model settings.
- Codex uses standalone TOML with name, description, developer_instructions, model,
  and model_reasoning_effort. Claude and Cursor use native Markdown frontmatter.
  Respect custom CODEX_HOME without adding machine-specific source paths.
- `init --user` and `sync --user` install deterministic files with ownership markers.
  Repeated sync is unchanged. Existing policy outside managed blocks is preserved.
- Validate all sources, metadata, duplicate names, native settings, destinations,
  and ownership conflicts before any writes. Refuse unsafe paths and unmanaged
  collisions. Validation failure leaves the installation unchanged.
- Remove obsolete agent files only when previous installer ownership proves they
  are safe to remove. Preserve unrelated files and locally modified obsolete files.
- `check --user` fails on missing, changed, or obsolete managed output and passes
  after synchronization. `status --user` includes agents. `sync --user --dry-run`
  previews changes as a diff without writes. Print action counts.
- Keep project installation behavior working. Run CLI integration tests in temporary
  home directories and `npm run verify`. Verify native formats independently;
  report any runtime discovery checks unavailable in the environment.

## Task graph

1. Sources: shared roles, native configurations, routing, and documentation.
2. Installer: integrate the files, source validation, preflight, ownership-safe
   cleanup, drift reporting, preview, and CLI regression tests. Can start alongside
   Sources with the directory and pointer contract above.
3. Integration: merge both tickets, verify all acceptance criteria, run Standards
   and Spec reviews, repair findings, and deliver one ready-for-review PR.

## Native format references

- [Codex subagents](https://learn.chatgpt.com/docs/agent-configuration/subagents)
- [Cursor subagents](https://cursor.com/docs/subagents)
- [Claude Code subagents](https://code.claude.com/docs/en/sub-agents)

Native files use explicit read instructions; a Markdown path is not assumed to be
an automatic include. Model availability remains subject to the harness/account.
