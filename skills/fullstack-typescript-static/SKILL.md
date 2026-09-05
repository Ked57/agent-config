---
name: fullstack-typescript-static
description: Loaded by fullstack-typescript-quality for ESLint complexity, Halstead, line limits, no-explicit-any, and Knip gates.
version: 1.0.0
---

# Full-stack TypeScript static analysis

Owned by `fullstack-typescript-quality`, which loads this skill for lint and dead-code gates. Keep rules here; point orchestration, commands, Git/CI, and the shared checklist back to the parent.

## ESLint gates

Apply to `*.ts` and to pure TypeScript / `<script>` blocks in React and Vue sources:

- Cyclomatic complexity under 22 (`complexity` with `max: 21`).
- Cognitive complexity under 22: reuse an existing single-rule cognitive plugin when present; otherwise enable only `sonarjs/cognitive-complexity` (threshold `21`) without the Sonar recommended suite and without a SonarQube server.
- Halstead via `quality-metrics/halstead`: configure `maxVolume` and `maxEffort` co-thresholds the plugin supports. The rule reports Difficulty; treat reported Difficulty ≥ 80 as failure when auditing or installing. Do not invent a `maxDifficulty` option.
- File length under 500 lines (`max-lines` with `max: 499`) and function length under 100 lines (`max-lines-per-function` with `max: 99`).
- `@typescript-eslint/no-explicit-any`, allowing `unknown`.

## Knip

Configure Knip for dead code and use its full capability set (unused files, exports, dependencies, and related findings it supports). Wire Knip into `verify:full` and CI through the parent skill; keep it out of pre-commit and `verify:fast` by default.
