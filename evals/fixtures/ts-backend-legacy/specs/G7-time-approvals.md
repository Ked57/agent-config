# #312 Approve time before it is invoiced

## Context

Agencies bill clients from logged time. Today any billable time entry can go straight onto an
invoice, so mistakes (a wrong project, a forgotten timer) reach clients. Managers want to approve
time first. The `timeApprovals` feature flag already exists in `src/lib/flags.ts` but nothing reads
it. Time entries live in the old controller (`/api/time-entries`); invoices, reports, the audit
log and notifications are newer services. The deprecated v1 timesheet must keep working: payroll
still exports from it.

## Requirements

- **R1** Every time entry has an approval state: `approval` is `"pending"`, `"approved"` or
  `"rejected"`, with `approvedBy` (the approving user's id, else `null`) and `rejectionReason`
  (else `null`). The three fields appear wherever `/api/time-entries` returns an entry. New
  entries start `"pending"`.
- **R2** `POST /api/time-entries/:id/approve` (admins only) approves an entry and records the
  approver; it answers 200 with the entry. Approving an approved entry changes nothing and also
  answers 200.
- **R3** `POST /api/time-entries/:id/reject` (admins only) with `{ "reason": "<1 to 500 characters>" }`
  rejects an entry and answers 200 with it. A missing or blank reason is a 400.
- **R4** An entry that is already on an invoice can be neither approved nor rejected: 409.
- **R5** Changing an approved or rejected entry (`PATCH /api/time-entries/:id`) puts it back to
  `"pending"` and clears `approvedBy` and `rejectionReason`.
- **R6** `POST /api/time-entries/approve` with `{ "ids": [...] }` (admins only, 1 to 200 ids)
  approves several entries at once, all or nothing: if any id is unknown it answers 404, if any
  entry is invoiced 409, and then nothing changes. On success it answers 200 with
  `{ "approved": <number of ids> }`.
- **R7** When the organization's `timeApprovals` flag is on, `POST /api/invoices` with
  `timeEntryIds` only accepts approved entries. Otherwise it answers 409 with
  `{ "code": "unapproved_time", "message": "...", "entryIds": [<the ids that are not approved>] }`
  and creates nothing. With the flag off, invoicing works exactly as today.
- **R8** An invoice's `totalCents` is exactly the sum of its lines' `amountCents`, and a time line's
  amount is the entry's minutes at the hourly rate, rounded to the cent (as today).
- **R9** Approving and rejecting are audited: actions `time_entry.approved` and
  `time_entry.rejected`, entity type `time_entry`, entity id the entry, actor the admin; a
  rejection's audit data includes the `reason`. Bulk approval writes one event per entry.
- **R10** Rejecting notifies the person who logged the entry: a notification of kind
  `time_entry.rejected` with payload `{ "timeEntryId", "reason" }`.
- **R11** Timesheets show approved time: each person in `GET /api/reports/timesheet` gets
  `approvedMinutes` (their approved minutes in that week), and each row of the deprecated
  `GET /api/v1/reports/timesheet` gets `approved_hours`, formatted like `hours`. Nothing else in
  either response changes.
- **R12** `GET /api/time-entries?approval=pending|approved|rejected` filters by state; any other
  value is a 400.
- **R13** Entries that are already on an invoice count as approved, both in existing databases
  (the migration) and in the development seed. Every other existing entry starts pending.

## API contract

```http
POST /api/time-entries/te_123/reject
Authorization: Bearer <admin token>
Content-Type: application/json

{ "reason": "Wrong project, please move to Mobile app" }
```

```json
{ "id": "te_123", "approval": "rejected", "approvedBy": null,
  "rejectionReason": "Wrong project, please move to Mobile app", "minutes": 90, "...": "..." }
```

Errors keep the style of the module they come from: `{ "error": "..." }` from the time-entry
controller, `{ "code", "message" }` from invoices. Other organizations' entries are 404.

## Acceptance criteria

- Tests cover every requirement; the requirement → test mapping is in the PR description.
- A migration adds the new columns with the R13 backfill; `0000_init.sql` is untouched.
- Typecheck, lint, format, the full test suite and the build pass.

## Out of scope

- Approval by anyone other than an admin; per-project approvers.
- Undoing an approval other than by editing the entry (R5).
- Email for rejections (in-app notification only).
- Any UI.
