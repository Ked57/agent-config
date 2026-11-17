# Spec #203: audit log of every change

Admins keep asking "who changed this task?" and "when did these credits arrive?", and support has
no answer beyond the request log, which has neither the actor nor the values. This spec records an
audit event for every change the API makes and gives admins a filtered query endpoint.

- **Follow this issue.** Where it and older behaviour disagree, this issue wins.
- Done means `tsc --noEmit`, `eslint .`, `prettier --check .`, `vitest run` and
  `bun build src/index.ts --target bun` all pass.
- Write tests first. Every requirement below needs at least one test in `src/**/*.test.ts`.
- New errors use the `{ code, message }` shape the auth guard already uses.

---

## 1. Decisions

1. **One event per successful change, written with the change.** The event and the change commit
   in the same database transaction, or neither does.
2. **Events hold values, not secrets.** No token, token hash or password hash ever goes into an
   event.
3. **Only changes are audited.** Reads, refused requests and requests that change nothing write no
   event. Seeding and migrations are not audited.
4. **Admins read their own organization's events.** Members cannot read the log.

## 2. Data

- A new drizzle-kit migration (do not edit `0000_init.sql`) creates `audit_events`:
  - `id` integer primary key, autoincrement (it also orders events);
  - `org_id`, `actor_id` (null for the billing webhook), `action`, `entity_type`, `entity_id`;
  - `changes` (JSON text) and `created_at` (`timestamp_ms`).

## 3. Requirements

- **R1.** Each of these successful requests writes exactly one event:

  | Request                             | `action`            | `entityType`   | `entityId` | `actorId` |
  | ----------------------------------- | ------------------- | -------------- | ---------- | --------- |
  | `POST /api/projects`                | `project.created`   | `project`      | project id | caller    |
  | `POST /api/projects/:id/tasks`      | `task.created`      | `task`         | task id    | caller    |
  | `PATCH /api/tasks/:id`              | `task.updated`      | `task`         | task id    | caller    |
  | `DELETE /api/tasks/:id`             | `task.deleted`      | `task`         | task id    | caller    |
  | `POST /api/auth/token`              | `auth.token_issued` | `user`         | user id    | that user |
  | `POST /api/webhooks/billing` credit | `org.credits_added` | `organization` | org id     | `null`    |

  The event belongs to the organization the entity belongs to.

- **R2.** `changes` maps each field to `{ "from": …, "to": … }`. The tracked fields are `title`,
  `description`, `status`, `isUrgent`, `assigneeId`, `dueDate` and `projectId` for tasks, `name`
  and `description` for projects, and `credits` for organizations.
  - created: every tracked field whose new value is not `null`, with `from: null`;
  - updated: only the tracked fields whose value actually changed (`updatedAt` is never listed);
  - deleted: every tracked field whose old value was not `null`, with `to: null`;
  - `auth.token_issued`: `{}`.
- **R3.** A `PATCH` that changes no tracked field (an empty body, or the same values again) writes
  no event.
- **R4.** A refused request (any `4xx`) writes no event: for example a forbidden delete, an invalid
  status transition or a foreign assignee.
- **R5.** The billing webhook writes `org.credits_added` with `changes.credits` holding the balance
  before and after. An event for an unknown organization, or one adding 0 credits, changes nothing
  and writes no event.
- **R6.** The change and its event are atomic (Decision 1). If the event cannot be written, the
  request fails with `500` and the change is not kept. Assignment emails are sent only after the
  transaction committed.
- **R7.** No event ever contains the issued token, a token hash or a password hash (Decision 2).
- **R8.** `GET /api/audit-events` is for admins: a member gets `403` with code `forbidden`. It
  returns `200` with `{ items: [...] }`, only the caller's organization's events, newest first
  (descending `id`). A freshly seeded database has no events.
- **R9.** Optional query filters, combined with AND: `action`, `entityType`, `entityId`,
  `actorId`, `since` and `until`. `since` and `until` are ISO 8601 date-times compared with
  `createdAt`; `since` is inclusive and `until` exclusive. A `since` or `until` that is not a valid
  date-time is a validation error (`422`).
- **R10.** `limit` (integer, default 50, minimum 1, maximum 200) caps the number of items, keeping
  the newest. Out of range is a validation error (`422`).

## 4. API contract

```
GET /api/audit-events?action=&entityType=&entityId=&actorId=&since=&until=&limit=
    admin   200 { items: AuditEvent[] } | 403 forbidden | 422 validation
```

```json
{
  "items": [
    {
      "id": 7,
      "action": "task.updated",
      "entityType": "task",
      "entityId": "tsk_3",
      "actorId": "usr_bob",
      "changes": {
        "status": { "from": "todo", "to": "in_progress" },
        "dueDate": { "from": null, "to": "2026-12-01" }
      },
      "createdAt": "2026-11-16T09:30:00.000Z"
    }
  ]
}
```

## 5. Acceptance (tests first)

- Create, update and delete a task: three events, newest first, with exactly the `changes` of R2.
- A PATCH that changes nothing and a PATCH refused with `409` write nothing.
- A login writes `auth.token_issued` with `changes: {}`; the token appears nowhere in the log.
- A billing webhook for Globex is visible to Globex's admin only, with `actorId: null`.
- With the `audit_events` table unavailable, a task update returns `500` and the task is
  unchanged.
- Every filter, and `limit`, narrows the result as described.

## 6. Out of scope

- Auditing reads or failed logins.
- Retention, export or deletion of events.
- A UI, webhooks or notifications on events.
- Pagination beyond `limit`.
