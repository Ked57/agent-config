# Spec #202: task dependencies and blocked tasks

Teams want to say "this task can't start until that one is done". Today they write it in the
description and people start blocked work anyway. This spec adds dependencies between tasks of the
same project, a derived `blocked` flag on every task, and a status rule that stops blocked tasks
from moving forward.

- **Follow this issue.** Where it and older behaviour disagree, this issue wins.
- Done means `tsc --noEmit`, `eslint .`, `prettier --check .`, `vitest run` and
  `bun build src/index.ts --target bun` all pass.
- Write tests first. Every requirement below needs at least one test in `src/**/*.test.ts`.
- New errors use the `{ code, message }` shape the auth guard already uses. Tests check `code` and
  the extra fields named below.

---

## 1. Decisions

1. **"A depends on B"** means A cannot start or finish until B is `done`. B is A's _blocker_; A is
   _blocked by_ B.
2. **`blocked` is derived, never stored.** A task is blocked while at least one of its blockers is
   not `done`. It changes as soon as a blocker's status changes, including when a finished blocker
   is reopened.
3. **Dependencies stay inside one project.** Cross-project links are refused, not silently allowed.
4. **The graph is acyclic.** A link that would close a cycle is refused and the cycle is reported.
5. **Any member of the organization** can add and remove dependencies. No admin rule.

## 2. Data

- A new drizzle-kit migration (do not edit `0000_init.sql`) creates `task_dependencies`:
  `task_id` (the dependent task), `depends_on_id` (the blocker), `created_by` (user id) and
  `created_at`, with primary key `(task_id, depends_on_id)`. Both task columns reference `tasks.id`
  with `ON DELETE CASCADE`.

## 3. Requirements

- **R1.** `POST /api/tasks/:id/dependencies` with `{ "dependsOnId": "<task id>" }` links the two
  tasks and returns `201` with `{ taskId, dependsOnId, createdAt }`. A body without a string
  `dependsOnId` is a validation error (`422`, the framework default).
- **R2.** `:id` that does not exist or belongs to another organization gives `404` with code
  `task_not_found`. A `dependsOnId` that does not exist or belongs to another organization gives
  `404` with code `dependency_not_found`.
- **R3.** A task cannot depend on itself: `422` with code `self_dependency`.
- **R4.** Both tasks must be in the same project: otherwise `422` with code
  `cross_project_dependency`.
- **R5.** Adding a link that already exists gives `409` with code `dependency_exists`.
- **R6.** Adding a link that would create a cycle, directly (B already depends on A) or through
  any chain, gives `409` with code `dependency_cycle` and `cycle`: the task ids along the cycle,
  starting and ending with `:id`, in the order `:id` → `dependsOnId` → … → `:id` following
  existing links. Nothing is stored.
- **R7.** A task can have at most 5 blockers. The sixth gives `409` with code
  `too_many_dependencies`.
- **R8.** `DELETE /api/tasks/:id/dependencies/:dependsOnId` removes the link: `204`. A link that
  does not exist gives `404` with code `dependency_not_found`; a task outside the caller's
  organization gives `404` with code `task_not_found`.
- **R9.** `GET /api/tasks/:id/dependencies` returns `200` with
  `{ blockedBy: [...], blocking: [...] }`. `blockedBy` lists the task's blockers, `blocking` the
  tasks that depend on it. Each entry is `{ id, title, status }`, sorted by the task's creation
  time. Another organization's task is `404 task_not_found`.
- **R10.** Every task JSON the API returns gains `blocked: boolean` (Decision 2): `GET /api/tasks/:id`,
  `GET /api/projects/:id/tasks`, `POST /api/projects/:id/tasks` and `PATCH /api/tasks/:id`.
- **R11.** A blocked task cannot move to `in_progress` or `done`: `PATCH` gives `409` with code
  `task_blocked` and `blockedBy`, the ids of the blockers that are not `done`, sorted by creation
  time. Nothing in that PATCH is applied. Moving a blocked task back to `todo`, and changing any
  other field without a status change, is allowed.
- **R12.** Adding a dependency to a task that is already `in_progress` or `done` is allowed and
  does not change its status. It reports `blocked: true` until the blocker is done.
- **R13.** Deleting a task removes every link it is part of, in both directions. Its former
  dependents stop being blocked by it.

## 4. API contract

```
POST   /api/tasks/:id/dependencies                201 | 404 task_not_found | 404 dependency_not_found
                                                  | 409 dependency_exists | 409 dependency_cycle
                                                  | 409 too_many_dependencies | 422 self_dependency
                                                  | 422 cross_project_dependency | 422 validation
DELETE /api/tasks/:id/dependencies/:dependsOnId   204 | 404 task_not_found | 404 dependency_not_found
GET    /api/tasks/:id/dependencies                200 | 404 task_not_found
PATCH  /api/tasks/:id                             existing responses, plus 409 task_blocked
```

```json
{
  "taskId": "tsk_3",
  "dependsOnId": "tsk_2",
  "createdAt": "2026-11-16T09:30:00.000Z"
}
```

```json
{
  "code": "dependency_cycle",
  "message": "tsk_2 already depends on tsk_3",
  "cycle": ["tsk_2", "tsk_3", "tsk_2"]
}
```

```json
{
  "blockedBy": [
    { "id": "tsk_2", "title": "Design homepage", "status": "in_progress" }
  ],
  "blocking": []
}
```

## 5. Acceptance (tests first)

- `tsk_3` depends on `tsk_2`: `tsk_3` reports `blocked: true` in every response that returns it,
  and `PATCH tsk_3 {status: "in_progress"}` is `409 task_blocked` with `blockedBy: ["tsk_2"]`.
- Finish `tsk_2`: `tsk_3` is no longer blocked and can start. Reopen `tsk_2`: `tsk_3` is blocked
  again.
- A three-task chain A → B → C, then C → A: `409 dependency_cycle` with `cycle: [C, A, B, C]`.
- Self, cross-project, duplicate, sixth blocker and other-organization links are refused with the
  codes above.
- Deleting a blocker unblocks its dependents.

## 6. Out of scope

- Dependencies across projects or organizations.
- Automatically changing a task's status when its blockers finish.
- Notifications about blocked or unblocked tasks.
- Ordering or scheduling tasks by dependency (no topological sort endpoint).
