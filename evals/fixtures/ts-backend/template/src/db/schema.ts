import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

const createdAt = () =>
  integer("created_at", { mode: "timestamp_ms" })
    .notNull()
    .$defaultFn(() => new Date());

export const organizations = sqliteTable("organizations", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  plan: text("plan", { enum: ["free", "pro"] })
    .notNull()
    .default("free"),
  credits: integer("credits").notNull().default(0),
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

export const projects = sqliteTable(
  "projects",
  {
    id: text("id").primaryKey(),
    orgId: text("org_id")
      .notNull()
      .references(() => organizations.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description"),
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
    isUrgent: integer("is_urgent", { mode: "boolean" })
      .notNull()
      .default(false),
    assigneeId: text("assignee_id").references(() => users.id, {
      onDelete: "set null",
    }),
    dueDate: text("due_date"),
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

export type Task = typeof tasks.$inferSelect;
export type User = typeof users.$inferSelect;
