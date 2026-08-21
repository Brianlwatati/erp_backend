import type { Request, Response } from "express";
import { z } from "zod";
import { branchesRepository } from "./branches.repository.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

const createBranchSchema = z.object({
  name: z.string().min(2),
  code: z.string().min(1).max(50).regex(/^[A-Z0-9_-]+$/),
});

function companyId(req: Request): number {
  return req.auth!.companyId;
}

export const branchesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await branchesRepository.listForCompany(companyId(req)));
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const parsed = createBranchSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid input", 422, parsed.error.flatten());
    const branch = await branchesRepository.create({
      iasCompanyId: companyId(req),
      ...parsed.data,
    });
    ok(res, branch, "Branch created", 201);
  }),
};
