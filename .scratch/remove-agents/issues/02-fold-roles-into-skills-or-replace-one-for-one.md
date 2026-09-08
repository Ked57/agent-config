Type: grilling

# Fold roles into skills or replace one-for-one

## Question

If role procedures move into skills, do they merge into skills that already cover the same job, or does each role become its own skill?

Overlap already in this repo:

| Role | Existing skill that already owns the job |
| --- | --- |
| Coder | `implement` (user-invoked) plus `tdd` / `diagnosing-bugs` for how to build |
| Reviewer | `code-review` (model-invoked) |
| Designer | `frontend-design` (original UI) and `figma-design-to-code` (exact spec) |
| Planner | none |
| Manual QA | none |

Coder and Reviewer are the sharpest duplicates: each role file is largely "load these skills, then return this report shape." Designer still has unique procedure (rulebook, `DESIGN.md`, persona walk) that `frontend-design` does not fully carry. Planner and Manual QA have no skill home.

Options:

- **Fold.** Unique role procedure lands in the overlapping skill; add skills only for Planner and Manual QA. Default recommendation: this is the "skills work better" cut, and it removes a parallel vocabulary.
- **One-for-one.** Five new skills named after the roles, native agents deleted. Faster mechanically, keeps the dual system in spirit.
- **Single coordinator skill.** One skill replaces `orchestration.md` and points at existing skills; no per-role skill files.

Recommended: **Fold.** Do not keep a Coder skill beside `implement`, or a Reviewer skill beside `code-review`.
