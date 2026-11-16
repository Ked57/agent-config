# Billable API

Time tracking and invoicing for agencies: organizations, people, clients, projects, tasks, time
entries, invoices and payments. Started in 2019 as `tasks-api`; the package name stuck.

## Running it

```sh
bun install
cp .env.example .env
bun run db:migrate
bun run db:seed      # dev data, tokens in src/db/seed.ts
bun run dev
```

| Variable          | Meaning                                                                    |
| ----------------- | -------------------------------------------------------------------------- |
| `PORT`            | HTTP port (4000)                                                           |
| `DATABASE_URL`    | libSQL URL, `file:data/dev.db` locally                                     |
| `WEBHOOK_SECRET`  | shared secret of the billing provider webhook; also signs attachment links |
| `TOKEN_TTL_HOURS` | lifetime of tokens from `POST /api/auth/token`                             |
| `LOG_LEVEL`       | `debug`, `info`, `warn`, `error` or `silent`                               |
| `WORKER`          | `off` disables the in-process job worker                                   |

## Checks

`bun run typecheck`, `bun run lint`, `bun run format:check`, `bun run test`, `bun run build`.
Tests run against a fresh temp SQLite database per test (`src/test/helpers.ts`).

## Layout

See [docs/architecture.md](docs/architecture.md). The HTTP contract for clients and payments is
in [docs/openapi.yaml](docs/openapi.yaml); the rest of the API is not documented there yet.

## Endpoints (summary)

- `POST /api/auth/token`, `GET /api/me`
- `/api/users`, `/api/clients`, `/api/projects`, `/api/tasks`, `/api/labels`
- `/api/tasks/:id/comments`, `/api/tasks/:id/attachments`, `/api/attachments/:id`
- `/api/time-entries`
- `/api/invoices`, `/api/invoices/:id/payments`, `/api/ledger`
- `/api/reports/timesheet`, `/api/reports/projects/:id`
- `/api/exports/invoices.csv`, `/api/exports/time-entries.csv`, `/api/exports/payroll.csv`
- `/api/notifications`, `/api/audit`, `/api/webhook-subscriptions`
- `POST /api/webhooks/billing` (billing provider)
- `/api/v1/reports/*`: deprecated, still used by the old mobile app
