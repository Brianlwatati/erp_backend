import type { Request, Response } from "express";
import { auditLogRepository } from "./audit-log.repository.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const auditLogController = {
  getHistory: asyncHandler(async (req: Request, res: Response) => {
    const { entityType, entityId } = req.query;
    if (typeof entityType !== "string" || typeof entityId !== "string") {
      return fail(res, "entityType and entityId query params are required", 422);
    }
    const history = await auditLogRepository.getHistory(entityType, Number(entityId));
    ok(res, history);
  }),
};
