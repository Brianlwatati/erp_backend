import { NextFunction, Request, Response } from "express";
import { z } from "zod";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { financeRepository as r } from "./finance.repository.js";
const payment = z.object({
  customerId: z.number().int().positive().optional(),
  paymentReference: z.string().optional(),
  amount: z.number().positive(),
  paymentDate: z.string().optional(),
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
const supplierPayment = z.object({
  supplierId: z.number().int().positive().optional(),
  paymentReference: z.string().optional(),
  amount: z.number().positive(),
  paymentDate: z.string().optional(),
  method: z.string().optional(),
  notes: z.string().optional(),
  allocations: z
    .array(
      z.object({
        billId: z.number().int().positive(),
        amount: z.number().positive(),
      }),
    )
    .min(1),
});
const supplierCreditNote = z
  .object({
    supplierId: z.number().int().positive().optional(),
    orderId: z.number().int().positive().optional(),
    billId: z.number().int().positive().optional(),
    creditNoteNumber: z.string().optional(),
    amount: z.number().positive(),
    issueDate: z.string().optional(),
    reason: z.string().min(1),
  })
  .refine((value) => value.orderId || value.billId, {
    message: "orderId or billId is required",
    path: ["orderId"],
  });
const operatingExpenseInput = z.object({
  expenseNumber: z.string().optional(),
  expenseDate: z.string().optional(),
  category: z.string().min(1),
  description: z.string().min(1),
  amount: z.number().positive(),
  currency: z.string().optional(),
  paymentMethod: z.enum(["CASH", "BANK", "CREDIT"]).optional(),
  paymentAccountCode: z.string().min(1).optional(),
  supplierId: z.number().int().positive().optional(),
  reference: z.string().optional(),
  notes: z.string().optional(),
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
type FinanceHandler = (req: Request, res: Response, next: NextFunction) => void;

interface FinanceController {
  invoices: FinanceHandler;
  invoice: FinanceHandler;
  fromOrder: FinanceHandler;
  payment: FinanceHandler;
  ar: FinanceHandler;
  supplierBills: FinanceHandler;
  supplierBill: FinanceHandler;
  ap: FinanceHandler;
  expenses: FinanceHandler;
  expense: FinanceHandler;
  createExpense: FinanceHandler;
  supplierBillFromOrder: FinanceHandler;
  supplierPayment: FinanceHandler;
  journal: FinanceHandler;
}

export const financeController: FinanceController = {
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
  supplierBills: asyncHandler(async (req, res) =>
    ok(res, await r.supplierBills(req.auth!.companyId)),
  ),
  supplierBill: asyncHandler(async (req, res) => {
    const x = await r.supplierBill(Number(req.params.id), req.auth!.companyId);
    if (!x) return fail(res, "Supplier bill not found", 404);
    ok(res, {
      ...x,
      items: await r.supplierBillItems((x as { id: number }).id),
    });
  }),
  ap: asyncHandler(async (req, res) =>
    ok(res, await r.ap(req.auth!.companyId)),
  ),
  expenses: asyncHandler(async (req, res) =>
    ok(res, await r.expenses(req.auth!.companyId)),
  ),
  expense: asyncHandler(async (req, res) => {
    const x = await r.expense(Number(req.params.id), req.auth!.companyId);
    if (!x) return fail(res, "Expense not found", 404);
    ok(res, x);
  }),
  createExpense: asyncHandler(async (req, res) => {
    const p = operatingExpenseInput.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    await call(
      res,
      () => r.createExpense(req.auth!.companyId, req.auth!.userId, p.data),
      "Expense recorded",
    );
  }),

  supplierBillFromOrder: asyncHandler(async (req, res) =>
    call(
      res,
      () =>
        r.supplierBillFromOrder(
          Number(req.params.orderId),
          req.auth!.companyId,
          req.auth!.userId,
        ),
      "Supplier bill created",
    ),
  ),
  supplierPayment: asyncHandler(async (req, res) => {
    const p = supplierPayment.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    await call(
      res,
      () => r.supplierPayment(req.auth!.companyId, req.auth!.userId, p.data),
      "Supplier payment recorded",
    );
  }),

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
