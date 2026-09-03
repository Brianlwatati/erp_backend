import { query, queryOne, withTransaction } from "../../config/db.js";

async function postJournal(
  client: any,
  companyId: number,
  userId: number,
  referenceType: string,
  referenceId: number,
  description: string,
  lines: Array<{ accountCode: string; debit: number; credit: number }>,
  entryDate?: string,
) {
  const entry = (
    await client.query(
      `INSERT INTO erp_journal_entries(ias_company_id,reference_type,reference_id,description,entry_date,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
      [
        companyId,
        referenceType,
        referenceId,
        description,
        entryDate || null,
        userId,
      ],
    )
  ).rows[0];
  for (const line of lines) {
    await client.query(
      `INSERT INTO erp_journal_lines(ias_company_id,journal_entry_id,account_code,debit,credit) VALUES($1,$2,$3,$4,$5)`,
      [companyId, entry.id, line.accountCode, line.debit, line.credit],
    );
  }
  return entry;
}

export const financeRepository = {
  invoices: (c: number, status?: string) =>
    query(
      `SELECT i.*,ct.name AS "customerName" FROM erp_invoices i JOIN erp_contacts ct ON ct.id=i.customer_id WHERE i.ias_company_id=$1 AND ($2::varchar IS NULL OR i.status=$2) ORDER BY i.issue_date DESC,i.id DESC`,
      [c, status ?? null],
    ),
  invoice: (id: number, c: number) =>
    queryOne(
      `SELECT i.*,ct.name AS "customerName" FROM erp_invoices i JOIN erp_contacts ct ON ct.id=i.customer_id WHERE i.id=$1 AND i.ias_company_id=$2`,
      [id, c],
    ),
  invoiceItems: (id: number) =>
    query(`SELECT * FROM erp_invoice_items WHERE invoice_id=$1`, [id]),
  createFromOrder: async (id: number, c: number, u: number) =>
    withTransaction(async (client) => {
      const o = await client.query(
        `SELECT * FROM erp_sales_orders WHERE id=$1 AND ias_company_id=$2`,
        [id, c],
      );
      if (!o.rowCount) throw new Error("Sales order not found");
      const existing = await client.query(
        `SELECT id FROM erp_invoices WHERE sales_order_id=$1 AND ias_company_id=$2`,
        [id, c],
      );
      if (existing.rowCount)
        throw new Error("Invoice already exists for this order");
      const items = await client.query(
        `SELECT * FROM erp_sales_order_items WHERE sales_order_id=$1`,
        [id],
      );
      let sub = 0,
        tax = 0;
      for (const i of items.rows) {
        const base =
          Number(i.quantity) * Number(i.unit_price) - Number(i.discount_amount);
        sub += base;
        tax += (base * Number(i.tax_rate)) / 100;
      }
      const inv = (
        await client.query(
          `INSERT INTO erp_invoices(ias_company_id,invoice_number,customer_id,sales_order_id,status,currency,subtotal,tax_amount,total_amount,created_by) VALUES($1,$2,$3,$4,'OPEN',$5,$6,$7,$8,$9) RETURNING *`,
          [
            c,
            `INV-${Date.now()}`,
            o.rows[0].customer_id,
            id,
            o.rows[0].currency,
            sub,
            tax,
            sub + tax,
            u,
          ],
        )
      ).rows[0];
      for (const i of items.rows)
        await client.query(
          `INSERT INTO erp_invoice_items(invoice_id,product_id,product_sku,product_name,quantity,unit_price,tax_rate,line_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8)`,
          [
            inv.id,
            i.product_id,
            i.product_sku,
            i.product_name,
            i.quantity,
            i.unit_price,
            i.tax_rate,
            i.line_total,
          ],
        );
      return inv;
    }),
  payment: async (c: number, u: number, x: any) =>
    withTransaction(async (client) => {
      const p = (
        await client.query(
          `INSERT INTO erp_payments(ias_company_id,customer_id,payment_reference,amount,payment_date,method,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [
            c,
            x.customerId,
            x.paymentReference || `PAY-${Date.now()}`,
            x.amount,
            x.paymentDate || null,
            x.method || "CASH",
            x.notes ?? null,
            u,
          ],
        )
      ).rows[0];
      let remaining = x.amount;
      for (const a of x.allocations) {
        if (remaining <= 0) break;
        const inv = await client.query(
          `SELECT * FROM erp_invoices WHERE id=$1 AND ias_company_id=$2 FOR UPDATE`,
          [a.invoiceId, c],
        );
        if (!inv.rowCount) throw new Error("Invoice not found");
        const due =
          Number(inv.rows[0].total_amount) - Number(inv.rows[0].paid_amount);
        const applied = Math.min(Number(a.amount), due, remaining);
        if (applied <= 0) continue;
        await client.query(
          `INSERT INTO erp_payment_allocations(payment_id,invoice_id,amount) VALUES($1,$2,$3)`,
          [p.id, a.invoiceId, applied],
        );
        const paid = Number(inv.rows[0].paid_amount) + applied;
        await client.query(
          `UPDATE erp_invoices SET paid_amount=$1,status=$2 WHERE id=$3`,
          [
            paid,
            paid >= Number(inv.rows[0].total_amount)
              ? "PAID"
              : "PARTIALLY_PAID",
            a.invoiceId,
          ],
        );
        remaining -= applied;
      }
      return p;
    }),
  journal: (c: number, u: number, x: any) =>
    withTransaction(async (client) => {
      const debit = x.lines.reduce(
          (s: any, l: any) => s + Number(l.debit || 0),
          0,
        ),
        credit = x.lines.reduce(
          (s: any, l: any) => s + Number(l.credit || 0),
          0,
        );
      if (Math.abs(debit - credit) > 0.001)
        throw new Error("Journal must balance");
      const e = (
        await client.query(
          `INSERT INTO erp_journal_entries(ias_company_id,reference_type,reference_id,description,entry_date,created_by) VALUES($1,$2,$3,$4,$5,$6) RETURNING *`,
          [
            c,
            x.referenceType ?? null,
            x.referenceId ?? null,
            x.description,
            x.entryDate || null,
            u,
          ],
        )
      ).rows[0];
      for (const l of x.lines)
        await client.query(
          `INSERT INTO erp_journal_lines(journal_entry_id,account_code,debit,credit) VALUES($1,$2,$3,$4)`,
          [e.id, l.accountCode, l.debit || 0, l.credit || 0],
        );
      return e;
    }),
  ar: (c: number) =>
    query(
      `SELECT i.*,ct.name AS "customerName",i.total_amount-i.paid_amount AS outstanding FROM erp_invoices i JOIN erp_contacts ct ON ct.id=i.customer_id WHERE i.ias_company_id=$1 AND i.status<>'PAID' ORDER BY i.due_date NULLS LAST`,
      [c],
    ),
  supplierBills: (c: number) =>
    query(
      `SELECT b.*,s.name AS "supplierName",b.total_amount-b.paid_amount AS outstanding FROM erp_supplier_bills b JOIN erp_contacts s ON s.id=b.supplier_id WHERE b.ias_company_id=$1 ORDER BY b.issue_date DESC,b.id DESC`,
      [c],
    ),
  ap: (c: number) =>
    query(
      `SELECT b.*,s.name AS "supplierName",b.total_amount-b.paid_amount AS outstanding FROM erp_supplier_bills b JOIN erp_contacts s ON s.id=b.supplier_id WHERE b.ias_company_id=$1 AND b.status<>'PAID' ORDER BY b.due_date NULLS LAST,b.issue_date DESC`,
      [c],
    ),
  supplierBillFromOrder: async (id: number, c: number, u: number) =>
    withTransaction(async (client) => {
      const order = await client.query(
        `SELECT * FROM erp_purchase_orders WHERE id=$1 AND ias_company_id=$2 FOR UPDATE`,
        [id, c],
      );
      if (!order.rowCount) throw new Error("Purchase order not found");
      if (order.rows[0].status !== "RECEIVED")
        throw new Error("Purchase order must be fully received before billing");
      const existing = await client.query(
        `SELECT id FROM erp_supplier_bills WHERE purchase_order_id=$1 AND ias_company_id=$2`,
        [id, c],
      );
      if (existing.rowCount)
        throw new Error("A supplier bill already exists for this order");
      const items = await client.query(
        `SELECT * FROM erp_purchase_order_items WHERE purchase_order_id=$1 AND ias_company_id=$2`,
        [id, c],
      );
      const bill = (
        await client.query(
          `INSERT INTO erp_supplier_bills(ias_company_id,bill_number,supplier_id,purchase_order_id,status,currency,subtotal,tax_amount,total_amount,created_by) VALUES($1,$2,$3,$4,'OPEN',$5,$6,$7,$8,$9) RETURNING *`,
          [
            c,
            `BILL-${Date.now()}`,
            order.rows[0].supplier_id,
            id,
            order.rows[0].currency,
            order.rows[0].subtotal,
            order.rows[0].tax_amount,
            order.rows[0].total_amount,
            u,
          ],
        )
      ).rows[0];
      for (const item of items.rows) {
        await client.query(
          `INSERT INTO erp_supplier_bill_items(ias_company_id,supplier_bill_id,product_id,product_sku,product_name,quantity,unit_cost,tax_rate,line_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            c,
            bill.id,
            item.product_id,
            item.product_sku,
            item.product_name,
            item.quantity,
            item.unit_cost,
            item.tax_rate,
            item.line_total,
          ],
        );
      }
      await postJournal(
        client,
        c,
        u,
        "SUPPLIER_BILL",
        bill.id,
        `Supplier bill ${bill.bill_number}`,
        [
          {
            accountCode: "INVENTORY",
            debit: Number(bill.total_amount),
            credit: 0,
          },
          {
            accountCode: "ACCOUNTS_PAYABLE",
            debit: 0,
            credit: Number(bill.total_amount),
          },
        ],
      );
      return bill;
    }),
  supplierPayment: async (c: number, u: number, x: any) =>
    withTransaction(async (client) => {
      const payment = (
        await client.query(
          `INSERT INTO erp_supplier_payments(ias_company_id,supplier_id,payment_reference,amount,payment_date,method,notes,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING *`,
          [
            c,
            x.supplierId ?? null,
            x.paymentReference || `SPAY-${Date.now()}`,
            x.amount,
            x.paymentDate || null,
            x.method || "CASH",
            x.notes ?? null,
            u,
          ],
        )
      ).rows[0];
      let remaining = Number(x.amount);
      let supplierId = x.supplierId ? Number(x.supplierId) : null;
      for (const allocation of x.allocations) {
        if (remaining <= 0) break;
        const bill = await client.query(
          `SELECT * FROM erp_supplier_bills WHERE id=$1 AND ias_company_id=$2 FOR UPDATE`,
          [allocation.billId, c],
        );
        if (!bill.rowCount) throw new Error("Supplier bill not found");
        if (supplierId && supplierId !== Number(bill.rows[0].supplier_id))
          throw new Error("Supplier does not match the selected bill");
        if (!supplierId) {
          supplierId = Number(bill.rows[0].supplier_id);
          await client.query(
            `UPDATE erp_supplier_payments SET supplier_id=$1 WHERE id=$2 AND ias_company_id=$3`,
            [supplierId, payment.id, c],
          );
        }
        const due =
          Number(bill.rows[0].total_amount) - Number(bill.rows[0].paid_amount);
        const applied = Math.min(Number(allocation.amount), due, remaining);
        if (applied <= 0) continue;
        await client.query(
          `INSERT INTO erp_supplier_payment_allocations(ias_company_id,payment_id,bill_id,amount) VALUES($1,$2,$3,$4)`,
          [c, payment.id, allocation.billId, applied],
        );
        const paid = Number(bill.rows[0].paid_amount) + applied;
        await client.query(
          `UPDATE erp_supplier_bills SET paid_amount=$1,status=$2 WHERE id=$3 AND ias_company_id=$4`,
          [
            paid,
            paid >= Number(bill.rows[0].total_amount)
              ? "PAID"
              : "PARTIALLY_PAID",
            allocation.billId,
            c,
          ],
        );
        remaining -= applied;
      }
      if (remaining > 0.001)
        throw new Error("Payment exceeds the allocated bill balance");
      await postJournal(
        client,
        c,
        u,
        "SUPPLIER_PAYMENT",
        payment.id,
        `Supplier payment ${payment.payment_reference}`,
        [
          {
            accountCode: "ACCOUNTS_PAYABLE",
            debit: Number(payment.amount),
            credit: 0,
          },
          { accountCode: "CASH", debit: 0, credit: Number(payment.amount) },
        ],
        payment.payment_date,
      );
      return payment;
    }),
};
