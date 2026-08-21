import { query, queryOne } from "../../config/db.js";

export const approvalLimitsRepository = {
  // getApprovalLimit(userId, module)
  getForUser: (iasUserId: number, iasCompanyId: number, module: string) =>
    queryOne<{ maxAmount: string; currency: string }>(
      `SELECT max_amount AS "maxAmount", currency
       FROM erp_approval_limits
       WHERE ias_user_id = $1 AND ias_company_id = $2 AND module = $3`,
      [iasUserId, iasCompanyId, module],
    ),

  set: (input: {
    iasUserId: number;
    iasCompanyId: number;
    module: string;
    maxAmount: number;
    currency: string;
  }) =>
    query(
      `INSERT INTO erp_approval_limits (ias_user_id, ias_company_id, module, max_amount, currency)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (ias_user_id, ias_company_id, module)
       DO UPDATE SET max_amount = EXCLUDED.max_amount, currency = EXCLUDED.currency`,
      [input.iasUserId, input.iasCompanyId, input.module, input.maxAmount, input.currency],
    ),
};
