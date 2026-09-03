import { query, queryOne, withTransaction } from "../../config/db.js";
export const purchasingRepository = {
  list: (c: number, status?: string) =>
    query(
      `SELECT p.*,s.name AS "supplierName",w.name AS "warehouseName" FROM erp_purchase_orders p JOIN erp_contacts s ON s.id=p.supplier_id JOIN erp_warehouses w ON w.id=p.warehouse_id WHERE p.ias_company_id=$1 AND ($2::varchar IS NULL OR p.status=$2) ORDER BY p.created_at DESC`,
      [c, status ?? null],
    ),
  find: (id: number, c: number) =>
    queryOne(
      `SELECT p.*,s.name AS "supplierName",w.name AS "warehouseName" FROM erp_purchase_orders p JOIN erp_contacts s ON s.id=p.supplier_id JOIN erp_warehouses w ON w.id=p.warehouse_id WHERE p.id=$1 AND p.ias_company_id=$2`,
      [id, c],
    ),
  items: (id: number) =>
    query(`SELECT * FROM erp_purchase_order_items WHERE purchase_order_id=$1`, [
      id,
    ]),
  create: async (c: number, u: number, x: any) =>
    withTransaction(async (client) => {
      let sub = 0,
        tax = 0,
        arr = [];
      for (const i of x.items) {
        const p = await client.query(
          `SELECT id,sku,name FROM erp_products WHERE id=$1 AND ias_company_id=$2`,
          [i.productId, c],
        );
        if (!p.rowCount) throw new Error(`Product ${i.productId} not found`);
        const line = i.quantity * i.unitCost;
        const tx = (line * (i.taxRate || 0)) / 100;
        sub += line;
        tax += tx;
        arr.push({
          ...i,
          sku: p.rows[0].sku,
          name: p.rows[0].name,
          lineTotal: line + tx,
        });
      }
      const o = (
        await client.query(
          `INSERT INTO erp_purchase_orders(ias_company_id,po_number,supplier_id,warehouse_id,status,expected_date,currency,subtotal,tax_amount,total_amount,notes,created_by) VALUES($1,$2,$3,$4,'DRAFT',$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
          [
            c,
            x.poNumber || `PO-${Date.now()}`,
            x.supplierId,
            x.warehouseId,
            x.expectedDate || null,
            x.currency || "KES",
            sub,
            tax,
            sub + tax,
            x.notes ?? null,
            u,
          ],
        )
      ).rows[0];
      for (const i of arr)
        await client.query(
          `INSERT INTO erp_purchase_order_items(ias_company_id,purchase_order_id,product_id,product_sku,product_name,quantity,unit_cost,tax_rate,line_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            c,
            o.id,
            i.productId,
            i.sku,
            i.name,
            i.quantity,
            i.unitCost,
            i.taxRate || 0,
            i.lineTotal,
          ],
        );
      return o;
    }),
  approve: (id: number, c: number) =>
    queryOne(
      `UPDATE erp_purchase_orders SET status='APPROVED',updated_at=now() WHERE id=$1 AND ias_company_id=$2 AND status='DRAFT' RETURNING *`,
      [id, c],
    ),
  receive: async (id: number, c: number, u: number, x: any) =>
    withTransaction(async (client) => {
      const o = await client.query(
        `SELECT * FROM erp_purchase_orders WHERE id=$1 AND ias_company_id=$2 FOR UPDATE`,
        [id, c],
      );
      if (!o.rowCount) throw new Error("Purchase order not found");
      if (o.rows[0].status !== "APPROVED")
        throw new Error("PO must be APPROVED before receiving");
      const its = await client.query(
        `SELECT * FROM erp_purchase_order_items WHERE purchase_order_id=$1 FOR UPDATE`,
        [id],
      );
      const wh = (
        await client.query(`SELECT name FROM erp_warehouses WHERE id=$1`, [
          o.rows[0].warehouse_id,
        ])
      ).rows[0].name;
      for (const i of its.rows) {
        const qty =
          x.items?.find((z: any) => z.productId === Number(i.product_id))
            ?.quantity ?? Number(i.quantity) - Number(i.received_quantity);
        if (qty <= 0) continue;
        const s = await client.query(
          `SELECT * FROM erp_stock_levels WHERE product_id=$1 AND warehouse_id=$2 FOR UPDATE`,
          [i.product_id, o.rows[0].warehouse_id],
        );
        if (!s.rowCount) {
          await client.query(
            `INSERT INTO erp_stock_levels(ias_company_id,product_id,product_sku,product_name,warehouse_id,warehouse_name,quantity,average_cost) VALUES($1,$2,$3,$4,$5,$6,0,0)`,
            [
              c,
              i.product_id,
              i.product_sku,
              i.product_name,
              o.rows[0].warehouse_id,
              wh,
            ],
          );
        }
        const current = await client.query(
          `SELECT * FROM erp_stock_levels WHERE product_id=$1 AND warehouse_id=$2 FOR UPDATE`,
          [i.product_id, o.rows[0].warehouse_id],
        );
        const oldQty = Number(current.rows[0].quantity),
          oldCost = Number(current.rows[0].average_cost),
          cost = Number(i.unit_cost);
        const avg = (oldQty * oldCost + qty * cost) / (oldQty + qty);
        await client.query(
          `UPDATE erp_stock_levels SET quantity=quantity+$1,average_cost=$2,updated_at=now() WHERE id=$3`,
          [qty, avg, current.rows[0].id],
        );
        await client.query(
          `UPDATE erp_purchase_order_items SET received_quantity=received_quantity+$1 WHERE id=$2`,
          [qty, i.id],
        );
        await client.query(
          `INSERT INTO erp_stock_movements(ias_company_id,product_id,product_sku,product_name,warehouse_id,warehouse_name,quantity_delta,unit_cost,reason,reference_type,reference_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'RECEIVE','purchase_order',$9,$10)`,
          [
            c,
            i.product_id,
            i.product_sku,
            i.product_name,
            o.rows[0].warehouse_id,
            wh,
            qty,
            cost,
            id,
            u,
          ],
        );
      }
      const remaining = (
        await client.query(
          `SELECT COUNT(*)::int AS n FROM erp_purchase_order_items WHERE purchase_order_id=$1 AND received_quantity<quantity`,
          [id],
        )
      ).rows[0].n;
      return (
        await client.query(
          `UPDATE erp_purchase_orders SET status=$2,updated_at=now() WHERE id=$1 RETURNING *`,
          [id, remaining ? "PARTIALLY_RECEIVED" : "RECEIVED"],
        )
      ).rows[0];
    }),
};
