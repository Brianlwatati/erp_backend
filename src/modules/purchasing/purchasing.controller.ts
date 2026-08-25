import type { Request, Response } from "express";
import { z } from "zod";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { purchasingRepository as r } from "./purchasing.repository.js";
const item = z.object({
  productId: z.number().int().positive(),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative(),
  taxRate: z.number().min(0).max(100).optional(),
});
const create = z.object({
  supplierId: z.number().int().positive(),
  warehouseId: z.number().int().positive(),
  poNumber: z.string().optional(),
  expectedDate: z.string().optional(),
  currency: z.string().optional(),
  notes: z.string().optional(),
  items: z.array(item).min(1),
});
const receive = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().positive(),
      }),
    )
    .optional(),
});
const call = async (res: Response, fn: () => Promise<any>, msg?: string) => {
  try {
    const x = await fn();
    ok(res, x, msg);
  } catch (e) {
    fail(
      res,
      e instanceof Error ? e.message : "Operation failed",
      e instanceof Error && /not found/i.test(e.message) ? 404 : 409,
    );
  }
};
export const purchasingController = {
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
    const x = await r.find(Number(req.params.id), req.auth!.companyId);
    if (!x) return fail(res, "Purchase order not found", 404);
    ok(res, { ...x, items: await r.items((x as { id: number }).id) });
  }),
  create: asyncHandler(async (req, res) => {
    const p = create.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    await call(
      res,
      () => r.create(req.auth!.companyId, req.auth!.userId, p.data),
      "Purchase order created",
    );
  }),
  approve: asyncHandler(async (req, res) => {
    const x = await r.approve(Number(req.params.id), req.auth!.companyId);
    if (!x) return fail(res, "Purchase order not found or not in DRAFT", 409);
    ok(res, x, "Purchase order approved");
  }),
  receive: asyncHandler(async (req, res) => {
    const p = receive.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    await call(
      res,
      () =>
        r.receive(
          Number(req.params.id),
          req.auth!.companyId,
          req.auth!.userId,
          p.data,
        ),
      "Goods received",
    );
  }),
};
