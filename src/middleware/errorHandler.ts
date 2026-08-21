import type { NextFunction, Request, Response } from "express";
import { fail } from "../utils/apiResponse.js";
import { env } from "../config/env.js";

// Express 5 forwards async rejections here automatically. Kept last in the
// middleware chain (see app.ts).
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
) {
  console.error(err);
  const message = err instanceof Error ? err.message : "Unexpected error";
  fail(res, env.nodeEnv === "production" ? "Internal server error" : message, 500);
}
