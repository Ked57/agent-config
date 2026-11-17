import { describe, expect, it } from "vitest";

import { createTestContext, SEED_TOKENS } from "../test/helpers";

type Context = Awaited<ReturnType<typeof createTestContext>>;
type Schema = Record<string, unknown>;

// A copy of the client parts of docs/openapi.yaml as shipped with the task (the agent may edit
// the file; the contract is the shipped version).
const schemas: Record<string, Schema> = {
  Error: { type: "object", additionalProperties: false, required: ["code", "message"], properties: { code: { type: "string" }, message: { type: "string" } } },
  Client: {
    type: "object",
    additionalProperties: false,
    required: ["id", "name", "email", "currency", "paymentTerms", "status", "notes", "createdAt", "archivedAt"],
    properties: {
      id: { type: "string" },
      name: { type: "string" },
      email: { type: "string", format: "email", nullable: true },
      currency: { $ref: "Currency" },
      paymentTerms: { $ref: "PaymentTerms" },
      status: { type: "string", enum: ["active", "archived"] },
      notes: { type: "string", nullable: true },
      createdAt: { type: "string", format: "date-time" },
      archivedAt: { type: "string", format: "date-time", nullable: true },
    },
  },
  ClientPage: {
    type: "object",
    additionalProperties: false,
    required: ["data", "page"],
    properties: {
      data: { type: "array", items: { $ref: "Client" } },
      page: { type: "object", additionalProperties: false, required: ["limit", "offset", "total"], properties: { limit: { type: "integer" }, offset: { type: "integer" }, total: { type: "integer" } } },
    },
  },
  Currency: { type: "string", enum: ["EUR", "USD", "GBP"] },
  PaymentTerms: { type: "string", enum: ["net_30", "next_month"] },
};

const RFC3339 = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validate(schema: Schema, value: unknown, path = "$"): string[] {
  if (typeof schema.$ref === "string") return validate(schemas[schema.$ref]!, value, path);
  if (value === null) return schema.nullable ? [] : [`${path}: null is not allowed`];
  const errors: string[] = [];
  const type = schema.type as string;
  const actual = Array.isArray(value) ? "array" : Number.isInteger(value) ? "integer" : typeof value;
  if (type && !(type === actual || (type === "number" && actual === "integer"))) return [`${path}: expected ${type}, got ${actual}`];
  if (schema.enum && !(schema.enum as unknown[]).includes(value)) errors.push(`${path}: ${JSON.stringify(value)} not in enum`);
  if (schema.format === "date-time" && !(RFC3339.test(value as string) && !Number.isNaN(Date.parse(value as string)))) errors.push(`${path}: not a date-time`);
  if (schema.format === "email" && !EMAIL.test(value as string)) errors.push(`${path}: not an email`);
  if (type === "array") (value as unknown[]).forEach((item, index) => errors.push(...validate(schema.items as Schema, item, `${path}[${index}]`)));
  if (type === "object") {
    const object = value as Record<string, unknown>;
    const properties = (schema.properties ?? {}) as Record<string, Schema>;
    for (const key of (schema.required ?? []) as string[]) if (!(key in object)) errors.push(`${path}.${key}: missing`);
    for (const [key, item] of Object.entries(object)) {
      if (properties[key]) errors.push(...validate(properties[key], item, `${path}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${path}.${key}: not in the schema`);
    }
  }
  return errors;
}

async function call(context: Context, method: string, path: string, body?: unknown, token: string = SEED_TOKENS.acmeAdmin) {
  const response = await context.request(method, path, { token, body });
  const text = await response.text();
  let json: unknown = undefined;
  try {
    json = text ? JSON.parse(text) : undefined;
  } catch {
    json = text;
  }
  return { status: response.status, text, json: json as Record<string, unknown> };
}

/** The response's status must be the documented one and its body must match that response's schema. */
function expectResponse(result: { status: number; text: string; json: unknown }, status: number, schema?: string) {
  expect(result.status, result.text.slice(0, 300)).toBe(status);
  if (schema) expect(validate({ $ref: schema }, result.json), result.text.slice(0, 300)).toEqual([]);
  else expect(result.text).toBe("");
}

const create = (context: Context, body: unknown) => call(context, "POST", "/api/clients", body);

describe("hidden G6: /api/clients conforms to docs/openapi.yaml", { timeout: 30_000 }, () => {
  it("GET /api/clients answers a ClientPage ordered by name with the default page", async () => {
    const context = await createTestContext();
    const result = await call(context, "GET", "/api/clients", undefined, SEED_TOKENS.acmeMember);
    expectResponse(result, 200, "ClientPage");
    const page = result.json as { data: { name: string }[]; page: unknown };
    expect(page.data.map((client) => client.name)).toEqual(["Initech", "Northwind Traders"]);
    expect(page.page).toEqual({ limit: 50, offset: 0, total: 2 });
  });

  it("GET /api/clients pages with limit and offset", async () => {
    const context = await createTestContext();
    const result = await call(context, "GET", "/api/clients?limit=1&offset=1");
    expectResponse(result, 200, "ClientPage");
    const page = result.json as { data: { name: string }[]; page: unknown };
    expect(page.data.map((client) => client.name)).toEqual(["Northwind Traders"]);
    expect(page.page).toEqual({ limit: 1, offset: 1, total: 2 });
  });

  it("GET /api/clients filters by status and counts the filtered total", async () => {
    const context = await createTestContext();
    await call(context, "PATCH", "/api/clients/cli_initech", { status: "archived" });
    const result = await call(context, "GET", "/api/clients?status=archived");
    expectResponse(result, 200, "ClientPage");
    const page = result.json as { data: { id: string }[]; page: { total: number } };
    expect(page.data.map((client) => client.id)).toEqual(["cli_initech"]);
    expect(page.page.total).toBe(1);
  });

  it("GET /api/clients answers 400 with an Error for invalid query parameters", async () => {
    const context = await createTestContext();
    for (const query of ["limit=0", "limit=101", "offset=-1", "status=deleted", "limit=ten"]) {
      expectResponse(await call(context, "GET", `/api/clients?${query}`), 400, "Error");
    }
  });

  it("POST /api/clients answers 201 with the Client, defaults and nulls included", async () => {
    const context = await createTestContext();
    const result = await create(context, { name: "Hooli", currency: "USD" });
    expectResponse(result, 201, "Client");
    expect(result.json).toMatchObject({ name: "Hooli", currency: "USD", paymentTerms: "net_30", status: "active", email: null, notes: null, archivedAt: null });
    const full = await create(context, { name: "Pied Piper", currency: "GBP", paymentTerms: "next_month", email: "ap@piper.test", notes: "Pays late", });
    expectResponse(full, 201, "Client");
    expect(full.json).toMatchObject({ paymentTerms: "next_month", email: "ap@piper.test", notes: "Pays late" });
  });

  it("POST /api/clients accepts a null email", async () => {
    const context = await createTestContext();
    const result = await create(context, { name: "Massive Dynamic", currency: "EUR", email: null });
    expectResponse(result, 201, "Client");
    expect(result.json.email).toBeNull();
  });

  it("POST /api/clients answers 400 with an Error for bodies the schema rejects", async () => {
    const context = await createTestContext();
    const bodies = [
      { currency: "EUR" },
      { name: "", currency: "EUR" },
      { name: "x".repeat(121), currency: "EUR" },
      { name: "Lowercase", currency: "eur" },
      { name: "Yen", currency: "JPY" },
      { name: "Terms", currency: "EUR", paymentTerms: "NET30" },
      { name: "Email", currency: "EUR", email: "not-an-email" },
      { name: "Extra", currency: "EUR", orgId: "org_globex" },
    ];
    for (const body of bodies) expectResponse(await create(context, body), 400, "Error");
    const list = await call(context, "GET", "/api/clients");
    expect((list.json as { page: { total: number } }).page.total).toBe(2);
  });

  it("GET /api/clients/{id} answers 200 with the Client", async () => {
    const context = await createTestContext();
    const result = await call(context, "GET", "/api/clients/cli_initech");
    expectResponse(result, 200, "Client");
    expect(result.json).toMatchObject({ id: "cli_initech", name: "Initech", currency: "USD", paymentTerms: "next_month", email: null, notes: "Send invoices to the PO box", createdAt: "2025-06-11T08:30:00.000Z" });
  });

  it("GET /api/clients/{id} answers 404 with an Error, also for another org's client", async () => {
    const context = await createTestContext();
    expectResponse(await call(context, "GET", "/api/clients/cli_nope"), 404, "Error");
    expectResponse(await call(context, "GET", "/api/clients/cli_umbrella"), 404, "Error");
  });

  it("PATCH /api/clients/{id} changes only the given fields and answers the Client", async () => {
    const context = await createTestContext();
    const result = await call(context, "PATCH", "/api/clients/cli_northwind", { name: "Northwind Ltd", paymentTerms: "next_month", notes: null });
    expectResponse(result, 200, "Client");
    expect(result.json).toMatchObject({ name: "Northwind Ltd", paymentTerms: "next_month", notes: null, email: "ap@northwind.test", currency: "EUR" });
  });

  it("PATCH /api/clients/{id} sets archivedAt when archiving and clears it when restoring", async () => {
    const context = await createTestContext();
    const archived = await call(context, "PATCH", "/api/clients/cli_initech", { status: "archived" });
    expectResponse(archived, 200, "Client");
    expect(archived.json.status).toBe("archived");
    expect(Math.abs(Date.parse(archived.json.archivedAt as string) - Date.now())).toBeLessThan(60_000);
    const restored = await call(context, "PATCH", "/api/clients/cli_initech", { status: "active" });
    expectResponse(restored, 200, "Client");
    expect(restored.json.archivedAt).toBeNull();
  });

  it("PATCH /api/clients/{id} answers 400 with an Error for bodies the schema rejects", async () => {
    const context = await createTestContext();
    for (const body of [{}, { status: "deleted" }, { currency: "eur" }, { name: "" }, { orgId: "org_globex" }]) {
      expectResponse(await call(context, "PATCH", "/api/clients/cli_initech", body), 400, "Error");
    }
    const unchanged = await call(context, "GET", "/api/clients/cli_initech");
    expect(unchanged.json).toMatchObject({ name: "Initech", status: "active", currency: "USD" });
  });

  it("PATCH /api/clients/{id} answers 404 with an Error", async () => {
    const context = await createTestContext();
    expectResponse(await call(context, "PATCH", "/api/clients/cli_umbrella", { name: "Mine now" }), 404, "Error");
  });

  it("DELETE /api/clients/{id} answers 204 without a body", async () => {
    const context = await createTestContext();
    const created = await create(context, { name: "Short-lived", currency: "EUR" });
    expectResponse(await call(context, "DELETE", `/api/clients/${created.json.id as string}`), 204);
    expectResponse(await call(context, "GET", `/api/clients/${created.json.id as string}`), 404, "Error");
  });

  it("DELETE /api/clients/{id} answers 404 with an Error", async () => {
    const context = await createTestContext();
    expectResponse(await call(context, "DELETE", "/api/clients/cli_nope"), 404, "Error");
    expectResponse(await call(context, "DELETE", "/api/clients/cli_umbrella"), 404, "Error");
  });

  it("DELETE /api/clients/{id} answers 409 with an Error while the client has invoices or projects", async () => {
    const context = await createTestContext();
    expectResponse(await call(context, "DELETE", "/api/clients/cli_northwind"), 409, "Error");
    expectResponse(await call(context, "GET", "/api/clients/cli_northwind"), 200, "Client");
  });
});
