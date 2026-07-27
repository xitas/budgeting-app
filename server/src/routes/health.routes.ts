import { Router } from "express";
import type { HealthResponse } from "shared";

export const healthRouter = Router();

healthRouter.get("/", (_req, res) => {
  const body: HealthResponse = { status: "ok", uptime: process.uptime() };
  res.status(200).json(body);
});
