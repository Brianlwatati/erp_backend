import type { Response } from "express";

// Mirrors IAS's own envelope so clients handle both services identically.
export function ok<T>(res: Response, data: T, message = "Success", status = 200) {
  return res.status(status).json({ success: true, message, data });
}

export function okList<T>(
  res: Response,
  data: T[],
  pagination: { page: number; pageSize: number; total: number; totalPages: number },
  message = "Success",
) {
  return res.status(200).json({ success: true, message, data, pagination });
}

export function fail(res: Response, message: string, status = 400, errors?: unknown) {
  return res.status(status).json({ success: false, message, errors });
}
