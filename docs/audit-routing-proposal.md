# Compact routing adoption record

Adopted 2026-10-15 after the user requested all findings be applied. The authoritative
implementation is [policy/routing.md](../policy/routing.md); the draft below is retained
as design history, not a second procedure. The implemented router defers review scope
and base selection to `code-review`, resolves project scope first, and registers every
skill against both clients' invocation metadata. The original draft covers 71
skills while preserving manual invocation. The new explicit/manual distinction resolves
the seven current automatic routes to skills whose metadata disables automatic use.

The active registry additionally includes `build-design`, `state-machine`,
`technical-drawing`, `animation-performance`, `break-ui`, and `mobile-native` after the
user requested all six additions; its 77 entries are checked against native metadata.

## Original replacement draft

# Task router

Prefer project `.agents/` when installed, otherwise use `~/.agents/`; resolve every policy and skill pointer in that scope, with repository instructions taking precedence.

## 1. Tech

- TypeScript (`.ts`, `.tsx`, `.mts`, `.cts`, or Vue SFC scripts) → `policy/typescript.md`.
- React components/hooks (`.jsx`, `.tsx`, or React imports) → `policy/react.md`.
- Vue components/composables/forms → `policy/vue-primevue.md`; apply PrimeVue rules only when that dependency exists.
- Established `<domain>.model|interface|service|mock.ts` convention, or an explicit request for it → `policy/domain-module.md`.

## 2. Automatic skills

Resolve names below as `skills/<name>/SKILL.md`; load the matching owner and its declared dependencies, rather than every skill with a related keyword.

- Unclear target → inspect context and ask the minimum blocking question; offer an explicit interview workflow when substantial discovery is wanted.
- Requested interview or stress-test → `grilling`; its manual wrappers choose persistence and output.
- New behaviour or regression coverage → `tdd` at agreed public seams; diagnose a reported defect with `diagnosing-bugs` first.
- Runnable design question → `prototype`; module boundaries → `codebase-design`; terminology/glossary/ADR → `domain-modeling`.
- Branch/PR/range/working-tree review → `code-review`; resolve the supplied range, otherwise its base-branch merge-base, and include uncommitted changes when requested.
- PR body → `pr`; primary-source investigation → `research`; genuinely human-only steps → `wizard`.
- Supplied Figma node, Code Connect mapping or approved exact visual spec → `figma-design-to-code`; original direction or substantial redesign without one → `frontend-design`.
- Complexity/path-count problem → `complexity-audit`; TypeScript quality-tooling work → `fullstack-typescript-quality`.
- Agent-facing instructions → `writing-for-agents`; implemented runnable UI/API/CLI change → `manual-qa`.
- Browser automation → `agent-browser`; read workflows from `agent-browser skills get`, including specialized workflows when applicable.
- Existing-interface audit → `better-interface`; scoped branch/range interface reviews enter through explicit `interface-review`.
- Interface implementation → choose `better-accessibility`, `better-colors`, `better-layout`, `better-typography`, `better-ui` or `better-writing` for the changed concern.
- Build web motion → `animate`; build Expo/React Native motion → `animate-expo`; motion opportunities → `find-animation-opportunities`; motion roadmap → `improve-animations`.
- Motion terminology → `animation-vocabulary`; Apple-style interaction → `apple-design`; Sonner → `ask-sonner`; Swift → `write-swift`; design-engineering craft → `emil-design-eng`.
- Pre-commit setup → `setup-pre-commit`; requested Claude Git hooks → `git-guardrails-claude-code`; requested ShoeHorn migration → `migrate-to-shoehorn`; course exercise scaffolding → `scaffold-exercises`.
- `fullstack-typescript-quality` loads `fullstack-typescript-static`, `fullstack-typescript-tests` and `fullstack-typescript-mutation`; those children own their gates.

## 3. Explicit workflows

Run these only when selected by the user; ordinary task matching may suggest them but cannot silently invoke them.

- Engineering workflow: `grill-me`, `grill-with-docs`, `to-spec`, `to-tickets`, `implement`, `implement-spec`, `wayfinder`, `triage`, `retro`, `improve-codebase-architecture`.
- Setup and navigation: `ask-matt`, `setup-matt-pocock-skills`, `setup-ts-deep-modules`, `handoff`, `claude-handoff`, `to-questionnaire`, `wait-what`.
- Interface alternatives and review: `break`, `explain-interface`, `interface-review`, `variant`, `design-prototype`, `pick-ui-library`, `review-animations`, `design-taste-frontend` (Taste Skill).
- Personal/learning/writing: `chief-of-staff`, `loop-me`, `teach`, `writing-fragments`, `writing-beats`, `writing-shape`.

## 4. Evidence and exit

- Design/frontend → existing test layer plus relevant rendered, keyboard and accessibility checks; exact specs require visual comparison.
- Backend/domain → unit/integration checks and relevant glossary/ADR updates; tooling/agent configuration → the repository's actual verification scripts.
- Coding → implement with routed owners, then follow the shared completion contract; questions → answer with the loaded guidance.

## Companion changes completed

- Added a registry check for every source skill: automatic/child entries and explicit entries must agree with frontmatter and Codex metadata; unknown skill references fail.
- Extend project detection and command routing together: include `.mts`/`.cts`, changed tests and configuration, root-level source, and package-local React dependencies in monorepos.
- Give the review skill the same default-range and working-tree rules as its router; changing only the router leaves a conflicting leaf procedure.
- Keep exact-source design precedence in one route; let child skills own their detailed rules rather than restating them in topic paragraphs.
- Keep the completion contract in `policy/shared-policy.md`; the router only selects owners and evidence.
- Retained every Matt Pocock skill as requested; no candidate deletion was performed.

## Compaction examples

- Browser workflow paragraph → `manual-qa` loads `agent-browser`; workflow content comes from the installed CLI.
- Quality ownership paragraph → `fullstack-typescript-quality` loads its static, test and mutation owners.
- Interface ownership paragraph → `better-interface` audits; focused `better-*` owners implement the selected fixes.
- Vue validation procedure → inspect dependencies, reuse the feature's schema stack, and keep paths/types/bindings/errors/i18n aligned; new or mixed stacks require approval.
- React Effects section → Effects synchronise external systems only; use complete dependencies and lifecycle cleanup, with derived values in render and user work in handlers.
- React memoisation section → inspect Compiler support, then add memoisation only for a measured need or an existing stability contract.

These compressions remove duplicated ownership and retain testable conditions; they do
not replace meaningful exceptions with an unexplained slogan. No arbitrary word-count
saving is claimed: the complete draft also adds a missing manual registry and new file
coverage, so its total size is not a like-for-like compression metric.
