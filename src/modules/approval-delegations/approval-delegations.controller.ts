import type { Request, Response } from "express";
import { z } from "zod";
import { approvalDelegationsRepository } from "./approval-delegations.repository.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const createDelegationSchema = z.object({
  toUserId: z.number().int().positive(),
  module: z.string().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
});

function companyId(req: Request): number {
  return req.auth!.companyId;
}

export const approvalDelegationsController = {
  create: asyncHandler(async (req: Request, res: Response) => {
    const parsed = createDelegationSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid input", 422, parsed.error.flatten());

    const delegation = await approvalDelegationsRepository.create({
      fromUserId: req.auth!.userId,
      iasCompanyId: companyId(req),
      ...parsed.data,
    });
    ok(res, delegation, "Delegation created", 201);
  }),

  getMyActiveDelegations: asyncHandler(async (req: Request, res: Response) => {
    const delegations = await approvalDelegationsRepository.getActiveForUser(
      req.auth!.userId,
      companyId(req),
    );
    ok(res, delegations);
  }),
};
