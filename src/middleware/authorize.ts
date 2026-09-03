import type { NextFunction, Request, Response } from "express";
import { permissionsRepository } from "../modules/permissions/permissions.repository.js";
import { fail } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export function authorize(module: string, action: string) {
  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.auth) {
        return fail(res, "Not authenticated", 401);
      }

      if (req.auth.roleCode === "COMPANY_ADMIN") {
        return next();
      }

      const allowed = await permissionsRepository.userHasPermission(
        req.auth.userId,
        req.auth.companyId,
        module,
        action,
      );

      if (!allowed) {
        return fail(res, `Missing permission ${module}:${action}`, 403);
      }

      next();
    },
  );
}
