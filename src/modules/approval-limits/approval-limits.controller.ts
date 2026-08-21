import type { Request, Response } from "express";
import { z } from "zod";
import { approvalLimitsRepository } from "./approval-limits.repository.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const setLimitSchema = z.object({
  iasUserId: z.number().int().positive(),
  module: z.string().min(1),
  maxAmount: z.number().nonnegative(),
  currency: z.string().default("KES"),
});

function companyId(req: Request): number {
  return req.auth!.companyId;
}

export const approvalLimitsController = {
  get: asyncHandler(async (req: Request, res: Response) => {
    const { userId, module } = req.query;
    if (typeof userId !== "string" || typeof module !== "string") {
      return fail(res, "userId and module query params are required", 422);
    }
    const limit = await approvalLimitsRepository.getForUser(
      Number(userId),
      companyId(req),
      module,
    );
    ok(res, limit);
  }),

  set: asyncHandler(async (req: Request, res: Response) => {
    const parsed = setLimitSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid input", 422, parsed.error.flatten());
    await approvalLimitsRepository.set({ ...parsed.data, iasCompanyId: companyId(req) });
    ok(res, null, "Approval limit set");
  }),
};
