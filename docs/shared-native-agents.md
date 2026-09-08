# Leftover native agents

This repository does not ship shared roles or a `harnesses/` tree. Behavior lives in
`policy/` and `skills/`. The installer still understands leftover `agent:` and obsolete `policy:` lock keys so
`sync --user` can clean up previous role files, native wrappers, and dropped packs.

## Acceptance criteria

- Do not install planner, designer, coder, reviewer, or native harness wrappers.
- `init --user` and `sync --user` install policy and skills only. Repeated sync is
  unchanged. Existing policy outside managed blocks is preserved.
- Validate sources, destinations, and ownership conflicts before any writes.
  Refuse unsafe paths and unmanaged collisions. Validation failure leaves the
  installation unchanged.
- Remove leftover `~/.agents/agents/` files, dropped policy packs under
  `~/.agents/policy/`, and previously installed native wrappers
  under `~/.codex/agents/`, `~/.claude/agents/`, and `~/.cursor/agents/` only when
  previous installer ownership proves they are safe to remove. Preserve unrelated files
  and locally modified leftovers.
- `check --user` fails on missing, changed, or obsolete managed output and passes
  after synchronization. `sync --user --dry-run` previews changes as a diff without
  writes. Print action counts.
- Keep project installation behavior working. Run CLI integration tests in temporary
  home directories and `npm run verify`.
