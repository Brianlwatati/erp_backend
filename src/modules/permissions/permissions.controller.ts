import type { Request, Response } from "express";
import { permissionsRepository } from "./permissions.repository.js";
import { ok } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const permissionsController = {
  list: asyncHandler(async (_req: Request, res: Response) => {
    const permissions = await permissionsRepository.listAll();
    ok(res, permissions);
  }),
};
