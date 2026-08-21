import type { Request, Response } from "express";
import { rolesService, NotFoundError } from "./roles.service.js";
import {
  createRoleSchema,
  updateRoleSchema,
  setPermissionsSchema,
} from "./roles.validators.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

// companyId now comes pre-coerced to a number straight off the verified JWT
// (see req.auth in middleware/authenticate.ts) — no per-controller parsing
// needed, but every route here is still company-scoped, so this stays as
// a one-line accessor rather than inlining req.auth!.companyId everywhere.
function companyId(req: Request): number {
  return req.auth!.companyId;
}

export const rolesController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const roles = await rolesService.list(companyId(req));
    ok(res, roles);
  }),

  get: asyncHandler(async (req: Request, res: Response) => {
    try {
      const role = await rolesService.get(Number(req.params.id), companyId(req));
      ok(res, role);
    } catch (error) {
      if (error instanceof NotFoundError) return fail(res, error.message, 404);
      throw error;
    }
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const parsed = createRoleSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid input", 422, parsed.error.flatten());
    const role = await rolesService.create(companyId(req), parsed.data);
    ok(res, role, "Role created", 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateRoleSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid input", 422, parsed.error.flatten());
    try {
      const role = await rolesService.update(
        Number(req.params.id),
        companyId(req),
        parsed.data,
      );
      ok(res, role, "Role updated");
    } catch (error) {
      if (error instanceof NotFoundError) return fail(res, error.message, 404);
      throw error;
    }
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await rolesService.remove(Number(req.params.id), companyId(req));
    ok(res, null, "Role deleted");
  }),

  getPermissionMatrix: asyncHandler(async (req: Request, res: Response) => {
    try {
      const matrix = await rolesService.getPermissionMatrix(
        Number(req.params.id),
        companyId(req),
      );
      ok(res, matrix);
    } catch (error) {
      if (error instanceof NotFoundError) return fail(res, error.message, 404);
      throw error;
    }
  }),

  setPermissions: asyncHandler(async (req: Request, res: Response) => {
    const parsed = setPermissionsSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid input", 422, parsed.error.flatten());
    try {
      const matrix = await rolesService.setPermissions(
        Number(req.params.id),
        companyId(req),
        parsed.data.permissionIds,
      );
      ok(res, matrix, "Permissions updated");
    } catch (error) {
      if (error instanceof NotFoundError) return fail(res, error.message, 404);
      throw error;
    }
  }),
};
