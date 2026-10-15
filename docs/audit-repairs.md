# Audit repairs · 2026-10-15

F1–F7 are repaired. All 38 Matt Pocock skills and the 77-skill bundle are now
installed, including the six newly requested upstream additions. The subsequent request to apply all findings also adopts the compact router,
all 19 TypeScript/Vue/React rules, and the five quality-gate refinements.

## Invocation and provenance · F1

The seven manual-only frontmatter files and their seven Codex metadata files come
unchanged from Matt Pocock's pinned upstream. Independent content/hash comparisons are
recorded in [audit-invocation-discovery.md](audit-invocation-discovery.md).

Policy describes our intended routing; metadata configures the client's native invocation
mechanism. We kept the upstream manual settings and made the seven engineering workflows
explicit choices in routing. Ordinary task matching no longer starts them implicitly.
The automatic `tdd`, diagnosis and module-design routes remain available. A regression
checks every bundled skill against both clients' metadata, rejects unknown router entries,
and requires each skill to appear in the matching automatic/child or explicit registry.

## Install lifecycle · F2

User sync now removes obsolete skill files in both skill roots only when their prior
installed hashes match. The original `portable-skill` ownership keys are supported.
Local changes and unrelated files are preserved; preserved obsolete files become unmanaged.

Project installation now writes a version 2 ownership lock with per-file hashes and
applies the same cleanup rule to both portable and native Claude skill roots. Version 1
locks migrate without authorising deletion of unhashed output. Invalid obsolete paths
are rejected before cleanup; symlink protections remain in place.

Regressions cover full-skill deletion, removed support files, modified and unrelated
files, preview without writes, repeated sync, legacy locks, old ownership keys and a
poisoned project path. Only disposable fixture skills are deleted by these tests; no
Matt skill was removed from the real source or installation.

## Verification routing and commands · F3–F4

- TypeScript detection and routes include `.mts` and `.cts`; test files retain checks.
- Root tooling and the existing application/test/source directories are scanned, including package-local React manifests and CI workflow files.
- A baseline `**/*` route requires the existing full gate, or available build, plus fast checks; `verify` is recognised when `verify:fast` is absent.
- Check fails for detected code, package/build/compiler configuration or workflow inputs without a required route, including project-owned maps that have become stale.
- Direct npm/pnpm/yarn/bun `run <script>` references must name a nonempty root-package script; custom/compound task-runner commands are explicitly reported as unverified.
- Existing routing maps remain project-owned and are not overwritten on sync. Check inspects configuration and does not execute the gates.

The public CLI regressions verify module/test/root/monorepo detection, rejection of
uncovered files, stale scripts, and reporting of custom commands. The temporary QA
project additionally executes its real `verify:full` command and exercises failure
and recovery paths.

## Claude project discovery · F5

The current official documentation and the inspected Claude Code 2.1.282 loader use
`.claude/skills/` for native discovery. `.agents/skills/` appears in the import adapter,
which copies into the native directory; singular `.agent/skills/` was not found.
[Claude skill locations](https://code.claude.com/docs/en/skills#choose-where-skills-load).

Project installation now creates owned `.claude/skills/<name>/` copies in addition to
portable `.agents/skills/<name>/` copies, adds them to the generated formatting ignore
block, and checks/syncs/cleans them under the same ownership rules. The regression uses
an empty personal home so global skills cannot mask missing project files.

Filesystem registration is verified; a new Claude model session or slash-menu inspection
was not performed. The detailed loader evidence and its limits are in the research note.

## Review scope · F6

The installed `code-review/scripts/review-scope.mjs` resolves the scope once and returns
Git argument arrays, commit IDs, file lists and untracked paths for both reviewers.
A supplied base selects the committed merge-base range. Without an explicit scope,
local changes select the working tree; a clean tree selects the default base branch.
Explicit staged and unstaged modes are also supported.

A working-tree review carries both staged and unstaged patches, even when they cancel
in the final working copy, and includes untracked files for separate reading. Missing
refs and empty scopes fail before reviewers run. Routed policy now defers to this single
scope owner. The Matt lock records the locally adapted procedure and added helper;
upstream invocation metadata remains unchanged.

Disposable Git repositories exercise committed, staged, unstaged, mixed and untracked
changes, filenames with spaces, cancelling edits, default base, empty ranges and invalid
refs/scopes. The installed helper also ran successfully against this checkout.

## Temporary fixtures · F7

Tests use the canonical `realpath` of the OS temporary directory, avoiding macOS's
system `/var` link without weakening installer path checks. Existing explicit symlink
rejection tests remain active. The default documented verification command now passes
without a `TMPDIR` override.

## Verification and manual QA

- **PASS:** `npm run verify` — 56 tests passed, zero failed, default environment.
- **PASS:** `git diff --check`.
- **PASS:** `node bin/agent-config.mjs sync --user` — two helper files created, four files/lock updated, zero removed.
- **PASS:** `node bin/agent-config.mjs check --user` after synchronization.
- **PASS:** fresh project init and check, with portable and native Claude helper files present.
- **PASS:** execute the fixture's full gate through npm; it exits 0.
- **PASS:** an empty routing map and a deleted package script each make check exit 1; restoring them returns check to 0.
- **PASS:** project sync preserves an unmanaged local file.
- **PASS:** installed review helper resolves this checkout as a two-patch working-tree review including untracked files; an invalid base exits 1.

Manual CLI evidence is in
[the temporary QA results](/private/tmp/agent-config-repairs-qa-srMU2I/results.json), with
per-scenario command logs beside it. Browser screenshots, React inspection, Web Vitals
and profiling are inapplicable to these CLI/configuration changes. Native client model
sessions, cloud images and consuming application frameworks were not executed.

## Complete policy adoption

- The compact router resolves project scope first, preserves the three routing axes,
  gives every source skill an invocation-aware entry, and delegates detailed procedures
  to their existing owners. Review defaults remain owned by `code-review`.
- All six TypeScript, seven Vue/PrimeVue, and six React rules are applied with their
  original scope/version exceptions. React Effect and Compiler distinctions are retained;
  Vue validation discovery is compacted without changing stack-selection or approval rules.
- Quality tooling verifies executable gates and file-kind coverage, including Vue
  templates; its test owner requires temporal regression evidence for changed async UI.
  Existing production-build/browser evidence applies to changed critical journeys.
- New tools and compiler flags remain explicit tooling work; existing coverage,
  complexity, and CRAP thresholds are unchanged.
- [Policy adoption and primary sources](audit-policy-proposals.md) maps all 19 IDs to
  their active owners. These are configuration changes; this Node repository cannot
  demonstrate their enforcement inside a separate TypeScript/Vue/React application.

## Upstream updates and six additions

The user explicitly requested both the updates and all six additions. All selected files
were downloaded at immutable commits and compared to GitHub blob IDs before import;
root licenses also match those trees.

- Jakub Krehel: 14 skills at `4c66b1fa86e9ab70187b43d7da9b6fdb29f2ef63`, including
  `build-design`, `state-machine`, and `technical-drawing` with every supporting file.
- Emil Kowalski: 15 skills at `2d228630ba1446365f614a108cb8252f1feda202`, including
  `animation-performance`, `break-ui`, and `mobile-native`.
- Native automatic/manual settings are preserved. `state-machine` is explicit-only;
  the five other additions are model-invoked. `figma-design-to-code` remains the exact-spec
  owner and loads `build-design` for mapping, with integration, implied states, and
  accessibility precedence stated in its procedure.
- Emil's initial-response changes were reviewed: their greeting branch applies only
  without a specific task. The existing local `design-prototype` rename is retained and
  `break-ui` points to that name instead of Matt Pocock's `prototype`.
- A minimal CommonJS package scope fixes the new drawing scripts inside ESM repositories.
  The original geometry, queue, theme, and viewer-builder tests are part of `npm test`;
  no upstream assertion is removed. Both adaptations are recorded in vendor locks.
- Matt Pocock's 38 skills remain at their audited commit, with only the previously
  documented review-scope adaptation. Taste and Agent Browser pins remain unchanged.

## Final verification after complete adoption

- `npm run verify`: **60/60 passed**, no skipped tests and no `TMPDIR` override.
- `git diff --check`: passed. All 12 newly imported drawing JavaScript/CommonJS files
  passed syntax checks; vendor inventories, hashes, and licenses pass the lock checks.
- User sync: 80 created, 129 updated, zero removed; `check --user` passed.
  All 325 source skill files match both user installations across all 77 skills.
- Manual CLI QA: **13 scenarios passed**, including fresh project installation with
  an empty HOME, byte comparison of all 77 trees in both roots, a real required check
  accepting valid source and rejecting invalid syntax, missing-script failure/recovery,
  preservation of an unowned note, and installed drawing-builder success, usage error,
  invalid configuration, and recovery.
- Evidence: `/private/tmp/agent-config-adoption-qa-sn091m6q/results.json` and the
  `adoption` record in [audit-evidence.json](audit-evidence.json).
- The builder QA uses fixture font/PDF dependencies to verify packaging and dispatch;
  browser viewer/downloads with real libraries, phone behaviour, new client-menu
  discovery, and consuming application behaviour remain unverified. Canvas content is
  updated from the evidence; its preview runtime was not executed.
