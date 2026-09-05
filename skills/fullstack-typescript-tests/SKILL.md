---
name: fullstack-typescript-tests
description: Loaded by fullstack-typescript-quality for Vitest, Cypress component tests, coverage, and CRAP gates.
version: 1.0.0
---

# Full-stack TypeScript tests

Owned by `fullstack-typescript-quality`, which loads this skill for test and coverage gates. Keep rules here; point orchestration, commands, Git/CI, and the shared checklist back to the parent.

## Test layers

- Vitest for pure TypeScript (functions, non-DOM composables, domain and application logic).
- Cypress Component Testing plus Testing Library for `.tsx` / `.vue` component behaviour.
- One owner per behaviour: keep the same component behaviour out of both Vitest and Cypress CT by default.
- Cypress E2E only for critical complete user journeys.

## Coverage

Require 100% coverage for components, pages, domain, and application code. Code outside those layers may be ignored with an explicit justification. Count both Vitest coverage and Cypress CT coverage toward the gate when both runners exist.

## CRAP

Enforce CRAP below 25 with the `crap-typescript` Vitest adapter (`@barney-media/crap-typescript-vitest` or the project's equivalent), passing `threshold: 25` explicitly.
