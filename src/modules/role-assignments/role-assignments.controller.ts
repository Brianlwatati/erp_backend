import type { Request, Response } from "express";
import { roleAssignmentsRepository } from "./role-assignments.repository.js";
import { assignRoleSchema } from "./role-assignments.validators.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

function companyId(req: Request): number {
  return req.auth!.companyId;
}

export const roleAssignmentsController = {
  listForUser: asyncHandler(async (req: Request, res: Response) => {
    const assignments = await roleAssignmentsRepository.listForUser(
      Number(req.params.userId),
      companyId(req),
    );
    ok(res, assignments);
  }),

  assign: asyncHandler(async (req: Request, res: Response) => {
    const parsed = assignRoleSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid input", 422, parsed.error.flatten());

    const assignment = await roleAssignmentsRepository.assign({
      ...parsed.data,
      iasCompanyId: companyId(req),
      assignedBy: req.auth!.userId,
    });
    ok(res, assignment, "Role assigned", 201);
  }),

  revoke: asyncHandler(async (req: Request, res: Response) => {
    await roleAssignmentsRepository.revoke(Number(req.params.id), companyId(req));
    ok(res, null, "Role assignment revoked");
  }),

  // GET /role-assignments/me/scope — getUserScope() for the caller
  getMyScope: asyncHandler(async (req: Request, res: Response) => {
    const scope = await roleAssignmentsRepository.getUserScope(
      req.auth!.userId,
      companyId(req),
    );
    ok(res, scope);
  }),
};
