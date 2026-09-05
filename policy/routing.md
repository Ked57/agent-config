# Task router

Read this first for every task. Route on the three axes below, load only what matches, then
take the exit. These routes are installed by the user installer under `~/.agents/`.
Repository-specific instructions take precedence.

## 1. Tech (files touched → pack)

- `.ts`, `.tsx`, `.mts` → `~/.agents/policy/typescript.md`
- React components, hooks, `.jsx`/`.tsx` → `~/.agents/policy/react.md`
- `.vue`, composables, PrimeVue UI, Vue forms → `~/.agents/policy/vue-primevue.md`
- `<domain>.model|interface|service|mock.ts` modules → `~/.agents/policy/domain-module.md`, only when the repository already uses the four-file convention or the user asks for it.

## 2. Skill (task type → `~/.agents/skills/<name>/SKILL.md`)

- Vague idea or unclear requirements → `grill-with-docs` in a repository, `grill-me` without one.
- Design question that needs a runnable answer → `prototype`.
- Bug, regression, flake, or performance problem → `diagnosing-bugs`.
- New behaviour with a known target → `tdd`; with a ticket, `implement` drives it.
- Multi-session build → `to-spec`, then `to-tickets`, then `implement` per ticket.
- Effort too foggy for one session → `wayfinder`.
- Module shape or seam → `codebase-design`; codebase upkeep → `improve-codebase-architecture`.
- Terminology, `CONTEXT.md`, or ADR → `domain-modeling`.
- Review of a branch, PR, or diff → `code-review`.
- Reading legwork against primary sources → `research`.
- Steps only a human can perform → `wizard`.
- In-progress merge or rebase conflict → `resolving-merge-conflicts`.
- Quality tooling install, upgrade, or audit → `fullstack-typescript-quality`.
- Writing skills, `AGENTS.md`, or agent-facing docs → `writing-for-agents`.
- Original visual direction or substantial redesign without a supplied design → `frontend-design`.
- Faithful implementation of a supplied Figma node → `figma-design-to-code`.

`ask-matt` is the human-invoked full map of these skills and their flows; agents route with this table instead.

## 3. Topic (discipline → packs, skills, evidence)

- **Design** (visual direction, redesign, Figma, interface quality) → use `frontend-design` or `figma-design-to-code` as appropriate. Evidence: rendered screenshots at narrow and wide viewports, keyboard and assistive-technology checks when relevant, measured contrast, and Figma comparison when supplied.
- **Frontend** (components, forms, UI state) → `typescript.md` plus `react.md` or `vue-primevue.md`. Evidence: component tests, screenshots, accessibility selectors.
- **Backend** (services, APIs, data access, business rules) → `typescript.md`; `domain-module.md` when the convention is detected; `codebase-design`. Evidence: unit and integration tests.
- **Domain** (terminology, boundaries, decisions) → `domain-modeling`, `domain-module.md`. Evidence: `CONTEXT.md` and ADRs updated.
- **SRE** (CI, pipelines, infrastructure, secrets, releases) → `wizard` for human-only steps; `setup-pre-commit` and `fullstack-typescript-quality` for quality gates. Evidence: pipeline pass, `.agents/agent-config.json` checks.
- **Agent configuration** (skills, policy, `AGENTS.md`) → `writing-for-agents`. Evidence: the repository's own verify script.

## Exit

- **Coding task** (new behaviour, bug fix, refactor, tests, tooling or configuration change) → read `~/.agents/policy/orchestration.md` and run the task through its roles. Carry the routing result — packs, skills, topic evidence — into the task brief.
- **Non-coding task** (question, explanation, documentation-only edit) → answer directly with the routed packs and skills.
