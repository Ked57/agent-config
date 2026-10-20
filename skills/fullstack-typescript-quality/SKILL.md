---
name: fullstack-typescript-quality
description: Use when installing or auditing TypeScript web-app quality tooling.
version: 1.0.0
---

# Full-stack TypeScript quality

Install or audit a practical, deterministic quality stack for TypeScript web apps. Orchestration is all this skill owns. Static analysis belongs to `fullstack-typescript-static`, tests and coverage to `fullstack-typescript-tests`, mutation testing to `fullstack-typescript-mutation`. Never duplicate or override their rules here.

## Discovery first

Before changing configuration, inspect:

1. `package.json`, lockfiles, runtime, package manager, and existing scripts.
2. TypeScript, ESLint, Prettier, Vitest, Cypress, coverage, mutation-test, Knip, Git-hook, and CI configuration.
3. Adjacent tests and the project architecture.
4. Existing test conventions and whether Cypress Component Testing is already the component-test authority.

Keep an established equivalent tool. Add tools or compiler flags only as part of an explicit
quality-tooling task after this discovery; framework rules alone do not authorise a migration.

## Load sibling owners first

Before any tooling change, load and apply every available owner below. Take each owner's thresholds, commands, and verification checks from that skill.

1. `fullstack-typescript-static`
2. `fullstack-typescript-tests`
3. `fullstack-typescript-mutation`

If an owning skill is unavailable, mark that layer unmet, name it, and continue. Do not recreate its rules from memory.

## Target stack

| Concern | Default | Owner |
|---|---|---|
| Formatting | Prettier | this skill (fast gate) |
| Static analysis | ESLint + Knip | `fullstack-typescript-static` |
| Type safety | `tsc --noEmit`; `vue-tsc --noEmit` for Vue SFCs | this skill (fast gate) |
| Pure TS unit tests | Vitest | `fullstack-typescript-tests` |
| Component behaviour | Cypress CT + Testing Library | `fullstack-typescript-tests` |
| Critical journeys | Cypress E2E | `fullstack-typescript-tests` |
| Coverage and CRAP | Vitest / Cypress CT coverage | `fullstack-typescript-tests` |
| Branch count | ESLint complexity gates | `fullstack-typescript-static` |
| Mutation testing | Stryker on selected pure TS | `fullstack-typescript-mutation` |

## Required commands

Prefer these script names when the project allows:

```text
format:check
lint
typecheck
test:unit
test:component
test:e2e
knip
build
verify:fast
verify:full
test:mutation:domain
```

`verify:fast` stays frequent: formatting check, lint, typecheck, and relevant unit tests.

Run the repository's required full gate before completion. `verify:full` may include the build, required component tests, selected E2E, Knip, and coverage/CRAP gates. It must not silently omit a failing quality layer. Put Knip in `verify:full` and CI, not in pre-commit or `verify:fast` by default.

## Routing contract

Create or update `.agents/agent-config.json`. Map only commands that exist in `package.json` or the project task runner. Cover source,
tests, configuration, root tooling, and package-local file types with required routes;
keep a baseline route for inputs outside specialised patterns. Prove that typecheck
includes the changed file kinds (Vue scripts and templates need `vue-tsc`-backed checking;
a transpilation-only build is insufficient). Treat a missing or skipped check, an
uncovered input, or a controlled violation that passes as an unmet gate.

Example:

```json
{
  "version": 1,
  "runtime": "bun",
  "commands": {
    "fast": "bun run verify:fast",
    "full": "bun run verify:full",
    "unit": "bun run test:unit",
    "component": "bun run test:component",
    "e2e": "bun run test:e2e",
    "knip": "bun run knip",
    "mutation": "bun run test:mutation:domain"
  },
  "routing": [
    {
      "match": ["**/*"],
      "required": ["full"]
    },
    {
      "match": ["src/domain/**", "src/lib/permissions/**"],
      "required": ["unit", "fast"],
      "recommended": ["mutation"]
    },
    {
      "match": ["**/*.vue"],
      "required": ["component", "fast"]
    }
  ]
}
```

## Git and CI

- Pre-commit hooks run fast checks only. Keep Cypress CT, E2E, Knip, and mutation testing out of pre-commit by default.
- CI runs relevant required checks, builds, Knip, and selected browser tests. For changed critical journeys, execute the existing production build and selected browser journey; unit coverage alone does not exercise bundling, routing, or hydration.
- A scheduled or manually triggered job runs domain-only mutation testing.
- Require explicit approval before bypassing checks, lowering thresholds, or editing configuration to hide failures.

## Verification checklist

Before declaring the setup complete:

- [ ] Every required command maps to a real script or task and runs successfully without skipped required layers; `check` validates registration, not execution.
- [ ] Sibling owners were loaded and their gates applied.
- [ ] Controlled violations prove each configured gate rejects its claimed failure class, then are removed; typecheck includes all relevant file kinds.
- [ ] Unit, component, and E2E commands have been run when configured, including the sibling test owner's temporal regressions for changed async UI.
- [ ] Coverage and CRAP output are generated; exclusions are justified.
- [ ] Knip runs in `verify:full` / CI and stays out of the fast gate by default.
- [ ] Git hooks run only the intended fast gate.
- [ ] CI invokes the intended commands.
- [ ] `.agents/agent-config.json` names only real commands and routes relevant files correctly.
- [ ] No secrets, machine-specific absolute paths, or client-managed auth have been committed.
