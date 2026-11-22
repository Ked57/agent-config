---
name: fullstack-typescript-tests
description: Loaded by fullstack-typescript-quality for Vitest, Cypress component tests, coverage, CRAP, affected-test selection, and scoped coverage gates.
version: 1.1.0
---

# Full-stack TypeScript tests

Owned by `fullstack-typescript-quality`, which loads this skill for test and coverage gates. Keep rules here; point orchestration, commands, Git/CI, and the shared checklist back to the parent.

## Test layers

- Vitest for pure TypeScript (functions, non-DOM composables, domain and application logic).
- Cypress Component Testing plus Testing Library for `.tsx` / `.vue` component behaviour.
- One owner per behaviour: keep the same component behaviour out of both Vitest and Cypress CT by default.
- Cypress E2E only for critical complete user journeys.
- For changed async UI, resolve controllable responses in reverse order and assert that stale work cannot overwrite the current result; cover unmount/remount where work or integrations outlive a render, proving one active handler/subscription and no obsolete update. Use the existing designated runner.

## Coverage

Require 100% coverage for components, pages, domain, and application code. Code outside those layers may be ignored with an explicit justification. Count both Vitest coverage and Cypress CT coverage toward the gate when both runners exist.

## CRAP

Enforce CRAP below 25 with the `crap-typescript` Vitest adapter (`@barney-media/crap-typescript-vitest` or the project's equivalent), passing `threshold: 25` explicitly.

## Affected-test selection

Merge request pipelines run only the specs a change can affect; the default branch and tags always run every spec and the full coverage gate, which also catches anything the selection misses.

- Diff against the merge-base with the target branch (`git diff --name-only <base>...HEAD`).
- Child pipelines may not receive merge request variables (GitLab does not pass `CI_MERGE_REQUEST_*` downstream): forward the merge-base explicitly, and run every spec when it is missing or cannot be diffed.
- Build the reverse import graph with a resolver that understands the project's file kinds and aliases (for example `dependency-cruiser` for `.vue` and `tsconfig` paths). The affected set is the changed files plus every file that imports them, transitively. Stop the walk at app-shell files (router, layouts, entry points) unless one of them changed: the router lazy-imports every page and pages import the router, so walking through it selects everything.
- Run every spec when a global input is in the affected set, changed directly or reached through imports (a plugin imported by the test support file, a mock imported by shared handlers): lockfile, `package.json`, `tsconfig*`, bundler and runner config, test support and fixture directories, shared mocks, global styles and theme presets, files that auto-import plugins register (for example `unplugin-vue-components` globs). Also run every spec for a changed file the graph does not contain, and when the resolver left a relative or aliased import unresolved: that is a missing edge.
- Diff with `-z` (or `core.quotePath=false`) so non-ASCII paths are not quoted.
- Component and unit specs: select the specs in the affected set and pass those paths to the runner. Do not substitute Vitest `--changed` or `related`: bare `--changed` selects only uncommitted files, so a clean checkout runs no tests and still passes, and both follow lazy `import()` through the router, which drops the app-shell cutoff and can select every spec.
- E2E specs drive the built app and import no source: map each E2E domain to its source folders and run the domain when an affected file falls in them. Every journey renders the app shell, so run every E2E domain when a shell file changed, or when a changed file outside every domain's source folders reaches the shell without passing through them (an auth guard, a store, a layout helper).
- Keep existing CI domain jobs; filter each job's specs inside it, and exit successfully before installing the browser runner when nothing in the domain is affected.

## Scoped coverage gate

On merge requests, enforce the coverage gate on the check set only: the gated files in the affected set. A spec covers only files it loads, so every spec that covers a check-set file is selected and its coverage map is complete. Unaffected files keep the coverage proven on the default branch.

When a merge request changes or deletes a spec of a gated domain, or changes a test-only input one of its specs imports (a mock or fixture generator no gated file imports), run that domain's specs in full and hold every file the domain gates: a removed assertion, spec, or fixture branch can drop coverage of files the change never touched, and their other covering specs would not be selected. Where a runner enforces its own thresholds on every run (for example a full Vitest run with 100% thresholds on unit-owned files), that run already covers its files.
