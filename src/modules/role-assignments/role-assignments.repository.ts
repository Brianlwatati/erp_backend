import { query, queryOne } from "../../config/db.js";
import type { ErpRoleAssignment } from "../../types/domain.js";

const SELECT = `
  SELECT id, ias_user_id AS "iasUserId", ias_company_id AS "iasCompanyId",
         role_id AS "roleId", branch_id AS "branchId",
         assigned_at AS "assignedAt", assigned_by AS "assignedBy"
  FROM erp_role_assignments
`;

export const roleAssignmentsRepository = {
  listForUser: (iasUserId: number, iasCompanyId: number) =>
    query<ErpRoleAssignment>(
      `${SELECT} WHERE ias_user_id = $1 AND ias_company_id = $2 ORDER BY assigned_at DESC`,
      [iasUserId, iasCompanyId],
    ),

  listForRole: (roleId: number) =>
    query<ErpRoleAssignment>(`${SELECT} WHERE role_id = $1`, [roleId]),

  assign: (input: {
    iasUserId: number;
    iasCompanyId: number;
    roleId: number;
    branchId?: number | null;
    assignedBy: number;
  }) =>
    queryOne<ErpRoleAssignment>(
      `INSERT INTO erp_role_assignments
         (ias_user_id, ias_company_id, role_id, branch_id, assigned_by)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (ias_user_id, ias_company_id, role_id, branch_id)
       DO UPDATE SET assigned_at = now(), assigned_by = EXCLUDED.assigned_by
       RETURNING id, ias_user_id AS "iasUserId", ias_company_id AS "iasCompanyId",
                 role_id AS "roleId", branch_id AS "branchId",
                 assigned_at AS "assignedAt", assigned_by AS "assignedBy"`,
      [input.iasUserId, input.iasCompanyId, input.roleId, input.branchId ?? null, input.assignedBy],
    ),

  revoke: (id: number, iasCompanyId: number) =>
    query(
      `DELETE FROM erp_role_assignments WHERE id = $1 AND ias_company_id = $2`,
      [id, iasCompanyId],
    ),

  // getUserScope(userId): every branch this user's roles touch, plus a
  // flag for whether any assignment is company-wide (branch_id IS NULL).
  getUserScope: async (iasUserId: number, iasCompanyId: number) => {
    const rows = await query<{ branchId: number | null }>(
      `SELECT DISTINCT branch_id AS "branchId"
       FROM erp_role_assignments
       WHERE ias_user_id = $1 AND ias_company_id = $2`,
      [iasUserId, iasCompanyId],
    );
    return {
      companyWide: rows.some((r) => r.branchId === null),
      branchIds: rows.map((r) => r.branchId).filter((id): id is number => id !== null),
    };
  },
};
