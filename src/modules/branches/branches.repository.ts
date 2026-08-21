import { query, queryOne } from "../../config/db.js";
import type { ErpBranch } from "../../types/domain.js";

const SELECT = `
  SELECT id, ias_company_id AS "iasCompanyId", name, code, status
  FROM erp_branches
`;

export const branchesRepository = {
  listForCompany: (iasCompanyId: number) =>
    query<ErpBranch>(`${SELECT} WHERE ias_company_id = $1 ORDER BY name`, [
      iasCompanyId,
    ]),

  findById: (id: number, iasCompanyId: number) =>
    queryOne<ErpBranch>(`${SELECT} WHERE id = $1 AND ias_company_id = $2`, [
      id,
      iasCompanyId,
    ]),

  create: (input: { iasCompanyId: number; name: string; code: string }) =>
    queryOne<ErpBranch>(
      `INSERT INTO erp_branches (ias_company_id, name, code)
       VALUES ($1, $2, $3)
       RETURNING id, ias_company_id AS "iasCompanyId", name, code, status`,
      [input.iasCompanyId, input.name, input.code],
    ),
};
