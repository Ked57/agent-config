# Core completion contract

## Definition of done

Do not report implementation work complete until:

1. The requested behaviour is implemented or the reported defect is resolved.
2. Relevant automated checks have passed.
3. Changed behaviour has appropriate regression coverage, following repository conventions.
4. Required manual or browser verification has been performed when the environment and tooling allow it.
5. Known limitations, unverified paths, or external blockers are stated explicitly.

Do not claim manual verification was performed when it was not.

## Execution and verification

- Work through implementation, verification, and repair; do not stop at a plan or partial change.
- Prefer the smallest change that satisfies the current requirement.
- Fix failures introduced by the change before moving on.
- Use existing repository scripts and test conventions; do not invent replacement commands when the repository already defines them.
- Run narrow, relevant checks during implementation, then the required project quality gate before completion.
- Do not weaken tests, coverage thresholds, lint configuration, type checks, or CI configuration merely to make a change pass.
- Do not bypass Git or quality checks unless explicitly authorised.
- Do not refactor unrelated code unless requested or required to make the requested change safe.

## Simplicity and anti-slop

- Follow existing local patterns before introducing a new abstraction.
- Do not add speculative flexibility, configuration, feature flags, fallback paths, compatibility layers, or generic utilities without a present use case.
- Do not create wrappers that merely rename or forward an existing API.
- Extract a helper, composable, service, factory, or shared component only for genuine reuse, a clear domain boundary, or a meaningful simplification.
- Prefer direct, readable control flow over clever chained transformations or premature generic code.
- Add comments for non-obvious decisions, invariants, constraints, and external-workaround reasons—not to narrate obvious code.
- If two solutions are viable, choose the one with fewer concepts, files, dependencies, and runtime paths unless the more complex option has a demonstrated benefit.

## Repository discovery and safety

- Before introducing a new module, composable, domain, validation approach, test convention, or UI primitive, inspect adjacent code and reuse the existing pattern where one exists.
- Inspect existing dependencies and local patterns before adding a package. Do not add, replace, or upgrade dependencies solely to fit a preferred pattern.
- Treat generated files, lockfiles, migrations, environment variables, and public API contracts as deliberate changes; update them only when the task requires it.
- Keep secrets out of source, tests, fixtures, logs, and agent configuration.
- For quality-stack installation, upgrades, or audits, follow the `fullstack-typescript-quality` skill when it is available.

## Conditional guidance

Read a conditional policy pack only when it is installed in `.agents/policy/` and
matches the files or framework you are changing:

- `typescript.md` for TypeScript or TSX source.
- `react.md` for React JSX or TSX source.
- `vue-primevue.md` for Vue components, composables, PrimeVue UI, or Vue forms.
- `domain-module.md` only when the repository already uses the four-file domain convention or the user requests it.

Use `.agents/agent-config.json` to identify the required verification for changed files.
