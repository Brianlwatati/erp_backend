import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { fail } from "../utils/apiResponse.js";
import type {
  AccessTokenPayload,
  AccessTokenUser,
} from "../modules/auth/auth.types.js";

// Mirrors IAS's own verifyAuth exactly — same secret, same issuer/audience,
// same payload shape. Verifying locally means no per-request network hop
// to IAS and no outage there taking down every other service with it; the
// tradeoff is that a user disabled/role-changed in IAS stays valid here
// until their access token expires (JWT_ACCESS_EXPIRES_IN — 15m by
// default), not instantly. Acceptable for this service's needs; revisit if
// that window ever becomes a problem (e.g. a revocation list).
function isPayload(
  value: string | jwt.JwtPayload,
): value is AccessTokenPayload {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof value.sub === "string" &&
    typeof value.roleName === "string" &&
    typeof value.companyId === "string" &&
    typeof value.roleCode === "string" &&
    typeof value.roleScope === "string" &&
    typeof value.roleScopeKey === "string"
  );
}

export function authenticate(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const header = req.headers.authorization;
  if (!header?.startsWith("Bearer ")) {
    fail(res, "Missing or malformed Authorization header", 401);
    return;
  }

  try {
    const decoded = jwt.verify(
      header.slice("Bearer ".length).trim(),
      env.jwtAccessSecret,
      {
        issuer: env.jwtIssuer,
        audience: env.jwtAudience,
      },
    );

    if (!isPayload(decoded)) throw new Error("Malformed token payload");

    const auth: AccessTokenUser = {
      userId: Number(decoded.sub),
      companyId: Number(decoded.companyId),
      roleName: decoded.roleName,
      roleCode: decoded.roleCode,
      roleScope: decoded.roleScope,
      roleScopeKey: decoded.roleScopeKey,
    };

    if (
      !Number.isSafeInteger(auth.userId) ||
      !Number.isSafeInteger(auth.companyId)
    ) {
      throw new Error("Invalid identity");
    }

    req.auth = auth;
    next();
  } catch {
    fail(res, "Invalid or expired access token", 401);
  }
}
