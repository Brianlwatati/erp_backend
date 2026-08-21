import { query } from "../../config/db.js";

export const auditLogRepository = {
  // logAuditEvent — called from other modules' services, not exposed
  // directly as a write route (nothing outside the app should be able to
  // forge audit entries).
  log: (input: {
    iasUserId: number;
    iasCompanyId: number;
    entityType: string;
    entityId: number;
    action: string;
    before?: unknown;
    after?: unknown;
  }) =>
    query(
      `INSERT INTO erp_audit_log
         (ias_user_id, ias_company_id, entity_type, entity_id, action, before_state, after_state)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [
        input.iasUserId,
        input.iasCompanyId,
        input.entityType,
        input.entityId,
        input.action,
        input.before ? JSON.stringify(input.before) : null,
        input.after ? JSON.stringify(input.after) : null,
      ],
    ),

  getHistory: (entityType: string, entityId: number) =>
    query(
      `SELECT id, ias_user_id AS "iasUserId", action,
              before_state AS "before", after_state AS "after",
              created_at AS "createdAt"
       FROM erp_audit_log
       WHERE entity_type = $1 AND entity_id = $2
       ORDER BY created_at DESC`,
      [entityType, entityId],
    ),
};
