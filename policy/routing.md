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
declared dependencies.

- Unclear target → inspect context and ask the minimum blocking question.
- TypeScript quality-tooling work → `fullstack-typescript-quality`.
- Implemented runnable UI, API, or CLI change → `manual-qa`.
- Browser automation → `agent-browser`; specialized workflows come from `agent-browser skills get`. `manual-qa` loads this owner for browser UI.
- `fullstack-typescript-quality` loads `fullstack-typescript-static`, `fullstack-typescript-tests`, and `fullstack-typescript-mutation`; those children own their gates.

## 3. Topic and evidence

- Design/frontend → matching tech packs; existing test layer plus rendered, keyboard, and accessibility checks where relevant. Exact specs require visual comparison; check narrow and wide layouts and measure relevant contrast.
- Backend/domain → matching tech pack; unit and integration checks, and glossary or ADR updates when those files exist.
- SRE → quality owners for gates; relevant pipeline and verification-map evidence.
- Agent configuration → the repository's actual verification scripts.

## Exit

Coding tasks implement with the routed owners and follow the shared completion contract
in `~/.agents/AGENTS.md` or the project `AGENTS.md` managed block. Questions are answered
with the loaded guidance. Keep detailed procedures and the definition of done in their
owners.
