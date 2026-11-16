import {
  index,
  integer,
  primaryKey,
  real,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const paymentTerms = ["net_30", "next_month"] as const;
export type PaymentTerms = (typeof paymentTerms)[number];

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan", { enum: ["free", "pro"] })
    .notNull()
    .default("free"),
  timezone: text("timezone").notNull().default("UTC"),
  currency: text("currency").notNull().default("EUR"),
  paymentTerms: text("payment_terms", { enum: paymentTerms })
    .notNull()
    .default("net_30"),
  /** JSON object of feature flags, see src/lib/flags.ts */
  featureFlags: text("feature_flags").notNull().default("{}"),
  invoiceSeq: integer("invoice_seq").notNull().default(0),
  createdAt: createdAt(),
});

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    email: text("email").notNull().unique(),
    name: text("name").notNull(),
    passwordHash: text("password_hash").notNull(),
    role: text("role", { enum: ["admin", "member"] })
      .notNull()
      .default("member"),
    timezone: text("timezone").notNull().default("UTC"),
    hourlyRateCents: integer("hourly_rate_cents"),
    createdAt: createdAt(),
  },
  (table) => [index("users_org_idx").on(table.orgId)],
);

export const apiTokens = sqliteTable("api_tokens", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
  createdAt: createdAt(),
});

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    email: text("email"),
    currency: text("currency").notNull(),
    paymentTerms: text("payment_terms", { enum: paymentTerms })
      .notNull()
      .default("net_30"),
    status: text("status", { enum: ["active", "archived"] })
      .notNull()
      .default("active"),
    notes: text("notes"),
    archivedAt: integer("archived_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (table) => [index("clients_org_idx").on(table.orgId)],
);

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id),
    name: text("name").notNull(),
    description: text("description"),
    hourlyRateCents: integer("hourly_rate_cents").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("projects_org_idx").on(table.orgId)],
);

export const taskStatuses = ["todo", "in_progress", "done"] as const;
export type TaskStatus = (typeof taskStatuses)[number];

export const tasks = sqliteTable(
  "tasks",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    description: text("description"),
    status: text("status", { enum: taskStatuses }).notNull().default("todo"),
    assigneeId: text("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    dueDate: text("due_date"),
    repeat: text("repeat", { enum: ["none", "weekly", "monthly"] })
      .notNull()
      .default("none"),
    createdAt: createdAt(),
    updatedAt: integer("updated_at", { mode: "timestamp_ms" })
      .notNull()
      .$defaultFn(() => new Date()),
  },
  (table) => [
    index("tasks_project_idx").on(table.projectId),
    index("tasks_org_idx").on(table.orgId),
  ],
);

export const labels = sqliteTable(
  "labels",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color").notNull().default("#999999"),
    createdAt: createdAt(),
  },
  (table) => [uniqueIndex("labels_org_name_unique").on(table.orgId, table.name)],
);

export const taskLabels = sqliteTable(
  "task_labels",
  {
    taskId: text("task_id")
      .notNull()
      .references(() => tasks.id, { onDelete: "cascade" }),
    labelId: text("label_id")
      .notNull()
      .references(() => labels.id, { onDelete: "cascade" }),
  },
  (table) => [primaryKey({ columns: [table.taskId, table.labelId] })],
);

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  authorId: text("author_id").notNull(),
  body: text("body").notNull(),
  createdAt: createdAt(),
});

export const attachments = sqliteTable("attachments", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  taskId: text("task_id")
    .notNull()
    .references(() => tasks.id, { onDelete: "cascade" }),
  filename: text("filename").notNull(),
  contentType: text("content_type").notNull(),
  sizeBytes: integer("size_bytes").notNull(),
  storageKey: text("storage_key").notNull(),
  uploadedBy: text("uploaded_by").notNull(),
  createdAt: createdAt(),
});

export const timeEntries = sqliteTable(
  "time_entries",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    projectId: text("project_id")
      .notNull()
      .references(() => projects.id, { onDelete: "cascade" }),
    taskId: text("task_id"),
    startedAt: integer("started_at", { mode: "timestamp_ms" }).notNull(),
    minutes: integer("minutes").notNull(),
    note: text("note"),
    billable: integer("billable", { mode: "boolean" }).notNull().default(true),
    invoiceId: text("invoice_id"),
    createdAt: createdAt(),
  },
  (table) => [index("time_entries_org_idx").on(table.orgId)],
);

export const invoiceStatuses = ["draft", "issued", "paid", "void"] as const;
export type InvoiceStatus = (typeof invoiceStatuses)[number];

export const invoices = sqliteTable(
  "invoices",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    clientId: text("client_id").references(() => clients.id),
    number: text("number").notNull(),
    clientName: text("client_name").notNull(),
    status: text("status", { enum: invoiceStatuses })
      .notNull()
      .default("draft"),
    issueDate: text("issue_date").notNull(),
    dueDate: text("due_date").notNull(),
    terms: text("terms", { enum: paymentTerms }).notNull().default("net_30"),
    repeat: text("repeat", { enum: ["none", "monthly"] })
      .notNull()
      .default("none"),
    currency: text("currency").notNull().default("EUR"),
    totalCents: integer("total_cents").notNull().default(0),
    createdAt: createdAt(),
  },
  (table) => [index("invoices_org_idx").on(table.orgId)],
);

export const invoiceLines = sqliteTable("invoice_lines", {
  id: text("id").primaryKey(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id, { onDelete: "cascade" }),
  description: text("description").notNull(),
  minutes: integer("minutes"),
  unitPriceCents: integer("unit_price_cents").notNull(),
  amountCents: integer("amount_cents").notNull(),
  timeEntryId: text("time_entry_id"),
  position: integer("position").notNull().default(0),
});

/** Legacy payments table. `amount` is in major units (the v1 API took decimals). */
export const payments = sqliteTable("payments", {
  id: text("id").primaryKey(),
  orgId: text("org_id").notNull(),
  invoiceId: text("invoice_id")
    .notNull()
    .references(() => invoices.id),
  amount: real("amount").notNull(),
  method: text("method").notNull(),
  reference: text("reference"),
  receivedAt: integer("received_at", { mode: "timestamp_ms" }).notNull(),
});

export const ledgerKinds = ["payment", "refund", "credit", "adjustment"] as const;

export const ledgerEntries = sqliteTable(
  "ledger_entries",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    invoiceId: text("invoice_id"),
    kind: text("kind", { enum: ledgerKinds }).notNull(),
    /** Signed: money in is positive, money out negative. */
    amountCents: integer("amount_cents").notNull(),
    memo: text("memo"),
    createdAt: createdAt(),
  },
  (table) => [index("ledger_org_idx").on(table.orgId)],
);

export const idempotencyKeys = sqliteTable(
  "idempotency_keys",
  {
    orgId: text("org_id").notNull(),
    scope: text("scope").notNull(),
    key: text("key").notNull(),
    statusCode: integer("status_code").notNull(),
    response: text("response").notNull(),
    createdAt: createdAt(),
  },
  (table) => [
    primaryKey({ columns: [table.orgId, table.scope, table.key] }),
  ],
);

export const webhookSubscriptions = sqliteTable("webhook_subscriptions", {
  id: text("id").primaryKey(),
  orgId: text("org_id")
    .notNull()
    .references(() => organizations.id, { onDelete: "cascade" }),
  url: text("url").notNull(),
  events: text("events").notNull(),
  secret: text("secret").notNull(),
  active: integer("active", { mode: "boolean" }).notNull().default(true),
  createdAt: createdAt(),
});

export const billingEvents = sqliteTable("billing_events", {
  id: text("id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: createdAt(),
});

export const notifications = sqliteTable(
  "notifications",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    kind: text("kind").notNull(),
    payload: text("payload").notNull().default("{}"),
    readAt: integer("read_at", { mode: "timestamp_ms" }),
    createdAt: createdAt(),
  },
  (table) => [index("notifications_user_idx").on(table.userId)],
);

export const auditLog = sqliteTable(
  "audit_log",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id").notNull(),
    actorId: text("actor_id"),
    action: text("action").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    data: text("data").notNull().default("{}"),
    createdAt: createdAt(),
  },
  (table) => [index("audit_org_idx").on(table.orgId)],
);

export const jobs = sqliteTable("jobs", {
  id: text("id").primaryKey(),
  kind: text("kind").notNull(),
  payload: text("payload").notNull(),
  runAt: integer("run_at", { mode: "timestamp_ms" }).notNull(),
  attempts: integer("attempts").notNull().default(0),
  status: text("status", { enum: ["queued", "done", "failed"] })
    .notNull()
    .default("queued"),
  lastError: text("last_error"),
  createdAt: createdAt(),
});

export type Task = typeof tasks.$inferSelect;
export type User = typeof users.$inferSelect;
export type Invoice = typeof invoices.$inferSelect;
export type TimeEntry = typeof timeEntries.$inferSelect;
export type Client = typeof clients.$inferSelect;
