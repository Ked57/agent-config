import { hashPassword } from "../lib/passwords";
import { hashToken } from "../lib/tokens";
import type { Db } from "./client";
import { apiTokens, organizations, projects, tasks, users } from "./schema";

/** Long-lived tokens for local development and tests. Never seed these in production. */
export const SEED_TOKENS = {
  acmeAdmin: "dev-acme-admin-token",
  acmeMember: "dev-acme-member-token",
  globexAdmin: "dev-globex-admin-token",
} as const;

export const SEED_PASSWORD = "password123";

const tenYears = 10 * 365 * 24 * 60 * 60 * 1000;

export async function seed(db: Db): Promise<void> {
  const passwordHash = hashPassword(SEED_PASSWORD);
  await db.insert(organizations).values([
    { id: "org_acme", name: "Acme", plan: "pro", credits: 100 },
    { id: "org_globex", name: "Globex", plan: "free", credits: 0 },
  ]);
  await db.insert(users).values([
    {
      id: "usr_ada",
      orgId: "org_acme",
      email: "ada@acme.test",
      name: "Ada Lovelace",
      passwordHash,
      role: "admin",
    },
    {
      id: "usr_bob",
      orgId: "org_acme",
      email: "bob@acme.test",
      name: "Bob Builder",
      passwordHash,
      role: "member",
    },
    {
      id: "usr_gina",
      orgId: "org_globex",
      email: "gina@globex.test",
      name: "Gina Globex",
      passwordHash,
      role: "admin",
    },
  ]);
  const expiresAt = new Date(Date.now() + tenYears);
  await db.insert(apiTokens).values([
    {
      id: "tok_ada",
      userId: "usr_ada",
      tokenHash: hashToken(SEED_TOKENS.acmeAdmin),
      expiresAt,
    },
    {
      id: "tok_bob",
      userId: "usr_bob",
      tokenHash: hashToken(SEED_TOKENS.acmeMember),
      expiresAt,
    },
    {
      id: "tok_gina",
      userId: "usr_gina",
      tokenHash: hashToken(SEED_TOKENS.globexAdmin),
      expiresAt,
    },
  ]);
  await db.insert(projects).values([
    {
      id: "prj_web",
      orgId: "org_acme",
      name: "Website relaunch",
      description: "New marketing site",
    },
    { id: "prj_app", orgId: "org_acme", name: "Mobile app" },
    { id: "prj_billing", orgId: "org_acme", name: "Billing migration" },
    { id: "prj_infra", orgId: "org_globex", name: "Infrastructure" },
  ]);
  const base = Date.parse("2026-10-01T09:00:00Z");
  const at = (minutes: number) => new Date(base + minutes * 60_000);
  await db.insert(tasks).values([
    {
      id: "tsk_1",
      orgId: "org_acme",
      projectId: "prj_web",
      title: "Pick a CMS",
      status: "done",
      createdAt: at(1),
      updatedAt: at(1),
    },
    {
      id: "tsk_2",
      orgId: "org_acme",
      projectId: "prj_web",
      title: "Design homepage",
      status: "in_progress",
      assigneeId: "usr_bob",
      createdAt: at(2),
      updatedAt: at(2),
    },
    {
      id: "tsk_3",
      orgId: "org_acme",
      projectId: "prj_web",
      title: "Fix broken signup link",
      status: "todo",
      isUrgent: true,
      assigneeId: "usr_ada",
      createdAt: at(3),
      updatedAt: at(3),
    },
    {
      id: "tsk_4",
      orgId: "org_acme",
      projectId: "prj_app",
      title: "Push notifications",
      status: "todo",
      dueDate: "2026-12-01",
      createdAt: at(4),
      updatedAt: at(4),
    },
    {
      id: "tsk_5",
      orgId: "org_acme",
      projectId: "prj_billing",
      title: "Export invoices",
      status: "todo",
      isUrgent: true,
      createdAt: at(5),
      updatedAt: at(5),
    },
    {
      id: "tsk_6",
      orgId: "org_globex",
      projectId: "prj_infra",
      title: "Rotate database credentials",
      status: "todo",
      isUrgent: true,
      assigneeId: "usr_gina",
      createdAt: at(6),
      updatedAt: at(6),
    },
  ]);
}
