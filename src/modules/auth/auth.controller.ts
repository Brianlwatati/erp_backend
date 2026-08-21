import type { Request, Response } from "express";
import { fetchIasMeProfile } from "../../lib/iasClient.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const authController = {
  me: asyncHandler(async (req: Request, res: Response) => {
    if (!req.auth) {
      fail(res, "Authentication context missing", 401);
      return;
    }

    const authorization = req.headers.authorization;
    if (!authorization) {
      fail(res, "Missing Authorization header", 401);
      return;
    }

    const iasProfile = await fetchIasMeProfile(authorization);

    // IAS remains the source of truth for identity/profile data. The local
    // JWT claims are still used by authenticate() for the normal request path.
    ok(res, {
      user: iasProfile,
      auth: req.auth,
    }, "Current ERP session retrieved successfully");
  }),
};
