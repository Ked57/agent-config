# Task router

Read this first for every task and route on tech, skill, and topic. Prefer a project
`.agents/` install when present; otherwise use `~/.agents/`. Resolve every policy and
skill pointer in that scope. Repository-specific instructions take precedence.
The global paths below also identify the corresponding project-local files.

## 1. Tech

- TypeScript (`.ts`, `.tsx`, `.mts`, `.cts`, or Vue SFC scripts) → `~/.agents/policy/typescript.md`.
- React components/hooks (`.jsx`, `.tsx`, or React imports) → `~/.agents/policy/react.md`.
- Vue components/composables/forms → `~/.agents/policy/vue-primevue.md`; apply PrimeVue rules only when that dependency exists.
- Established `<domain>.model|interface|service|mock.ts` convention, or an explicit request for it → `~/.agents/policy/domain-module.md`.

## 2. Skills

Resolve names as `~/.agents/skills/<name>/SKILL.md`; load the matching owner and its
declared dependencies. Use the following automatic routes; explicit workflows follow
in their own registry.

- Unclear target → inspect context and ask the minimum blocking question; offer an explicit interview workflow when substantial discovery is wanted.
- Requested interview or stress-test → `grilling`; its manual wrappers choose persistence and output.
- Reported bug, regression, flake, or performance defect → `diagnosing-bugs`.
- New behaviour or regression coverage → `tdd` at agreed public seams.
- Runnable design question → `prototype`; module boundaries → `codebase-design`; terminology, glossary, or ADR → `domain-modeling`.
- Branch, PR, range, or working-tree review → `code-review`; its procedure owns scope, default-base selection, and standards discovery.
- PR body → `pr`; primary-source investigation → `research`; genuinely human-only steps → `wizard`.
- Supplied Figma node, Code Connect mapping, approved screenshot, or other exact visual spec → `figma-design-to-code` (load `build-design` for design-file token mapping); original direction or substantial redesign without one → `frontend-design`.
- Complexity or path-count problem → `complexity-audit`; TypeScript quality-tooling work → `fullstack-typescript-quality`.
- Agent-facing instructions → `writing-for-agents`; implemented runnable UI, API, or CLI change → `manual-qa`.
- Browser automation → `agent-browser`; specialized workflows come from `agent-browser skills get`. `manual-qa` loads this owner for browser UI.
- Existing-interface audit → `better-interface`; this owner orchestrates review and delegates implementation to the focused owners below.
- Interface implementation → choose `better-accessibility`, `better-colors`, `better-layout`, `better-typography`, `better-ui`, or `better-writing` for semantics/focus, color, structure, type, polish, or product copy respectively.
- Build web motion → `animate`; build Expo/React Native motion → `animate-expo`; motion opportunities → `find-animation-opportunities`; motion roadmap → `improve-animations`.
- Motion terminology → `animation-vocabulary`; Apple-style interaction → `apple-design`; Sonner → `ask-sonner`; Swift → `write-swift`; design-engineering craft → `emil-design-eng`.
- Animation frame-budget diagnosis → `animation-performance`; mobile-web viewport, touch, or browser behaviour → `mobile-native`; realistic worst-case UI data → `break-ui`; static physical-object drawings → `technical-drawing`.
- Pre-commit setup → `setup-pre-commit`; requested Claude Git hooks → `git-guardrails-claude-code`; requested ShoeHorn migration → `migrate-to-shoehorn`; course exercise scaffolding → `scaffold-exercises`.
- `fullstack-typescript-quality` loads `fullstack-typescript-static`, `fullstack-typescript-tests`, and `fullstack-typescript-mutation`; those children own their gates.

### Explicit workflows

Run these only when selected by the user; ordinary task matching may suggest them but
cannot silently invoke them. Preserve the skill's native invocation metadata.

- Engineering workflow: `grill-me`, `grill-with-docs`, `to-spec`, `to-tickets`, `implement`, `implement-spec`, `wayfinder`, `triage`, `retro`, `improve-codebase-architecture`.
- Setup and navigation: `ask-matt`, `setup-matt-pocock-skills`, `setup-ts-deep-modules`, `handoff`, `claude-handoff`, `to-questionnaire`, `wait-what`.
- Interface alternatives and review: `break`, `explain-interface`, `interface-review`, `variant`, `design-prototype`, `pick-ui-library`, `review-animations`, `state-machine`, `design-taste-frontend` (also selected by the name Taste Skill).
- Personal, learning, and writing: `chief-of-staff`, `loop-me`, `teach`, `writing-fragments`, `writing-beats`, `writing-shape`.

## 3. Topic and evidence

- Design/frontend → matching tech and interface owners; existing test layer plus rendered, keyboard, and accessibility checks where relevant. Exact specs require visual comparison; check narrow and wide layouts and measure relevant contrast.
- Backend/domain → matching tech pack and module-design owner; unit/integration checks and relevant glossary/ADR updates.
- SRE → quality owners for gates and `wizard` for human-only steps; relevant pipeline and verification-map evidence.
- Agent configuration → `writing-for-agents`; the repository's actual verification scripts.

## Exit

Coding tasks implement with the routed owners and follow the shared completion contract
in `~/.agents/AGENTS.md` or the project `AGENTS.md` managed block. Questions are answered
with the loaded guidance. Keep detailed procedures and the definition of done in their
owners.
