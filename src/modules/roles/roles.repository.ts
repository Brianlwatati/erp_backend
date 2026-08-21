import { query, queryOne } from "../../config/db.js";
import type { ErpRole } from "../../types/domain.js";

const SELECT_ROLE = `
  SELECT id, ias_company_id AS "iasCompanyId", name, code,
         is_default AS "isDefault", status, created_at AS "createdAt",
         updated_at AS "updatedAt"
  FROM erp_roles
`;

export const rolesRepository = {
  listForCompany: (iasCompanyId: number) =>
    query<ErpRole>(`${SELECT_ROLE} WHERE ias_company_id = $1 ORDER BY name`, [
      iasCompanyId,
    ]),

  findById: (id: number, iasCompanyId: number) =>
    queryOne<ErpRole>(`${SELECT_ROLE} WHERE id = $1 AND ias_company_id = $2`, [
      id,
      iasCompanyId,
    ]),

  findDefault: (iasCompanyId: number) =>
    queryOne<ErpRole>(
      `${SELECT_ROLE} WHERE ias_company_id = $1 AND is_default = true LIMIT 1`,
      [iasCompanyId],
    ),

  create: (input: { iasCompanyId: number; name: string; code: string; isDefault?: boolean }) =>
    queryOne<ErpRole>(
      `INSERT INTO erp_roles (ias_company_id, name, code, is_default)
       VALUES ($1, $2, $3, COALESCE($4, false))
       RETURNING id, ias_company_id AS "iasCompanyId", name, code,
                 is_default AS "isDefault", status, created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      [input.iasCompanyId, input.name, input.code, input.isDefault ?? false],
    ),

  update: (
    id: number,
    iasCompanyId: number,
    input: Partial<{ name: string; status: "ACTIVE" | "INACTIVE"; isDefault: boolean }>,
  ) =>
    queryOne<ErpRole>(
      `UPDATE erp_roles
       SET name = COALESCE($3, name),
           status = COALESCE($4, status),
           is_default = COALESCE($5, is_default),
           updated_at = now()
       WHERE id = $1 AND ias_company_id = $2
       RETURNING id, ias_company_id AS "iasCompanyId", name, code,
                 is_default AS "isDefault", status, created_at AS "createdAt",
                 updated_at AS "updatedAt"`,
      [id, iasCompanyId, input.name ?? null, input.status ?? null, input.isDefault ?? null],
    ),

  remove: (id: number, iasCompanyId: number) =>
    query(`DELETE FROM erp_roles WHERE id = $1 AND ias_company_id = $2`, [
      id,
      iasCompanyId,
    ]),
};
