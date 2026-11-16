import { Elysia, t } from "elysia";

import type { Db } from "../db/client";
import { apiError } from "../lib/errors";
import { authGuard } from "../plugins/auth";
import { listLedger } from "../services/ledger";

export const ledgerRoutes = (db: Db) =>
  new Elysia({ prefix: "/api/ledger" }).use(authGuard(db)).get(
    "/",
    async ({ query, user, status }) => {
      if (user.role !== "admin")
        return status(403, apiError("forbidden", "admins only"));
      return listLedger(db, user.orgId, query);
    },
    {
      requireAuth: true,
      query: t.Object({ invoiceId: t.Optional(t.String()) }),
    },
  );
