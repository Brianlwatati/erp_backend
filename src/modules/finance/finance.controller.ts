import { Request, Response } from "express";
import { z } from "zod";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { financeRepository as r } from "./finance.repository.js";
const payment = z.object({
  customerId: z.number().int().positive().optional(),
  paymentReference: z.string().optional(),
  amount: z.number().positive(),
  paymentDate: z.string().optional(),
  method: z.string().optional(),
  notes: z.string().optional(),
  allocations: z
    .array(
      z.object({
        invoiceId: z.number().int().positive(),
        amount: z.number().positive(),
      }),
    )
    .min(1),
});
const journal = z.object({
  description: z.string().min(1),
  referenceType: z.string().optional(),
  referenceId: z.number().optional(),
  entryDate: z.string().optional(),
  lines: z
    .array(
      z.object({
        accountCode: z.string(),
        debit: z.number().nonnegative().optional(),
        credit: z.number().nonnegative().optional(),
      }),
    )
    .min(2),
});
const call = async (res: Response, fn: () => Promise<any>, msg?: string) => {
  try {
    ok(res, await fn(), msg);
  } catch (e) {
    fail(res, e instanceof Error ? e.message : "Operation failed", 409);
  }
};
export const financeController = {
  invoices: asyncHandler(async (req, res) =>
    ok(
      res,
      await r.invoices(
        req.auth!.companyId,
        typeof req.query.status === "string" ? req.query.status : undefined,
      ),
    ),
  ),
  invoice: asyncHandler(async (req, res) => {
    const x = await r.invoice(Number(req.params.id), req.auth!.companyId);
    if (!x) return fail(res, "Invoice not found", 404);
    ok(res, { ...x, items: await r.invoiceItems((x as { id: number }).id) });
  }),
  fromOrder: asyncHandler(async (req, res) =>
    call(
      res,
      () =>
        r.createFromOrder(
          Number(req.params.orderId),
          req.auth!.companyId,
          req.auth!.userId,
        ),
      "Invoice created",
    ),
  ),
  payment: asyncHandler(async (req, res) => {
    const p = payment.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    await call(
      res,
      () => r.payment(req.auth!.companyId, req.auth!.userId, p.data),
      "Payment recorded",
    );
  }),
  ar: asyncHandler(async (req, res) =>
    ok(res, await r.ar(req.auth!.companyId)),
  ),
  journal: asyncHandler(async (req, res) => {
    const p = journal.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    await call(
      res,
      () => r.journal(req.auth!.companyId, req.auth!.userId, p.data),
      "Journal posted",
    );
  }),
};
