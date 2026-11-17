import { Elysia } from "elysia";

export const healthRoutes = new Elysia().get("/api/health", () => ({
  status: "ok",
}));
