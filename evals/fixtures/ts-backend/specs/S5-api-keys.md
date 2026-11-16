# Spec #205: API keys with scopes

Customers script against the API with the login tokens from `POST /api/auth/token`. Those expire
after `TOKEN_TTL_HOURS`, carry the user's full rights, and can't be listed or revoked. This spec
adds long-lived API keys that an admin creates for scripts, limited by scopes, visible in a list,
and revocable.

- **Follow this issue.** Where it and older behaviour disagree, this issue wins.
- Done means `tsc --noEmit`, `eslint .`, `prettier --check .`, `vitest run` and
  `bun build src/index.ts --target bun` all pass.
- Write tests first. Every requirement below needs at least one test in `src/**/*.test.ts`.
- New errors use the `{ code, message }` shape the auth guard already uses.

---

## 1. Decisions

1. **A key acts as the admin who created it, narrowed by its scopes.** It never has more rights
   than its creator has _now_: a demoted creator's keys lose admin rights, and a deleted creator's
   keys stop working.
2. **The key is shown once.** Only its SHA-256 hash and a short prefix are stored.
3. **Keys cannot manage keys.** Creating, listing and revoking keys needs a login token.
4. **Login tokens are unchanged.** They keep full rights and are never scope-checked.

## 2. Data

- A new drizzle-kit migration (do not edit `0000_init.sql`) creates `api_keys`: `id`, `org_id`,
  `created_by` (a foreign key to `users.id` with `ON DELETE CASCADE`), `name`, `prefix`,
  `key_hash` (unique), `scopes` (JSON text), `expires_at` (nullable), `last_used_at` (nullable),
  `revoked_at` (nullable) and `created_at`.

## 3. Requirements

- **R1.** `POST /api/api-keys` with `{ name, scopes, expiresInDays? }` creates a key and returns
  `201` with `{ id, name, scopes, prefix, key, createdBy, createdAt, expiresAt, lastUsedAt,
revokedAt }`:
  - `key` is `tk_` followed by at least 32 random URL-safe characters; `prefix` is its first 11
    characters;
  - `name` is 1 to 100 characters; `scopes` is a non-empty array of distinct values from
    `projects:read`, `projects:write`, `tasks:read` and `tasks:write`; `expiresInDays` is an
    integer from 1 to 365. Anything else is a validation error (`422`);
  - `expiresAt` is now plus `expiresInDays` days, or `null` (never expires); `lastUsedAt` and
    `revokedAt` start `null`.
- **R2.** The database holds `key_hash`, the SHA-256 hex digest of the key, never the key itself
  (Decision 2).
- **R3.** `GET /api/api-keys` returns `200` with `{ items }`: every key of the caller's organization,
  revoked ones included, sorted by name, in the R1 shape without `key`. No key hash is ever
  returned.
- **R4.** The three key routes are for admins with a login token. A member gets `403` with code
  `forbidden`.
- **R5.** `DELETE /api/api-keys/:id` revokes the key (`revokedAt` set) and returns `204`. Another
  organization's or an unknown key gives `404` with code `api_key_not_found`; an already revoked
  key gives `409` with code `already_revoked`.
- **R6.** An API key authenticates like a login token: `Authorization: Bearer <key>` on any route
  that requires authentication. Unknown, revoked and expired keys get `401`. The request acts as
  the key's creator: their organization, and their **current** role (Decision 1).
- **R7.** Scopes, checked before the route does anything else (so a missing scope is `403` even
  for an id that does not exist):

  | Route                                                               | Scope            |
  | ------------------------------------------------------------------- | ---------------- |
  | `GET /api/projects`, `GET /api/projects/:id`                        | `projects:read`  |
  | `POST /api/projects`                                                | `projects:write` |
  | `GET /api/projects/:id/tasks`, `GET /api/tasks/:id`                 | `tasks:read`     |
  | `POST /api/projects/:id/tasks`, `PATCH` and `DELETE /api/tasks/:id` | `tasks:write`    |

  A `write` scope includes the `read` scope of the same resource. A missing scope gives `403`
  with code `insufficient_scope` and `required` set to the scope from the table.

- **R8.** A request to any `/api/api-keys` route with an API key gets `403` with code
  `api_key_not_allowed`, whatever its scopes (Decision 3).
- **R9.** `GET /api/me` needs no scope. It gains `apiKey`: `{ id, name, scopes }` when called with
  a key, `null` with a login token.
- **R10.** `lastUsedAt` is set to the current time on every request the key authenticates,
  including requests then refused for a missing scope or a role.
- **R11.** Role rules still apply on top of scopes: deleting a task needs `tasks:write` **and** a
  creator who is an admin now.
- **R12.** Login tokens keep working everywhere without scope checks (Decision 4).

## 4. API contract

```
POST   /api/api-keys        admin, login token   201 | 403 forbidden | 403 api_key_not_allowed | 422
GET    /api/api-keys        admin, login token   200 | 403 forbidden | 403 api_key_not_allowed
DELETE /api/api-keys/:id    admin, login token   204 | 403 | 404 api_key_not_found | 409 already_revoked
```

```json
{
  "id": "key_3f9a1c0d2b8e4f67",
  "name": "Nightly export",
  "scopes": ["tasks:read"],
  "prefix": "tk_Q2hpY2tl",
  "key": "tk_Q2hpY2tlbiBhbmQgd2FmZmxlcyBhcmUgYSBnb29kIGRpbm5lcg",
  "createdBy": "usr_ada",
  "createdAt": "2026-11-16T09:30:00.000Z",
  "expiresAt": null,
  "lastUsedAt": null,
  "revokedAt": null
}
```

```json
{
  "code": "insufficient_scope",
  "message": "this key cannot write tasks",
  "required": "tasks:write"
}
```

## 5. Acceptance (tests first)

- Ada creates a `tasks:read` key: it reads tasks, is refused `PATCH` with
  `required: "tasks:write"`, and is refused `GET /api/projects` with `required: "projects:read"`.
- A `tasks:write` key reads, creates and changes tasks; deleting works until Ada is demoted.
- A revoked key and a key past `expiresAt` get `401`. The list shows the revoked key.
- A key with every scope cannot create, list or revoke keys.
- The list and the database never show the key.

## 6. Out of scope

- Keys for members, per-project keys, or scopes for the billing webhook.
- Rotating or renaming keys.
- Rate limits per key.
- Changing how login tokens work.
