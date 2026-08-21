import { query, queryOne } from "../../config/db.js";
import type { ErpPermission } from "../../types/domain.js";

export const permissionsRepository = {
  listAll: () =>
    query<ErpPermission>(
      `SELECT id, module, action, code FROM erp_permissions ORDER BY module, action`,
    ),

  findByCode: (code: string) =>
    queryOne<ErpPermission>(
      `SELECT id, module, action, code FROM erp_permissions WHERE code = $1`,
      [code],
    ),

  // The actual authorization check: does this IAS user, in this company,
  // hold a role (any branch) that grants `module:action`?
  userHasPermission: async (
    iasUserId: number,
    iasCompanyId: number,
    module: string,
    action: string,
  ): Promise<boolean> => {
    const rows = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM erp_role_assignments ra
         JOIN erp_role_permissions rp ON rp.role_id = ra.role_id
         JOIN erp_permissions p ON p.id = rp.permission_id
         WHERE ra.ias_user_id = $1
           AND ra.ias_company_id = $2
           AND p.module = $3
           AND p.action = $4
       ) AS exists`,
      [iasUserId, iasCompanyId, module, action],
    );
    return rows[0]?.exists ?? false;
  },

  // Full module×action grid for one role — powers getPermissionMatrix().
  getMatrixForRole: (roleId: number) =>
    query<ErpPermission>(
      `SELECT p.id, p.module, p.action, p.code
       FROM erp_role_permissions rp
       JOIN erp_permissions p ON p.id = rp.permission_id
       WHERE rp.role_id = $1
       ORDER BY p.module, p.action`,
      [roleId],
    ),

  setRolePermissions: async (roleId: number, permissionIds: number[]) => {
    await query(`DELETE FROM erp_role_permissions WHERE role_id = $1`, [roleId]);
    if (permissionIds.length === 0) return;
    const values = permissionIds
      .map((_, i) => `($1, $${i + 2})`)
      .join(", ");
    await query(
      `INSERT INTO erp_role_permissions (role_id, permission_id) VALUES ${values}`,
      [roleId, ...permissionIds],
    );
  },
};
