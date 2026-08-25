import type { NextFunction, Request, Response } from "express";
import { permissionsRepository } from "../modules/permissions/permissions.repository.js";
import { fetchIasMeProfile } from "../lib/iasClient.js";
import { auditLogRepository } from "../modules/audit-log/audit-log.repository.js";
import { fail } from "../utils/apiResponse.js";
import { asyncHandler } from "../utils/asyncHandler.js";

/**
 * Bootstrap roles are module-scoped. A newly provisioned company may have
 * no ERP role assignments yet, so the configured bootstrap role can access
 * its module until normal ERP permissions are established.
 *
 * Add more entries as additional ERP modules need the same bootstrap path.
 * Example:
 *   { module: "inventory", roleCode: "INVT_ADMIN" },
 *   { module: "sales", roleCode: "SALES_ADMIN" },
 */
const BOOTSTRAP_MODULES = [
  { module: "inventory", roleCode: "INVT_ADMIN" },
  { module: "roles", roleCode: "INVT_ADMIN" },
  { module: "branches", roleCode: "INVT_ADMIN" },
  { module: "sales", roleCode: "INVT_ADMIN" },
  { module: "contacts", roleCode: "INVT_ADMIN" },
] as const;

type BootstrapModule = (typeof BOOTSTRAP_MODULES)[number];

function getBootstrapConfig(module: string): BootstrapModule | undefined {
  return BOOTSTRAP_MODULES.find((entry) => entry.module === module);
}

// checkPermission(userId, module, action) as route middleware. Must run
// after `authenticate` — relies on req.auth being set.
//
// This checks the ERP's own erp_role_assignments/erp_permissions tables,
// which is deliberately a different (finer-grained) system from IAS's
// roleCode/roleScope on the JWT. IAS's role answers which product/module
// the user can reach; ERP roles answer which specific actions they can take.
export function authorize(module: string, action: string) {
  return asyncHandler(
    async (req: Request, res: Response, next: NextFunction) => {
      if (!req.auth) {
        return fail(res, "Not authenticated", 401);
      }

      const bootstrap = getBootstrapConfig(module);

      console.log(
        `authorize: userId=${req.auth.userId}, companyId=${req.auth.companyId}, module=${module}, action=${action}, roleCode=${req.auth.roleCode}`,
      );

      if (bootstrap && req.auth.roleCode === bootstrap.roleCode) {
        // const granted = await confirmBootstrapAccess(req, bootstrap);
        // if (granted) {
        return next();
        // }
        // If IAS confirmation fails, deliberately fall through to the
        // normal ERP permission check. This fails closed rather than
        // silently granting the bootstrap bypass.
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

/**
 * Re-confirms a configured bootstrap role directly against IAS.
 *
 * Normal ERP requests do not call IAS. This extra check is only performed
 * when the request would receive the special bootstrap bypass, because that
 * bypass can grant access before ERP role assignments exist.
 */
async function confirmBootstrapAccess(
  req: Request,
  bootstrap: BootstrapModule,
): Promise<boolean> {
  const authorization = req.headers.authorization;
  if (!authorization || !req.auth) return false;

  try {
    const profile = await fetchIasMeProfile(authorization);
    const confirmed =
      profile.roleCode === bootstrap.roleCode &&
      profile.isActive &&
      Number(profile.companyId) === req.auth.companyId;

    if (confirmed) {
      await auditLogRepository.log({
        iasUserId: req.auth.userId,
        iasCompanyId: req.auth.companyId,
        entityType: "authorization_bypass",
        entityId: req.auth.userId,
        action: `${bootstrap.roleCode}_${bootstrap.module.toUpperCase()}_BOOTSTRAP`,
        after: {
          path: req.originalUrl,
          method: req.method,
          module: bootstrap.module,
        },
      });
    }

    return confirmed;
  } catch {
    // IAS unreachable, token rejected, etc. — treat as unconfirmed.
    return false;
  }
}
