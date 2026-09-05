---
name: fullstack-typescript-quality
description: Use when installing or auditing TypeScript web-app quality tooling.
version: 1.0.0
---

# Full-stack TypeScript quality

## Purpose

Install or audit a practical, deterministic quality stack for TypeScript web applications without duplicating test layers or making the fast development loop unusable.

## When to use

- Setting up or improving formatting, linting, type checking, tests, coverage, mutation testing, Git hooks, or CI.
- Migrating a repository to the shared `.agents/agent-config.json` quality contract.
- Auditing slow, flaky, duplicated, or low-signal agent verification.

Do not use this skill for ordinary feature work. Use existing repository commands and the local `AGENTS.md` instead.

## Discovery first

Before changing configuration, inspect:

1. `package.json`, lockfiles, runtime, package manager, and existing scripts.
2. TypeScript, ESLint, Prettier, Vitest, Cypress, coverage, mutation-test, Git-hook, and CI configuration.
3. Adjacent tests and the project architecture.
4. Existing test conventions and whether Cypress Component Testing is already the component-test authority.

Do not replace an established equivalent tool just to match this skill. Do not install a duplicate component-test runner by default.

## Target stack

| Concern | Default | Notes |
|---|---|---|
| Formatting | Prettier | Check in fast gate and CI. |
| Static analysis | ESLint | Prefer type-aware rules when viable. |
| Type safety | `tsc --noEmit` | Preserve strictness. |
| Pure domain/non-DOM composables | Vitest | Fast unit-test feedback. |
| Vue/PrimeVue component behaviour | Cypress Component Testing | Primary component-test layer when already used. |
| Critical user journeys | Cypress E2E | Keep the suite small and valuable. |
| Coverage | Unit-test coverage | Apply meaningful per-layer thresholds. |
| Branch count | ESLint `complexity` / `max-depth` | Warn at 10 / 3. Keep an existing equivalent. Reduction follows `complexity-audit`. |
| Mutation testing | Stryker on selected domain logic | Never pre-commit; targeted CI/nightly/manual hardening. |

## Test-layer rules

- Do not duplicate the same component behaviour in Vitest and Cypress CT by default.
- Use Vitest for pure functions and non-DOM composables.
- Use Cypress CT for browser-facing component behaviour, especially PrimeVue overlays, focus, keyboard interaction, validation, and rendering.
- Use Cypress E2E only for critical complete user journeys.
- Restrict Stryker to small, high-value, Vitest-covered logic such as permissions, pricing, state transitions, and validation.

## Required commands

Define project scripts with names matching the project where possible:

```text
format:check
lint
typecheck
test:unit
test:component
test:e2e
build
verify:fast
verify:full
test:mutation:domain
```

`verify:fast` must be fast enough to use frequently: formatting check, lint, typecheck, and relevant unit tests.

`verify:full` may include the build, required component tests, and selected E2E tests. It must not silently omit a failing quality layer.

## Tooling enforcement

Use deterministic tools for rules that should not rely on agent memory:

- strict TypeScript and `noImplicitAny` in `tsconfig`;
- `@typescript-eslint/no-explicit-any`;
- `@typescript-eslint/switch-exhaustiveness-check` where type-aware linting is configured;
- import/order or equivalent formatting/linting rules matching project conventions;
- CI checks that run independently of an agent;
- ESLint `complexity: ["warn", 10]` and `max-depth: ["warn", 3]`. Keep an already-configured equivalent (existing ESLint values, Sonar, or another branch-count check) instead of duplicating it. Reducing reported hotspots follows `complexity-audit`.

These rules are part of the stack, not optional taste. Do not add a custom rule simply to enforce a stylistic preference that the repository does not share.

## Routing contract

Create or update `.agents/agent-config.json`. It maps project commands and changed-file patterns to required verification. Use only commands that actually exist in `package.json` or the project task runner.

Example:

```json
{
  "version": 1,
  "runtime": "bun",
  "commands": {
    "fast": "bun run verify:fast",
    "unit": "bun run test:unit",
    "component": "bun run test:component",
    "e2e": "bun run test:e2e",
    "mutation": "bun run test:mutation:domain"
  },
  "routing": [
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

- Pre-commit hooks run fast checks only. Do not put Cypress CT, E2E, or mutation testing in pre-commit by default.
- CI runs relevant required checks, builds, and selected browser tests.
- A scheduled or manually triggered job runs domain-only mutation testing.
- Do not bypass checks, lower thresholds, or edit configuration to hide failures without explicit approval.

## Verification checklist

Before declaring the setup complete:

- [ ] Every declared script exists and exits successfully at least once.
- [ ] ESLint `complexity` and `max-depth` are configured, or an existing equivalent branch-count check is kept.
- [ ] A deliberate lint or type error is caught by the applicable configuration, then removed.
- [ ] Unit, component, and E2E commands have been run when configured.
- [ ] Coverage output is generated and exclusions are justified.
- [ ] Stryker is restricted to selected unit-tested domain paths and is not in pre-commit.
- [ ] Git hooks run only the intended fast gate.
- [ ] CI invokes the intended commands.
- [ ] `.agents/agent-config.json` names only real commands and routes relevant files correctly.
- [ ] No secrets, machine-specific absolute paths, or client-managed auth have been committed.
