# Spec #204: bulk import of tasks (JSON and CSV)

Teams moving over from spreadsheets create hundreds of tasks by hand. This spec adds one endpoint
that imports many tasks into a project at once, from JSON rows or CSV text, validates every row,
and either imports what it can (partial mode) or nothing at all (atomic mode).

- **Follow this issue.** Where it and older behaviour disagree, this issue wins.
- Done means `tsc --noEmit`, `eslint .`, `prettier --check .`, `vitest run` and
  `bun build src/index.ts --target bun` all pass.
- Write tests first. Every requirement below needs at least one test in `src/**/*.test.ts`.
- New errors use the `{ code, message }` shape the auth guard already uses.
- No new dependencies: the CSV reader is small and lives in `src/lib/`.

---

## 1. Decisions

1. **Row problems are data, not request errors.** A bad row never fails request validation; it is
   reported in `failed` with its row number and every problem found.
2. **Two modes.** `partial` (the default) creates the valid rows and reports the rest. `atomic`
   creates all rows or none.
3. **Same rules as creating one task**, plus duplicate detection, so an import never creates a
   task the API would have refused.
4. **One email per assignee per import**, not one per task.

## 2. Requirements

- **R1.** `POST /api/projects/:id/tasks/import` is open to every member of the project's
  organization. Another organization's or an unknown project gives `404` with code
  `project_not_found`.
- **R2.** The body is `{ mode?, rows?, csv? }` with `mode` `"partial"` or `"atomic"`. Exactly one
  of `rows` (an array of objects) and `csv` (a string) must be present; otherwise `422` with code
  `invalid_import`. A `mode` other than the two values is a validation error (`422`).
- **R3.** An import has 1 to 200 rows. No rows (an empty array, or CSV with only a header) gives
  `422` with code `no_rows`. More than 200 gives `413` with code `too_many_rows`. Nothing is
  created in either case.
- **R4.** Each row has the fields `title`, `description`, `status`, `isUrgent`, `assigneeEmail` and
  `dueDate`. JSON rows ignore other keys. Each field is checked, and every problem is reported as
  `{ field, code }`, in this order:
  1. `title`: a string, stored trimmed, 1 to 200 characters after trimming. Missing, blank or not a
     string gives `title_required`; longer gives `title_too_long`.
  2. `description`: optional string, at most 5000 characters, else `description_too_long`.
  3. `status`: optional, `todo` (default), `in_progress` or `done`, else `invalid_status`. Rows may
     start in any of the three; the transition rules of `PATCH` do not apply.
  4. `isUrgent`: optional boolean, default `false`, else `invalid_is_urgent`.
  5. `assigneeEmail`: optional; matched to a user of the caller's organization, trimmed and
     case-insensitive. No match (including users of other organizations) gives `unknown_assignee`.
  6. `dueDate`: optional `YYYY-MM-DD` that is a real calendar date (`2026-02-30` is not), else
     `invalid_due_date`.
  7. A row with status `done` and no `assigneeEmail` gives `assignee_required_for_done` on field
     `assigneeEmail`.
  8. A title equal, after trimming and ignoring case, to an existing task's title in the project or
     to an earlier row's title in the same import gives `duplicate_title` on field `title`.
- **R5.** Partial mode returns `200` with `{ created: [{ row, id }], failed: [{ row, errors }] }`,
  both sorted by row. Rows are numbered from 1 in input order. Valid rows are created even when
  other rows fail, and a response where every row failed is still `200`.
- **R6.** Atomic mode with no failed row returns `200` in the same shape. With any failed row it
  returns `422` with code `import_failed`, `created: []` and the full `failed` list, and creates
  nothing.
- **R7.** Created tasks belong to the caller's organization and the project, and appear in
  `GET /api/projects/:id/tasks` after the tasks that existed before, in row order.
- **R8.** CSV input:
  - the first line is a header naming the columns, in any order, using the field names of R4;
  - a header without `title` gives `422` with code `missing_title_column`, and an unknown column
    gives `422` with code `unknown_column` and `column` set to its name;
  - values follow RFC 4180: fields separated by commas, and a field in double quotes may hold
    commas, line breaks and doubled quotes (`""` is one `"`);
  - lines end with LF or CRLF; a trailing line break is ignored; blank lines are skipped and do not
    get a row number;
  - an empty cell is the same as a missing field; `isUrgent` accepts `true` and `false` in any
    case.
- **R9.** After the import is stored, each assignee of a created task gets exactly one email:
  subject `<N> imported task(s) assigned to you in <project name>`, where N counts that
  assignee's created tasks. A failed atomic import sends nothing, and failed rows never count.

## 3. API contract

```
POST /api/projects/:id/tasks/import
  200 { created, failed } | 404 project_not_found | 413 too_many_rows | 422 invalid_import
  | 422 no_rows | 422 import_failed | 422 missing_title_column | 422 unknown_column | 422 validation
```

```json
{
  "mode": "partial",
  "rows": [
    {
      "title": "Write copy",
      "assigneeEmail": "bob@acme.test",
      "dueDate": "2026-12-01"
    },
    { "title": "", "status": "later" }
  ]
}
```

```json
{
  "created": [{ "row": 1, "id": "tsk_8c1f0e2a9b7d4c11" }],
  "failed": [
    {
      "row": 2,
      "errors": [
        { "field": "title", "code": "title_required" },
        { "field": "status", "code": "invalid_status" }
      ]
    }
  ]
}
```

```csv
title,isUrgent,assigneeEmail
"Draft the ""launch"" post, v2",TRUE,bob@acme.test
Book venue,,
```

## 4. Acceptance (tests first)

- A JSON and a CSV import into `prj_app` create the expected tasks, in row order, after `tsk_4`.
- One row per R4 rule fails with exactly that code; a row breaking three rules lists all three in
  order.
- The same bad file in atomic mode returns `422 import_failed` and the task count is unchanged.
- 0 and 201 rows, both `rows` and `csv`, and bad CSV headers are refused with the codes above.
- Three tasks for Bob and one for Ada send two emails, with counts 3 and 1.

## 5. Out of scope

- Updating existing tasks from an import (no upsert).
- Importing into several projects at once, or creating projects.
- File uploads (`multipart/form-data`); the CSV is a JSON string.
- Background or resumable imports.
