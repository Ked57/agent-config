# #340 Retire the v1 reports module

## Context

`docs/architecture.md` says the v1 reports were removed in 2022. They weren't: the old controller
(`src/controllers/reports-v1.controller.ts`) and its raw SQL (`src/sql/reports.sql.ts`) are still
mounted under `/api/v1/reports`, the payroll CSV export builds on them, and so does the Monday
digest job. Two report implementations drift apart (the IDOR fixed last quarter only landed in
v2). We want one: `src/services/reports.ts`.

The old mobile app still calls the three v1 endpoints and parses their responses with a strict,
hand-written parser, and the payroll provider imports our CSV byte for byte. So the outputs must
not change, quirks included.

## Requirements

- **R1** Delete `src/controllers/reports-v1.controller.ts` and `src/sql/reports.sql.ts`. Nothing
  may import them afterwards (tests included).
- **R2** These endpoints keep their paths, auth and status codes and stay **byte-compatible**: the
  same response body, byte for byte, for the same data:
  - `GET /api/v1/reports/timesheet?week=<any day of the week>`
  - `GET /api/v1/reports/projects/:id/summary`
  - `GET /api/v1/reports/invoices`

  The one exception: an unknown project, or another organization's project, must answer 404
  `{"error":"project not found"}` (today it is a 500 or another org's data).
- **R3** The v1 endpoints are served from the report service in `src/services/reports.ts` through a
  thin compatibility layer. The v2 endpoints (`/api/reports/*`) do not change.
- **R4** The payroll export (`GET /api/exports/payroll.csv`) and the `digest.weekly` job (run by
  `runDueJobs` in `src/services/jobs.ts`) produce exactly what they produce today, but no longer
  depend on the v1 module.
- **R5** Keep the audit trail: every successful v1 call still writes the `report.v1_viewed` audit
  event with the same entity type, entity id and data as today.
- **R6** Every v1 response carries the header `Deprecation: true`.
- **R7** Update `docs/architecture.md` so it says what is true.

## Quirks the mobile app and payroll depend on

These are part of the contract (R2, R4). Look at the current code for the exact behaviour.

1. snake_case keys, days as `DD/MM/YYYY`, hours as strings with two decimals.
2. Timesheet rows are one per person and day, people ordered by name **byte by byte** (SQLite's
   default ordering, so `"Zoë"` comes before `"adam"`), each person's days in date order. Days are
   UTC days.
3. `total_hours` formats the week's total minutes once; it is not the sum of the rounded rows.
4. The project summary's `amount` is a number in major units: the exact sum of
   minutes × rate / 60 over billable entries, rounded to the cent once at the end. It is not the
   sum of per-entry rounded amounts that `/api/reports/projects/:id` uses.
5. Invoice amounts (`total`, `paid`) are plain numbers in major units (`100.1`, not `"100.10"`);
   only issued and paid invoices are listed, by due date then number; `days_overdue` is 0 for paid
   invoices and invoices not yet due.

## Acceptance criteria

- Tests pin the v1 responses, the payroll CSV and the digest before the move and still pass after
  it; the requirement → test mapping is in the PR description.
- Typecheck, lint, format, the full test suite and the build pass.

## Out of scope

- Removing the v1 endpoints themselves (the mobile app sunset is a separate issue).
- Changing any v2 response, the timesheet's UTC days (see #298), or the payroll CSV format.
- New report features.
