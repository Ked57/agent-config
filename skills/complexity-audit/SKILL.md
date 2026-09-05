---
name: complexity-audit
description: Use when auditing or reducing cyclomatic complexity, nested branching, guard-clause flattening, or simplifying a function that is hard to test because of too many paths. Do not use for ordinary feature work or for architectural module deepening; use improve-codebase-architecture for that.
---

# Complexity audit

Measure branching with a tool, then reduce it with behaviour-preserving refactorings. Hand-counting `if`s is a last resort and must be labelled an estimate.

For architectural depth (shallow modules, seams, locality) follow `improve-codebase-architecture` and `codebase-design` instead.

## When this is the task

Use this skill when the request is to audit, report, or reduce cyclomatic complexity, nesting, path count, or a function that is hard to test because of branches.

Do not use it to extract helpers during ordinary feature work, or to split a module whose problem is shallowness rather than branching.

## 1. Measure

Prefer an existing repository command. Inspect ESLint `complexity` / `max-depth`, Sonar, or an equivalent configured check first.

If none is configured, use a language tool that emits machine-readable metrics:

- TypeScript/JavaScript: ESLint with `{ "complexity": ["warn", 10] }` on the target files when ESLint is already a project dependency; otherwise `lizard` if installed (`lizard -l javascript -l typescript -C 10`).
- Python: `radon cc` when available; otherwise `lizard`.
- Other languages: `lizard` when available.

Record, per function that exceeds the local threshold (default CC 10, nesting 3): file, name, cyclomatic complexity, nesting depth, parameter count, and non-comment LOC.

Completion of this step: every reported number came from a tool, or the report explicitly marks remaining figures as estimates and says why the tool could not run.

## 2. Decide whether to change code

If the user asked only for an audit, stop after the report. Rank hotspots by CC, then nesting, then how often the file changes.

If the user asked to reduce complexity, continue. Do not refactor a unit whose tests do not cover the behaviour you will touch. Write or extend those tests first. Follow `tdd` when adding them.

Apply the `codebase-design` deletion test to any extract: if deleting the new function would not reappear complexity across callers, skip the extract.

## 3. Reduce, in this order

Work one hotspot at a time. Each step must compile and keep tests green.

1. **Guard clauses** — flatten nesting with early returns.
2. **Decompose conditionals** — name boolean expressions that have more than two operators.
3. **Extract method** — pull a block that does one job; the extracted name says why it exists.
4. **Dispatch table** — replace a primitive `switch`/`if` chain whose arms are short.
5. **Polymorphism or strategy** — only when the same type/role switch repeats and the arms are behaviour, not data.

Do not extract a pass-through. Do not bundle unrelated extracts in one commit if the repository expects small commits.

For TypeScript and JavaScript before/after shapes, read [references/typescript-before-after.md](references/typescript-before-after.md).

Quantify the change: old CC / nesting → new CC / nesting for the outer function and each extract.

## 4. Stop

Completion requires:

- metrics from a tool (or labelled estimates);
- tests covering the touched behaviour, still passing;
- no new abstraction that fails the deletion test;
- a short report of remaining hotspots above threshold, if any.

This skill does not write lint config during an audit. Persistent ESLint complexity gates are required by `fullstack-typescript-static` (loaded by `fullstack-typescript-quality`) when that stack is installing or auditing.
