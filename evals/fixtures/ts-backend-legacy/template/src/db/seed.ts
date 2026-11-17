import { hashPassword } from "../lib/passwords";
import { hashToken } from "../lib/tokens";
import type { Db } from "./client";
import {
  apiTokens,
  attachments,
  clients,
  comments,
  invoiceLines,
  invoices,
  labels,
  ledgerEntries,
  notifications,
  organizations,
  payments,
  projects,
  taskLabels,
  tasks,
  timeEntries,
  users,
  webhookSubscriptions,
} from "./schema";

/** Long-lived tokens for local development and tests. Never seed these in production. */
export const SEED_TOKENS = {
  acmeAdmin: "dev-acme-admin-token",
  acmeMember: "dev-acme-member-token",
  acmeSydney: "dev-acme-sydney-token",
  globexAdmin: "dev-globex-admin-token",
  globexMember: "dev-globex-member-token",
} as const;

export const SEED_PASSWORD = "password123";

const tenYears = 10 * 365 * 24 * 60 * 60 * 1000;
const at = (iso: string) => new Date(iso);

export async function seed(db: Db): Promise<void> {
  const passwordHash = hashPassword(SEED_PASSWORD);
  await db.insert(organizations).values([
    {
      id: "org_acme",
      name: "Acme",
      plan: "pro",
      timezone: "Europe/Berlin",
      currency: "EUR",
      paymentTerms: "net_30",
      featureFlags: JSON.stringify({ webhooks: true }),
      invoiceSeq: 2,
    },
    {
      id: "org_globex",
      name: "Globex",
      plan: "free",
      timezone: "America/New_York",
      currency: "USD",
      paymentTerms: "next_month",
      invoiceSeq: 1,
    },
  ]);
  const person = (
    id: string,
    orgId: string,
    email: string,
    name: string,
    role: "admin" | "member",
    timezone: string,
    hourlyRateCents: number | null = null,
  ) => ({
    id,
    orgId,
    email,
    name,
    role,
    timezone,
    hourlyRateCents,
    passwordHash,
  });
  await db
    .insert(users)
    .values([
      person(
        "usr_ada",
        "org_acme",
        "ada@acme.test",
        "Ada Lovelace",
        "admin",
        "Europe/Berlin",
      ),
      person(
        "usr_bob",
        "org_acme",
        "bob@acme.test",
        "Bob Builder",
        "member",
        "Europe/London",
        9000,
      ),
      person(
        "usr_sam",
        "org_acme",
        "sam@acme.test",
        "Sam Taylor",
        "member",
        "Australia/Sydney",
        7500,
      ),
      person(
        "usr_gina",
        "org_globex",
        "gina@globex.test",
        "Gina Globex",
        "admin",
        "America/New_York",
      ),
      person(
        "usr_hal",
        "org_globex",
        "hal@globex.test",
        "Hal Jordan",
        "member",
        "America/Los_Angeles",
        11000,
      ),
    ]);
  const expiresAt = new Date(Date.now() + tenYears);
  await db.insert(apiTokens).values(
    (
      [
        ["tok_ada", "usr_ada", SEED_TOKENS.acmeAdmin],
        ["tok_bob", "usr_bob", SEED_TOKENS.acmeMember],
        ["tok_sam", "usr_sam", SEED_TOKENS.acmeSydney],
        ["tok_gina", "usr_gina", SEED_TOKENS.globexAdmin],
        ["tok_hal", "usr_hal", SEED_TOKENS.globexMember],
      ] as const
    ).map(([id, userId, token]) => ({
      id,
      userId,
      tokenHash: hashToken(token),
      expiresAt,
    })),
  );
  await db.insert(clients).values([
    {
      id: "cli_northwind",
      orgId: "org_acme",
      name: "Northwind Traders",
      email: "ap@northwind.test",
      currency: "EUR",
      paymentTerms: "net_30",
      createdAt: at("2025-03-02T10:00:00Z"),
    },
    {
      id: "cli_initech",
      orgId: "org_acme",
      name: "Initech",
      currency: "USD",
      paymentTerms: "next_month",
      notes: "Send invoices to the PO box",
      createdAt: at("2025-06-11T08:30:00Z"),
    },
    {
      id: "cli_umbrella",
      orgId: "org_globex",
      name: "Umbrella Corp",
      email: "billing@umbrella.test",
      currency: "USD",
      paymentTerms: "next_month",
      createdAt: at("2025-01-20T15:00:00Z"),
    },
  ]);
  await db.insert(projects).values([
    {
      id: "prj_web",
      orgId: "org_acme",
      clientId: "cli_northwind",
      name: "Website relaunch",
      description: "New marketing site",
      hourlyRateCents: 10000,
      createdAt: at("2026-09-01T09:00:00Z"),
    },
    {
      id: "prj_app",
      orgId: "org_acme",
      clientId: "cli_initech",
      name: "Mobile app",
      hourlyRateCents: 12000,
      createdAt: at("2026-09-02T09:00:00Z"),
    },
    {
      id: "prj_internal",
      orgId: "org_acme",
      name: "Internal",
      createdAt: at("2026-09-03T09:00:00Z"),
    },
    {
      id: "prj_infra",
      orgId: "org_globex",
      clientId: "cli_umbrella",
      name: "Infrastructure",
      hourlyRateCents: 15000,
      createdAt: at("2026-09-04T09:00:00Z"),
    },
  ]);
  const task = (
    id: string,
    orgId: string,
    projectId: string,
    title: string,
    status: "todo" | "in_progress" | "done",
    minutes: number,
    extra: Partial<typeof tasks.$inferInsert> = {},
  ) => {
    const created = new Date(
      Date.parse("2026-10-01T09:00:00Z") + minutes * 60_000,
    );
    return {
      id,
      orgId,
      projectId,
      title,
      status,
      createdAt: created,
      updatedAt: created,
      ...extra,
    };
  };
  await db.insert(tasks).values([
    task("tsk_1", "org_acme", "prj_web", "Pick a CMS", "done", 1, {
      assigneeId: "usr_ada",
    }),
    task("tsk_2", "org_acme", "prj_web", "Design homepage", "in_progress", 2, {
      assigneeId: "usr_bob",
    }),
    task("tsk_3", "org_acme", "prj_web", "Fix broken signup link", "todo", 3, {
      assigneeId: "usr_sam",
      dueDate: "2026-11-20",
    }),
    task("tsk_4", "org_acme", "prj_app", "Push notifications", "todo", 4, {
      dueDate: "2026-12-01",
    }),
    task(
      "tsk_5",
      "org_acme",
      "prj_internal",
      "Monthly backup check",
      "todo",
      5,
      {
        assigneeId: "usr_ada",
        dueDate: "2026-11-15",
        repeat: "monthly",
      },
    ),
    task(
      "tsk_6",
      "org_globex",
      "prj_infra",
      "Rotate database credentials",
      "todo",
      6,
      { assigneeId: "usr_gina" },
    ),
    task(
      "tsk_7",
      "org_globex",
      "prj_infra",
      "Upgrade load balancer",
      "in_progress",
      7,
      { assigneeId: "usr_hal" },
    ),
  ]);
  await db.insert(labels).values([
    { id: "lbl_bug", orgId: "org_acme", name: "bug", color: "#d73a4a" },
    { id: "lbl_design", orgId: "org_acme", name: "Design", color: "#a2eeef" },
    {
      id: "lbl_frontend",
      orgId: "org_acme",
      name: "frontend",
      color: "#0e8a16",
    },
    { id: "lbl_ops", orgId: "org_globex", name: "ops", color: "#5319e7" },
  ]);
  await db.insert(taskLabels).values([
    { taskId: "tsk_2", labelId: "lbl_design" },
    { taskId: "tsk_2", labelId: "lbl_frontend" },
    { taskId: "tsk_3", labelId: "lbl_bug" },
    { taskId: "tsk_6", labelId: "lbl_ops" },
  ]);
  await db.insert(comments).values([
    {
      id: "cmt_1",
      orgId: "org_acme",
      taskId: "tsk_2",
      authorId: "usr_ada",
      body: "Mockups are in the shared drive.",
      createdAt: at("2026-10-02T10:00:00Z"),
    },
    {
      id: "cmt_globex",
      orgId: "org_globex",
      taskId: "tsk_6",
      authorId: "usr_gina",
      body: "New credentials are in the vault, rotate before Friday.",
      createdAt: at("2026-10-03T10:00:00Z"),
    },
  ]);
  await db.insert(attachments).values([
    {
      id: "att_acme",
      orgId: "org_acme",
      taskId: "tsk_2",
      filename: "homepage-v3.fig",
      contentType: "application/octet-stream",
      sizeBytes: 482_113,
      storageKey: "org_acme/tsk_2/att_acme",
      uploadedBy: "usr_bob",
    },
    {
      id: "att_globex",
      orgId: "org_globex",
      taskId: "tsk_6",
      filename: "db-credentials-runbook.pdf",
      contentType: "application/pdf",
      sizeBytes: 90_210,
      storageKey: "org_globex/tsk_6/att_globex",
      uploadedBy: "usr_gina",
    },
  ]);
  const entry = (
    id: string,
    orgId: string,
    userId: string,
    projectId: string,
    taskId: string | null,
    startedAt: string,
    minutes: number,
    extra: Partial<typeof timeEntries.$inferInsert> = {},
  ) => ({
    id,
    orgId,
    userId,
    projectId,
    taskId,
    startedAt: at(startedAt),
    minutes,
    ...extra,
  });
  await db.insert(timeEntries).values([
    entry(
      "te_1",
      "org_acme",
      "usr_ada",
      "prj_web",
      "tsk_1",
      "2026-10-05T08:00:00Z",
      90,
      {
        note: "CMS comparison",
        invoiceId: "inv_acme_1",
      },
    ),
    entry(
      "te_2",
      "org_acme",
      "usr_bob",
      "prj_web",
      "tsk_2",
      "2026-10-06T09:00:00Z",
      240,
      {
        note: "Homepage wireframes",
        invoiceId: "inv_acme_1",
      },
    ),
    entry(
      "te_3",
      "org_acme",
      "usr_bob",
      "prj_web",
      "tsk_2",
      "2026-11-09T09:30:00Z",
      120,
      { note: "Hero section" },
    ),
    entry(
      "te_4",
      "org_acme",
      "usr_sam",
      "prj_web",
      "tsk_3",
      "2026-11-09T23:00:00Z",
      45,
      { note: "Repro signup bug" },
    ),
    entry(
      "te_5",
      "org_acme",
      "usr_ada",
      "prj_app",
      "tsk_4",
      "2026-11-10T13:00:00Z",
      60,
    ),
    entry(
      "te_6",
      "org_acme",
      "usr_ada",
      "prj_internal",
      null,
      "2026-11-11T07:15:00Z",
      30,
      {
        note: "Team meeting",
        billable: false,
      },
    ),
    entry(
      "te_7",
      "org_acme",
      "usr_sam",
      "prj_app",
      null,
      "2026-11-12T22:30:00Z",
      150,
      { note: "API review" },
    ),
    entry(
      "te_8",
      "org_globex",
      "usr_hal",
      "prj_infra",
      "tsk_7",
      "2026-11-10T17:00:00Z",
      180,
      { note: "LB config" },
    ),
    entry(
      "te_9",
      "org_globex",
      "usr_gina",
      "prj_infra",
      "tsk_6",
      "2026-11-11T14:00:00Z",
      60,
    ),
  ]);
  await db.insert(invoices).values([
    {
      id: "inv_acme_1",
      orgId: "org_acme",
      clientId: "cli_northwind",
      number: "INV-2026-0001",
      clientName: "Northwind Traders",
      status: "issued",
      issueDate: "2026-10-15",
      dueDate: "2026-11-14",
      terms: "net_30",
      currency: "EUR",
      totalCents: 55000,
      createdAt: at("2026-10-15T09:00:00Z"),
    },
    {
      id: "inv_acme_2",
      orgId: "org_acme",
      clientId: "cli_initech",
      number: "INV-2026-0002",
      clientName: "Initech",
      status: "draft",
      issueDate: "2026-11-01",
      dueDate: "2026-12-01",
      terms: "next_month",
      currency: "USD",
      totalCents: 120000,
      createdAt: at("2026-11-01T09:00:00Z"),
    },
    {
      id: "inv_globex_1",
      orgId: "org_globex",
      clientId: "cli_umbrella",
      number: "INV-2026-0001",
      clientName: "Umbrella Corp",
      status: "paid",
      issueDate: "2026-10-20",
      dueDate: "2026-11-20",
      terms: "next_month",
      currency: "USD",
      totalCents: 45000,
      createdAt: at("2026-10-20T09:00:00Z"),
    },
  ]);
  await db.insert(invoiceLines).values([
    {
      id: "inl_1",
      invoiceId: "inv_acme_1",
      description: "Website relaunch: CMS comparison (2026-10-05)",
      minutes: 90,
      unitPriceCents: 10000,
      amountCents: 15000,
      timeEntryId: "te_1",
      position: 0,
    },
    {
      id: "inl_2",
      invoiceId: "inv_acme_1",
      description: "Website relaunch: Homepage wireframes (2026-10-06)",
      minutes: 240,
      unitPriceCents: 10000,
      amountCents: 40000,
      timeEntryId: "te_2",
      position: 1,
    },
    {
      id: "inl_3",
      invoiceId: "inv_acme_2",
      description: "App maintenance retainer",
      minutes: null,
      unitPriceCents: 120000,
      amountCents: 120000,
      position: 0,
    },
    {
      id: "inl_4",
      invoiceId: "inv_globex_1",
      description: "Infrastructure: on-call (October)",
      minutes: null,
      unitPriceCents: 45000,
      amountCents: 45000,
      position: 0,
    },
  ]);
  await db.insert(payments).values({
    id: "pay_1",
    orgId: "org_acme",
    invoiceId: "inv_acme_1",
    amount: 200,
    method: "bank",
    reference: "NW-7781",
    receivedAt: at("2026-10-30T12:00:00Z"),
  });
  await db.insert(ledgerEntries).values([
    {
      id: "led_1",
      orgId: "org_acme",
      invoiceId: "inv_acme_1",
      kind: "payment",
      amountCents: 20000,
      memo: "payment pay_1 (bank)",
      createdAt: at("2026-10-30T12:00:00Z"),
    },
    {
      id: "led_2",
      orgId: "org_globex",
      invoiceId: "inv_globex_1",
      kind: "payment",
      amountCents: 45000,
      memo: "provider event evt_seed",
      createdAt: at("2026-10-28T12:00:00Z"),
    },
  ]);
  await db.insert(webhookSubscriptions).values([
    {
      id: "whs_acme",
      orgId: "org_acme",
      url: "https://hooks.acme.test/billing",
      events: JSON.stringify(["invoice.issued", "invoice.paid"]),
      secret: "whsec_acme_dev",
    },
    {
      id: "whs_globex",
      orgId: "org_globex",
      url: "https://hooks.globex.test/tasks",
      events: JSON.stringify(["task.completed"]),
      secret: "whsec_globex_dev",
    },
  ]);
  await db.insert(notifications).values({
    id: "ntf_1",
    orgId: "org_acme",
    userId: "usr_bob",
    kind: "task.assigned",
    payload: JSON.stringify({ taskId: "tsk_2", title: "Design homepage" }),
  });
}
