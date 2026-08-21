import { query } from "../../config/db.js";

export const approvalDelegationsRepository = {
  create: (input: {
    fromUserId: number;
    toUserId: number;
    iasCompanyId: number;
    module?: string | null;
    startsAt: string;
    endsAt: string;
  }) =>
    query(
      `INSERT INTO erp_approval_delegations
         (from_user_id, to_user_id, ias_company_id, module, starts_at, ends_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        input.fromUserId,
        input.toUserId,
        input.iasCompanyId,
        input.module ?? null,
        input.startsAt,
        input.endsAt,
      ],
    ),

  // getPendingApprovals-adjacent: which delegations currently cover `toUserId`.
  getActiveForUser: (toUserId: number, iasCompanyId: number) =>
    query(
      `SELECT id, from_user_id AS "fromUserId", module, starts_at AS "startsAt", ends_at AS "endsAt"
       FROM erp_approval_delegations
       WHERE to_user_id = $1 AND ias_company_id = $2
         AND now() BETWEEN starts_at AND ends_at`,
      [toUserId, iasCompanyId],
    ),
};
