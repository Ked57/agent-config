# Planted defects (private: not in `template/`, never shown to agents or judges)

Map of the legacy flaws the `backend-legacy` tasks depend on. Each one is a plausible legacy defect;
none breaks an existing test or gate on the untouched template.

| Flaw | Where | Used by | Notes |
|---|---|---|---|
| `addMonths` keeps the day of month without clamping (Jan 31 + 1 month = "Feb 31"), although its doc comment promises clamping | `src/lib/legacy/dates.ts` | G1 | Callers: invoice due dates on `next_month` terms (`dueDateFor`), the next draft of a monthly invoice (`issueInvoice`), the next occurrence of a monthly task (`services/tasks.ts`). The symptom is two hops away: `formatDay` throws in the invoice CSV export and the v1 invoice report. Existing tests only cover mid-month dates. |
| `dayKey` takes the UTC date (`toISOString().slice(0, 10)`), with a stale TODO saying all customers are in Europe | `src/lib/legacy/dates.ts` | G2 | Consumers: v2 weekly timesheet (also selects the week by UTC midnights), v1 timesheet and the payroll CSV built on it, the time-entry `day` field, the `?date=` filter (duplicated as SQLite `date(started_at/1000,'unixepoch')` in `sql/time-entries.sql.ts`), the time-entry CSV export (day column and from/to range), invoice line descriptions. `src/lib/time.ts` already has a correct `zonedDay` that only tests use. The existing export test pins the UTC behaviour for Sam's seeded entry. |
| `toCents` floors `amount * 100` (19.99 becomes 1998) | `src/lib/legacy/money.ts` | G3, G7 | Used by the payments controller, the billing webhook and the invoice total (`insertInvoice` sums lines in major units then floors: a single 1999-cent line totals 1998). The bugs cancel out for "invoice paid" status. |
| Payments idempotency is check-then-store | `src/lib/legacy/idempotency.ts`, `controllers/payments.controller.ts` | G3 | Copying it for refunds breaks concurrent retries with the same key. |
| No index on `time_entries.task_id`/`project_id`; project report is N+1+1 (per task: entries, labels; per entry: user) | `services/reports.ts` `projectReport` | G5 | Output quirks a rewrite can change: tasks and labels sorted with `localeCompare` (SQL sorts binary), money rounded per entry, people sorted by minutes then name. |
| `/api/clients` deviates from `docs/openapi.yaml` | `routes/clients.ts` | G6 | `{items,total}` instead of `{data,page}`, no pagination, `terms: "NET30"` instead of `paymentTerms`, epoch-ms times, null fields omitted, `orgId` leaked, lower-case currency accepted, 200 on create, Elysia 422 bodies, plain-text 404, 500 on delete of a client in use, archive leaves `archivedAt` unset. |
| Drizzle's `db.get(sql\`...\`)` throws on libSQL when no row matches, so every raw-SQL "not found" is a 500 | `src/sql/*.sql.ts` | G4 | Found while building G4, kept: adding an org filter to a raw-SQL lookup turns a leak into a 500, which the prompt's "404" rules out. Also hits POST comments on a foreign task and PATCH/DELETE of unknown time entries today. |
| Stale docs | `docs/architecture.md` | G4, G8 | Says v1 reports were removed in 2022 (still mounted), that Slack goes through `services/slack.ts` (dead), that every query filters by org (the invariant G4 relies on). |
| Dead code | `services/slack.ts`, `splitEvenly` and `toDay` in legacy helpers | none | Realism only. |

## G4 holes (8)

1. `GET /api/tasks/:id`: `getTask` without org (new-style service).
2. `GET /api/tasks/:id/comments`: nested list never checks the task's org (controller + raw SQL).
3. `GET /api/users/:id`: raw-SQL `findUserById` without org.
4. `GET /api/time-entries?userId=`: the user filter replaces the org filter (raw SQL builder).
5. `GET /api/exports/time-entries.csv?projectId=`: the project filter replaces the org filter.
6. `PATCH /api/webhook-subscriptions/:id`: update by id only (a mutation: redirects another org's webhooks).
7. `GET /api/v1/reports/projects/:id/summary`: deprecated v1 module, raw SQL without org.
8. `GET /api/attachments/:id`: metadata plus a signed download link by id only.

Not holes (checked): projects, labels, invoices, payments, ledger, clients, notifications, audit,
time-entry PATCH/DELETE, comment DELETE, attachment list/DELETE, webhook DELETE, task PATCH/DELETE.

## Not tested on purpose

- G1: invoices already stored with an impossible due date in production. A data repair is the right
  call, but the hidden test cannot seed pre-migration rows, and "make formatDay tolerant" would be
  the wrong fix to reward.
- G2: a person changing time zone later (old entries would move).
