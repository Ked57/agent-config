# Architecture

_Last updated: March 2023._

## Stack

Bun, Elysia, Drizzle ORM on SQLite (libSQL), Vitest. One process serves HTTP and runs the job
worker.

## Request handling

There are two styles in the codebase:

1. **Controllers** (`src/controllers/*.controller.ts`) with raw SQL helpers in `src/sql/`. They
   validate by hand (`src/lib/legacy/validate.ts`) and answer errors as `{ "error": "..." }`.
   This is the original style. Don't add new controllers.
2. **Routes and services** (`src/routes/*.ts`, `src/services/*.ts`). Routes validate with
   Elysia's `t` schemas and call services; services use Drizzle's query builder and throw
   `HttpError`, which the app turns into `{ "code", "message" }`.

New work goes into routes and services. We move controllers over when we touch them.

## Tenancy

Every row belongs to an organization (`org_id`). Every query must filter by the caller's org;
the auth macro (`requireAuth`) puts `user.orgId` on the context. Child rows (comments,
attachments, invoice lines) are reached through their parent, which is org-checked.

## Money and time

- All amounts are integer cents. (The `payments` table still has a decimal `amount` column from
  v1; the ledger is the source of truth.)
- Time entries store `started_at` in UTC and `minutes`. Days are computed in UTC by
  `src/lib/legacy/dates.ts`.
- The ledger (`ledger_entries`) is append-only: payments are positive, money paid out is
  negative. Invoice status `paid` is derived from it when a payment arrives.

## Reports

`/api/reports/*` (v2) replaced the v1 reports, which were removed in 2022.

## Background jobs

`src/services/jobs.ts` is a small queue in the `jobs` table. Handlers: `notification.email`,
`webhook.deliver`, `digest.weekly`. Slack notifications go through `src/services/slack.ts`.

## Feature flags

`organizations.feature_flags` (JSON), read through `src/lib/flags.ts`.
