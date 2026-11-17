import { Elysia } from "elysia";

import type { Db } from "../db/client";
import { asBody, optionalString } from "../lib/legacy/validate";
import { isValidTimeZone } from "../lib/time";
import { authGuard } from "../plugins/auth";
import {
  findUserById,
  listOrgUsers,
  setHourlyRate,
  updateUserProfile,
  type UserRow,
} from "../sql/users.sql";

// Old-style controller: manual validation and `{ error }` bodies. Kept as is
// because the mobile app parses these error strings.
function present(row: UserRow) {
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    role: row.role,
    timezone: row.timezone,
    hourlyRateCents: row.hourly_rate_cents,
  };
}

export const usersController = (db: Db) =>
  new Elysia({ prefix: "/api/users" })
    .use(authGuard(db))
    .get(
      "/",
      async ({ user }) => {
        const rows = await listOrgUsers(db, user.orgId);
        return { items: rows.map(present) };
      },
      { requireAuth: true },
    )
    .patch(
      "/me",
      async ({ body, user, status }) => {
        const input = asBody(body);
        const errors: string[] = [];
        const name = optionalString(input, "name", errors);
        const timezone = optionalString(input, "timezone", errors);
        if (timezone !== undefined && !isValidTimeZone(timezone))
          errors.push("timezone is not a valid IANA time zone");
        if (name !== undefined && name.trim().length === 0)
          errors.push("name cannot be blank");
        if (errors.length) return status(400, { error: errors.join(", ") });
        await updateUserProfile(db, user.id, {
          name: name?.trim(),
          timezone,
        });
        const row = await findUserById(db, user.id);
        return row ? present(row) : status(404, { error: "user not found" });
      },
      { requireAuth: true },
    )
    .get(
      "/:id",
      async ({ params, status }) => {
        const row = await findUserById(db, params.id);
        if (!row) return status(404, { error: "user not found" });
        return present(row);
      },
      { requireAuth: true },
    )
    .put(
      "/:id/rate",
      async ({ params, body, user, status }) => {
        if (user.role !== "admin") return status(403, { error: "forbidden" });
        const value = asBody(body).hourlyRateCents;
        if (
          value !== null &&
          (typeof value !== "number" || !Number.isInteger(value) || value < 0)
        )
          return status(400, {
            error: "hourlyRateCents must be a whole number or null",
          });
        const updated = await setHourlyRate(db, user.orgId, params.id, value);
        if (!updated) return status(404, { error: "user not found" });
        return { id: params.id, hourlyRateCents: value };
      },
      { requireAuth: true },
    );
