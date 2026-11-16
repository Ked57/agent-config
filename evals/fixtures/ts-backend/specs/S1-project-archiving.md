# Spec #201: archive and restore projects

Customers finish projects and want them out of the way without losing them. Today the only option
is to leave them in the list forever; deleting tasks one by one loses the history. This spec adds
archiving: an archived project leaves the default project list, becomes read-only, and can be
restored.

- **Follow this issue.** Where it and older behaviour disagree, this issue wins.
- Done means `tsc --noEmit`, `eslint .`, `prettier --check .`, `vitest run` and
  `bun build src/index.ts --target bun` all pass.
- Write tests first. Every requirement below needs at least one test in `src/**/*.test.ts`.
- New errors use the `{ code, message }` shape the auth guard already uses. Tests check `code`.

---

## 1. Decisions

1. **Archiving is reversible.** Nothing is deleted or copied. Restoring returns the project exactly
   as it was.
2. **An archived project is read-only.** Its tasks can be read but not created, changed or deleted,
   by anyone, admins included.
3. **Only admins archive and restore.**
4. **A project with work in progress cannot be archived.** The admin finishes or resets those tasks
   first. There is no force flag.

## 2. Data

- A new drizzle-kit migration (do not edit `0000_init.sql`) adds two nullable columns to `projects`:
  - `archived_at` (integer, `timestamp_ms` mode), null while the project is active;
  - `archived_by` (text), the admin who archived it, a foreign key to `users.id` with
    `ON DELETE SET NULL`.
- Project JSON, everywhere a project is returned, gains `archivedAt` (ISO 8601 string or `null`)
  and `archivedBy` (user id or `null`). The list items gain both as well.

## 3. Requirements

- **R1.** `POST /api/projects/:id/archive` archives the project and returns `200` with the project
  JSON, `archivedAt` set to the current time and `archivedBy` set to the caller's id.
- **R2.** Only admins may archive or restore. A member gets `403` with code `forbidden`, and the
  project is unchanged.
- **R3.** A project that does not exist or belongs to another organization gives `404` with code
  `project_not_found` on archive and restore.
- **R4.** Archiving an already archived project gives `409` with code `already_archived`. The
  stored `archivedAt` and `archivedBy` keep their first values.
- **R5.** A project with at least one task in status `in_progress` cannot be archived: `409` with
  code `project_has_active_tasks` and `taskIds`, the ids of those tasks in creation order. Tasks in
  `todo` or `done` do not block archiving.
- **R6.** `POST /api/projects/:id/restore` clears both fields and returns `200` with the project
  JSON (`archivedAt: null`, `archivedBy: null`). Restoring a project that is not archived gives
  `409` with code `not_archived`.
- **R7.** `GET /api/projects` takes an optional `archived` query parameter:
  - absent or `false`: active projects only (the default changes: archived projects disappear);
  - `true`: archived projects only;
  - `all`: both.

  Any other value is a validation error (`422`, the framework's default for query validation).
  Ordering (by name) and `taskCounts` are unchanged and are computed for archived projects too.

- **R8.** `GET /api/projects/:id` and `GET /api/projects/:id/tasks` keep working for archived
  projects (`200`). `GET /api/tasks/:id` keeps working for tasks in archived projects.
- **R9.** Writes to an archived project's tasks are refused with `409` and code `project_archived`:
  - `POST /api/projects/:id/tasks`;
  - `PATCH /api/tasks/:id`, whatever the body, including a body that would change nothing;
  - `DELETE /api/tasks/:id` by an admin.

  Nothing is written and no assignment email is sent.

- **R10.** Check order on the task routes: a task or project outside the caller's organization is
  still `404`; a member deleting a task still gets `403`; only then does the archive rule apply. The
  archive rule comes before every other business rule, so an invalid status transition on an
  archived project's task is `409 project_archived`, not the transition error.
- **R11.** After a restore, the project's tasks can be created, changed and deleted again under the
  normal rules.

## 4. API contract

```
POST /api/projects/:id/archive   admin   200 Project | 403 forbidden | 404 project_not_found
                                         | 409 already_archived | 409 project_has_active_tasks
POST /api/projects/:id/restore   admin   200 Project | 403 forbidden | 404 project_not_found
                                         | 409 not_archived
GET  /api/projects?archived=false|true|all
```

```json
{
  "id": "prj_web",
  "orgId": "org_acme",
  "name": "Website relaunch",
  "description": "New marketing site",
  "createdAt": "2026-11-01T10:00:00.000Z",
  "archivedAt": "2026-11-16T09:30:00.000Z",
  "archivedBy": "usr_ada"
}
```

```json
{
  "code": "project_has_active_tasks",
  "message": "finish or reset 1 task first",
  "taskIds": ["tsk_2"]
}
```

## 5. Acceptance (tests first)

- Archive `prj_app` as an admin: it disappears from `GET /api/projects`, appears in
  `?archived=true` and `?archived=all`, and its task can still be read.
- Archive `prj_web` (it has `tsk_2` in progress): `409 project_has_active_tasks` with
  `taskIds: ["tsk_2"]`. Move `tsk_2` back to `todo`, then archiving succeeds.
- Every write route in R9 answers `409 project_archived` on an archived project, and the database
  is unchanged afterwards.
- Restore, then create, change and delete a task in that project.
- A member and another organization's admin get `403` and `404` on both new routes.

## 6. Out of scope

- Archiving or restoring individual tasks.
- Deleting projects.
- Bulk archive, scheduled archiving, or archiving from the billing webhook.
- Any change to the task status rules other than R9 and R10.
