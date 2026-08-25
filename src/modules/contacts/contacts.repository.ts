import { query, queryOne } from "../../config/db.js";
export const contactsRepository = {
  list: (c: number, type?: string) =>
    query(
      `SELECT id,ias_company_id AS "iasCompanyId",contact_type AS "contactType",name,phone,email,address,tax_id AS "taxId",credit_limit AS "creditLimit",status,created_at AS "createdAt",updated_at AS "updatedAt" FROM erp_contacts WHERE ias_company_id=$1 AND ($2::varchar IS NULL OR contact_type=$2) ORDER BY name`,
      [c, type ?? null],
    ),
  find: (id: number, c: number) =>
    queryOne(`SELECT * FROM erp_contacts WHERE id=$1 AND ias_company_id=$2`, [
      id,
      c,
    ]),
  create: (c: number, x: any) =>
    queryOne(
      `INSERT INTO erp_contacts(ias_company_id,contact_type,name,phone,email,address,tax_id,credit_limit) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
      [
        c,
        x.contactType,
        x.name,
        x.phone ?? null,
        x.email ?? null,
        x.address ?? null,
        x.taxId ?? null,
        x.creditLimit ?? 0,
      ],
    ),
  update: (id: number, c: number, x: any) =>
    queryOne(
      `UPDATE erp_contacts SET name=COALESCE($3,name),phone=COALESCE($4,phone),email=COALESCE($5,email),address=COALESCE($6,address),tax_id=COALESCE($7,tax_id),credit_limit=COALESCE($8,credit_limit),status=COALESCE($9,status),updated_at=now() WHERE id=$1 AND ias_company_id=$2 RETURNING *`,
      [
        id,
        c,
        x.name ?? null,
        x.phone ?? null,
        x.email ?? null,
        x.address ?? null,
        x.taxId ?? null,
        x.creditLimit ?? null,
        x.status ?? null,
      ],
    ),
  history: (id: number, c: number) =>
    query(
      `SELECT * FROM erp_contact_interactions WHERE contact_id=$1 AND ias_company_id=$2 ORDER BY occurred_at DESC`,
      [id, c],
    ),
  interaction: (c: number, id: number, u: number, x: any) =>
    queryOne(
      `INSERT INTO erp_contact_interactions(ias_company_id,contact_id,interaction_type,notes,created_by) VALUES($1,$2,$3,$4,$5) RETURNING *`,
      [c, id, x.interactionType, x.notes ?? null, u],
    ),
};
