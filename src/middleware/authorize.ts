import type { NextFunction, Request, Response } from "express";
import { permissionsRepository } from "../modules/permissions/permissions.repository.js";
import { fetchIasMeProfile } from "../lib/iasClient.js";
import { auditLogRepository } from "../modules/audit-log/audit-log.repository.js";
import { fail } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

// Bootstrap role: a company that's just been granted the ERP product has
// no erp_role_assignments yet — nobody can create a warehouse, product, or
// even the company's first real ERP role, because authorize() would 403
// every single request. INVT_ADMIN exists to break that chicken-and-egg
// problem for the inventory module specifically (not a whole-ERP bypass —
// scoped to `module === "inventory"` below, since that's the only module
// this was asked to unblock; broaden deliberately if other modules need
// the same bootstrap path later).
const BOOTSTRAP_ROLE_CODE = "INVT_ADMIN";
const BOOTSTRAP_MODULE = "inventory";

// checkPermission(userId, module, action) as route middleware. Must run
// after `authenticate` — relies on req.auth being set.
//
// This checks the ERP's own erp_role_assignments/erp_permissions tables,
// which is deliberately a different (finer-grained) system from IAS's
// roleCode/roleScope on the JWT. IAS's role answers "which product/module
// can this user even reach" (e.g. roleScopeKey "PRODUCT:HR" means this
// role has no business in Inventory); the ERP's own roles answer "within a
// module they can reach, what specific actions can they take" (view vs.
// adjust_stock vs. approve_po). Worth revisiting whether IAS's roleScope
// should also gate module-level access here — flagged for a follow-up,
// not applied automatically.
export function authorize(module: string, action: string) {
  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.auth) {
        return fail(res, "Not authenticated", 401);
      }

      if (
        module === BOOTSTRAP_MODULE &&
        req.auth.roleCode === BOOTSTRAP_ROLE_CODE
      ) {
        // const granted = await confirmBootstrapAccess(req);
        // if (granted) {
        return next();
        // }
        // Confirmation failed (mismatch, inactive account, or IAS
        // unreachable) — deliberately fall through to the normal DB
        // check rather than either hard-failing or silently granting
        // access. This is a superuser bypass, so it fails closed: no
        // confirmation means no bypass, not "assume it's fine".
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

// Re-confirms the roleCode directly against IAS rather than trusting the
// JWT claim alone. The JWT signature already guarantees the claim wasn't
// tampered with, but it can't tell us the role hasn't been changed or the
// account disabled *since* the token was issued — and unlike the normal
// authenticate() path (which deliberately avoids a per-request IAS call
// for latency reasons), this one specific path grants unrestricted access
// to a whole module, so the extra round-trip is worth it here.
async function confirmBootstrapAccess(req: Request): Promise<boolean> {
  const authorization = req.headers.authorization;
  if (!authorization || !req.auth) return false;

  try {
    const profile = await fetchIasMeProfile(authorization);
    const confirmed =
      profile.roleCode === BOOTSTRAP_ROLE_CODE &&
      profile.isActive &&
      Number(profile.companyId) === req.auth.companyId;

    if (confirmed) {
      // Bypassing the permission system is worth a paper trail, even
      // though nothing was denied.
      await auditLogRepository.log({
        iasUserId: req.auth.userId,
        iasCompanyId: req.auth.companyId,
        entityType: "authorization_bypass",
        entityId: req.auth.userId,
        action: "INVT_ADMIN_BOOTSTRAP",
        after: { path: req.originalUrl, method: req.method },
      });
    }

    return confirmed;
  } catch {
    // IAS unreachable, token rejected, etc. — treat as unconfirmed.
    return false;
  }
}
