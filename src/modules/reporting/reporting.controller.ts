import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok } from "../../utils/apiResponse.js";
import { reportingRepository as r } from "./reporting.repository.js";
export const reportingController = {
  dashboard: asyncHandler(async (req, res) =>
    ok(res, await r.dashboard(req.auth!.companyId)),
  ),
  sales: asyncHandler(async (req, res) =>
    ok(
      res,
      await r.sales(
        req.auth!.companyId,
        typeof req.query.from === "string" ? req.query.from : undefined,
        typeof req.query.to === "string" ? req.query.to : undefined,
      ),
    ),
  ),
  lowStock: asyncHandler(async (req, res) =>
    ok(res, await r.lowStock(req.auth!.companyId)),
  ),
};
