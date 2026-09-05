---
name: fullstack-typescript-mutation
description: Loaded by fullstack-typescript-quality for Stryker mutation testing on pure TypeScript.
version: 1.0.0
---

# Full-stack TypeScript mutation testing

Owned by `fullstack-typescript-quality`, which loads this skill for mutation gates. Keep rules here; point orchestration, commands, Git/CI, and the shared checklist back to the parent.

## Scope

- Run Stryker on pure TypeScript only (domain and other high-value Vitest-covered logic such as permissions, pricing, state transitions, and validation).
- Keep mutation testing out of pre-commit and `verify:fast`.
- Wire it to CI, a nightly job, or a manual/scheduled command (for example `test:mutation:domain`).
