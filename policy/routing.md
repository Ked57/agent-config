# Task router

Read this first for every task. Route on the three axes below, load only what matches, then
take the exit. Paths are user-scoped (`~/.agents/...`); a project-scoped install carries the
same files under `.agents/` in the repository root. Use whichever exists.
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
- Exact visual spec: a supplied Figma node, Code Connect mapping, approved design screenshot, or other exact visual spec → `figma-design-to-code`. The spec wins over taste.
- Original UI: designing or substantially reshaping an interface with no supplied spec → `frontend-design`.
- Complexity: auditing or reducing cyclomatic complexity, nested branching, or a function that is hard to test because of too many paths → `complexity-audit`.
- Quality tooling install, upgrade, or audit → `fullstack-typescript-quality`.
- Writing skills, `AGENTS.md`, or agent-facing docs → `writing-for-agents`.
- Cross-discipline audit of an existing screen, flow, or repository → `better-interface`.
- Semantic HTML, keyboard or focus behaviour, forms, or assistive technology → `better-accessibility`.
- Palettes, color tokens or formats, or measured contrast → `better-colors`.
- Grouping, alignment, spacing, responsive structure, or spatial RTL → `better-layout`.
- Type systems, fonts, wrapping, truncation, or rendered text → `better-typography`.
- Surfaces, icons, visual polish, or optional motion → `better-ui`.
- Product copy, labels, errors, empty states, voice, or terminology → `better-writing`.

`fullstack-typescript-quality` owns quality-tooling orchestration; it loads
`fullstack-typescript-static`, `fullstack-typescript-tests`, and
`fullstack-typescript-mutation`. Static analysis, tests/coverage, and mutation rules belong
to those siblings.

`better-interface` owns review orchestration only; implementation and remediation route to the focused
`better-accessibility`, `better-colors`, `better-layout`, `better-typography`, `better-ui`,
or `better-writing` skill. A branch, pull request, commit range, or working-tree review
starts only when the user explicitly invokes `interface-review`; it resolves the change
scope and hands the cross-discipline audit to `better-interface`.

`break`, `explain-interface`, `interface-review`, and `variant` are explicitly user-invoked
named workflows; route to them only when the user names one. `frontend-design` remains the
route for original visual direction or substantial redesign without a source-of-truth
design; `figma-design-to-code` remains the route for faithful implementation of a supplied
Figma node or other exact visual spec.

`ask-matt` is the human-invoked full map of these skills and their flows; agents route with this table instead.

## 3. Topic (discipline → packs, skills, evidence)

- **Design** (visual direction, redesign, Figma, interface quality) → use the matching interface route above. Original visual direction or AI-produced design artifacts with no supplied spec also spawn the Designer (`~/.agents/agents/designer.md`) from orchestration. Evidence: rendered screenshots at narrow and wide viewports, keyboard and assistive-technology checks when relevant, measured contrast, and Figma comparison when supplied.
- **Frontend** (components, forms, UI state) → `typescript.md` plus `react.md` or `vue-primevue.md`. Evidence: component tests, screenshots, accessibility selectors.
- **Backend** (services, APIs, data access, business rules) → `typescript.md`; `domain-module.md` when the convention is detected; `codebase-design`. Evidence: unit and integration tests.
- **Domain** (terminology, boundaries, decisions) → `domain-modeling`, `domain-module.md`. Evidence: `CONTEXT.md` and ADRs updated.
- **SRE** (CI, pipelines, infrastructure, secrets, releases) → `wizard` for human-only steps; `setup-pre-commit` and `fullstack-typescript-quality` for quality gates. Evidence: pipeline pass, `.agents/agent-config.json` checks.
- **Agent configuration** (skills, policy, `AGENTS.md`) → `writing-for-agents`. Evidence: the repository's own verify script.

## Exit

- **Coding task** (new behaviour, bug fix, refactor, tests, tooling or configuration change) → read `~/.agents/policy/orchestration.md` and run the task through its roles. Carry the routing result — packs, skills, topic evidence — into the task brief.
- **Non-coding task** (question, explanation, documentation-only edit) → answer directly with the routed packs and skills.
