import type { Request, Response } from "express";
import { z } from "zod";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { salesRepository as r } from "./sales.repository.js";
const item = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().positive(),
  unitPrice: z.number().nonnegative().optional(),
  discountAmount: z.number().nonnegative().optional(),
  taxRate: z.number().min(0).max(100).optional(),
});
const create = z.object({
  customerId: z.number().int().positive(),
  warehouseId: z.number().int().positive(),
  orderNumber: z.string().optional(),
  currency: z.string().max(10).optional(),
  notes: z.string().optional(),
  items: z.array(item).min(1),
});
const call = async (res: Response, fn: () => Promise<any>, msg?: string) => {
  try {
    ok(res, await fn(), msg);
  } catch (e) {
    fail(
      res,
      e instanceof Error ? e.message : "Operation failed",
      e instanceof Error && /not found/i.test(e.message) ? 404 : 409,
    );
  }
};
export const salesController = {
  list: asyncHandler(async (req, res) =>
    ok(
      res,
      await r.list(
        req.auth!.companyId,
        typeof req.query.status === "string" ? req.query.status : undefined,
      ),
    ),
  ),
  get: asyncHandler(async (req, res) => {
    const o = await r.find(Number(req.params.id), req.auth!.companyId);
    if (!o) return fail(res, "Sales order not found", 404);
    ok(res, { ...o, items: await r.items((o as { id: number }).id) });
  }),
  create: asyncHandler(async (req, res) => {
    const p = create.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    await call(
      res,
      () => r.create(req.auth!.companyId, req.auth!.userId, p.data),
      "Sales order created",
    );
  }),
  confirm: asyncHandler(async (req, res) =>
    call(
      res,
      () => r.confirm(Number(req.params.id), req.auth!.companyId),
      "Order confirmed",
    ),
  ),
  ship: asyncHandler(async (req, res) =>
    call(
      res,
      () =>
        r.ship(Number(req.params.id), req.auth!.companyId, req.auth!.userId),
      "Order shipped",
    ),
  ),
};
