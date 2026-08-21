import { query, queryOne } from "../../config/db.js";

export const provisioningRepository = {
  // Idempotency guard — IAS may retry a webhook delivery; this makes
  // replays a no-op instead of re-seeding duplicate default data.
  hasProcessed: async (
    eventType: string,
    iasCompanyId: number | null,
    iasUserId: number | null,
  ) => {
    const row = await queryOne<{ id: number }>(
      `SELECT id FROM erp_provisioning_events
       WHERE event_type = $1
         AND ias_company_id IS NOT DISTINCT FROM $2
         AND ias_user_id IS NOT DISTINCT FROM $3`,
      [eventType, iasCompanyId, iasUserId],
    );
    return row !== null;
  },

  markProcessed: (
    eventType: string,
    iasCompanyId: number | null,
    iasUserId: number | null,
  ) =>
    query(
      `INSERT INTO erp_provisioning_events (event_type, ias_company_id, ias_user_id)
       VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING`,
      [eventType, iasCompanyId, iasUserId],
    ),

  // onCompanyProvisioned(companyId): seed a default "Viewer" role and a
  // "Head Office" branch so the company has somewhere to land users.
  seedDefaultsForCompany: async (iasCompanyId: number) => {
    const role = await queryOne<{ id: number }>(
      `INSERT INTO erp_roles (ias_company_id, name, code, is_default)
       VALUES ($1, 'Viewer', 'VIEWER', true)
       RETURNING id`,
      [iasCompanyId],
    );

    if (role) {
      const viewPermissionIds = await query<{ id: number }>(
        `SELECT id FROM erp_permissions WHERE action = 'view'`,
      );
      if (viewPermissionIds.length > 0) {
        const values = viewPermissionIds.map((_, i) => `($1, $${i + 2})`).join(", ");
        await query(
          `INSERT INTO erp_role_permissions (role_id, permission_id) VALUES ${values}`,
          [role.id, ...viewPermissionIds.map((p) => p.id)],
        );
      }
    }

    await query(
      `INSERT INTO erp_branches (ias_company_id, name, code)
       VALUES ($1, 'Head Office', 'HQ')
       ON CONFLICT (ias_company_id, code) DO NOTHING`,
      [iasCompanyId],
    );
  },

  // onUserCreated(userId, companyId): assign the company's default role
  // until an admin sets something more specific.
  assignDefaultRoleToUser: async (iasUserId: number, iasCompanyId: number) => {
    const defaultRole = await queryOne<{ id: number }>(
      `SELECT id FROM erp_roles WHERE ias_company_id = $1 AND is_default = true LIMIT 1`,
      [iasCompanyId],
    );
    if (!defaultRole) return;

    await query(
      `INSERT INTO erp_role_assignments (ias_user_id, ias_company_id, role_id, branch_id)
       VALUES ($1, $2, $3, NULL)
       ON CONFLICT (ias_user_id, ias_company_id, role_id, branch_id) DO NOTHING`,
      [iasUserId, iasCompanyId, defaultRole.id],
    );
  },
};
