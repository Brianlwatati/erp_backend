import type { Request, Response } from "express";
import { permissionsRepository } from "./permissions.repository.js";
import { fail, ok } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const permissionsController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const permissions = await permissionsRepository.listAll();
    ok(res, permissions);
  }),
  listForUser: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) {
      fail(res, "Authentication context missing", 401);
      return;
    }

    const permissions = await permissionsRepository.listForUser(
      String(req.auth.userId),
    );
    ok(res, permissions);
  }),
};
