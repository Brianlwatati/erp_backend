import { Request, Response } from "express";
import { z } from "zod";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { hrRepository as r } from "./hr.repository.js";
const emp = z.object({
  employeeNumber: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  department: z.string().optional(),
  jobTitle: z.string().optional(),
  hireDate: z.string().optional(),
  salary: z.number().nonnegative().optional(),
});
const att = z.object({
  date: z.string().optional(),
  clockIn: z.string().optional(),
  clockOut: z.string().optional(),
  notes: z.string().optional(),
});
const leave = z.object({
  leaveType: z.string(),
  startsOn: z.string(),
  endsOn: z.string(),
  reason: z.string().optional(),
});
const payroll = z.object({
  periodStart: z.string(),
  periodEnd: z.string(),
  deductionRate: z.number().min(0).max(100).optional(),
});
const call = async (res: Response, fn: () => Promise<any>, msg?: string) => {
  try {
    ok(res, await fn(), msg);
  } catch (e) {
    fail(res, e instanceof Error ? e.message : "Operation failed", 409);
  }
};
export const hrController = {
  employees: asyncHandler(async (req, res) =>
    ok(res, await r.employees(req.auth!.companyId)),
  ),
  createEmployee: asyncHandler(async (req, res) => {
    const p = emp.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    ok(
      res,
      await r.createEmployee(req.auth!.companyId, p.data),
      "Employee created",
      201,
    );
  }),
  attendance: asyncHandler(async (req, res) =>
    ok(
      res,
      await r.attendance(
        req.auth!.companyId,
        req.query.employeeId ? +req.query.employeeId : undefined,
      ),
    ),
  ),
  clock: asyncHandler(async (req, res) => {
    const p = att.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    await call(
      res,
      () => r.clock(req.auth!.companyId, Number(req.params.employeeId), p.data),
      "Attendance recorded",
    );
  }),
  leave: asyncHandler(async (req, res) =>
    ok(res, await r.leave(req.auth!.companyId)),
  ),
  requestLeave: asyncHandler(async (req, res) => {
    const p = leave.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    await call(
      res,
      () =>
        r.requestLeave(
          req.auth!.companyId,
          Number(req.params.employeeId),
          p.data,
        ),
      "Leave requested",
    );
  }),
  approveLeave: asyncHandler(async (req, res) => {
    const x = await r.approveLeave(
      Number(req.params.id),
      req.auth!.companyId,
      req.auth!.userId,
    );
    if (!x) return fail(res, "Leave request not found or already decided", 409);
    ok(res, x, "Leave approved");
  }),
  payroll: asyncHandler(async (req, res) => {
    const p = payroll.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    await call(
      res,
      () => r.payroll(req.auth!.companyId, req.auth!.userId, p.data),
      "Payroll calculated",
    );
  }),
};
