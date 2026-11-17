import { createClient } from "@libsql/client";
import { drizzle } from "drizzle-orm/libsql";
import type { Logger } from "drizzle-orm/logger";

import * as schema from "./schema";

export function createDb(url: string, options: { logger?: Logger } = {}) {
  const client = createClient({ url });
  return drizzle(client, { schema, logger: options.logger });
}

export type Db = ReturnType<typeof createDb>;
