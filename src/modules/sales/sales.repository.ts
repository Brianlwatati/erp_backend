import { query, queryOne, withTransaction } from "../../config/db.js";
export const salesRepository = {
  list: (c: number, status?: string) =>
    query(
      `SELECT o.*,c.name AS "customerName",w.name AS "warehouseName" FROM erp_sales_orders o JOIN erp_contacts c ON c.id=o.customer_id JOIN erp_warehouses w ON w.id=o.warehouse_id WHERE o.ias_company_id=$1 AND ($2::varchar IS NULL OR o.status=$2) ORDER BY o.created_at DESC`,
      [c, status ?? null],
    ),
  find: (id: number, c: number) =>
    queryOne(
      `SELECT o.*,c.name AS "customerName",w.name AS "warehouseName" FROM erp_sales_orders o JOIN erp_contacts c ON c.id=o.customer_id JOIN erp_warehouses w ON w.id=o.warehouse_id WHERE o.id=$1 AND o.ias_company_id=$2`,
      [id, c],
    ),
  items: (id: number) =>
    query(
      `SELECT * FROM erp_sales_order_items WHERE sales_order_id=$1 ORDER BY id`,
      [id],
    ),
  create: async (c: number, u: number, x: any) =>
    withTransaction(async (client) => {
      const orderNo = x.orderNumber || `SO-${Date.now()}`;
      const customer = await client.query(
        `SELECT id FROM erp_contacts WHERE id=$1 AND ias_company_id=$2 AND contact_type IN ('CUSTOMER','BOTH')`,
        [x.customerId, c],
      );
      if (!customer.rowCount) throw new Error("Customer not found");
      const wh = await client.query(
        `SELECT id FROM erp_warehouses WHERE id=$1 AND ias_company_id=$2 AND status='ACTIVE'`,
        [x.warehouseId, c],
      );
      if (!wh.rowCount) throw new Error("Warehouse not found");
      let subtotal = 0,
        tax = 0;
      const prepared = [];
      for (const i of x.items) {
        const p = await client.query(
          `SELECT id,sku,name,sell_price FROM erp_products WHERE id=$1 AND ias_company_id=$2 AND status='ACTIVE'`,
          [i.productId, c],
        );
        if (!p.rowCount) throw new Error(`Product ${i.productId} not found`);
        const q = i.quantity,
          price = i.unitPrice ?? Number(p.rows[0].sell_price);
        const disc = i.discountAmount ?? 0;
        const base = q * price - disc;
        const t = (base * (i.taxRate ?? 0)) / 100;
        subtotal += base;
        tax += t;
        prepared.push({
          ...i,
          sku: p.rows[0].sku,
          name: p.rows[0].name,
          unitPrice: price,
          lineTotal: base + t,
        });
      }
      const total = subtotal + tax;
      const o = await client.query(
        `INSERT INTO erp_sales_orders(ias_company_id,order_number,customer_id,warehouse_id,status,currency,subtotal,discount_amount,tax_amount,total_amount,notes,created_by) VALUES($1,$2,$3,$4,'DRAFT',$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
        [
          c,
          orderNo,
          x.customerId,
          x.warehouseId,
          x.currency || "KES",
          subtotal,
          prepared.reduce((s, i) => s + (i.discountAmount || 0), 0),
          tax,
          total,
          x.notes ?? null,
          u,
        ],
      );
      for (const i of prepared)
        await client.query(
          `INSERT INTO erp_sales_order_items(sales_order_id,product_id,product_sku,product_name,quantity,unit_price,discount_amount,tax_rate,line_total) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
          [
            o.rows[0].id,
            i.productId,
            i.sku,
            i.name,
            i.quantity,
            i.unitPrice,
            i.discountAmount || 0,
            i.taxRate || 0,
            i.lineTotal,
          ],
        );
      return o.rows[0];
    }),
  confirm: async (id: number, c: number) =>
    withTransaction(async (client) => {
      const o = await client.query(
        `SELECT * FROM erp_sales_orders WHERE id=$1 AND ias_company_id=$2 FOR UPDATE`,
        [id, c],
      );
      if (!o.rowCount) throw new Error("Sales order not found");
      if (o.rows[0].status !== "DRAFT")
        throw new Error("Only DRAFT orders can be confirmed");
      const items = await client.query(
        `SELECT * FROM erp_sales_order_items WHERE sales_order_id=$1`,
        [id],
      );
      for (const i of items.rows) {
        const s = await client.query(
          `SELECT quantity,reserved_quantity FROM erp_stock_levels WHERE product_id=$1 AND warehouse_id=$2 FOR UPDATE`,
          [i.product_id, o.rows[0].warehouse_id],
        );
        if (!s.rowCount)
          throw new Error(`No stock record for product ${i.product_sku}`);
        if (
          Number(s.rows[0].quantity) - Number(s.rows[0].reserved_quantity) <
          Number(i.quantity)
        )
          throw new Error(`Insufficient available stock for ${i.product_sku}`);
        await client.query(
          `UPDATE erp_stock_levels SET reserved_quantity=reserved_quantity+$1,updated_at=now() WHERE id=$2`,
          [i.quantity, s.rows[0].id],
        );
      }
      return (
        await client.query(
          `UPDATE erp_sales_orders SET status='CONFIRMED',updated_at=now() WHERE id=$1 RETURNING *`,
          [id],
        )
      ).rows[0];
    }),
  ship: async (id: number, c: number, u: number) =>
    withTransaction(async (client) => {
      const o = await client.query(
        `SELECT * FROM erp_sales_orders WHERE id=$1 AND ias_company_id=$2 FOR UPDATE`,
        [id, c],
      );
      if (!o.rowCount) throw new Error("Sales order not found");
      if (o.rows[0].status !== "CONFIRMED")
        throw new Error("Only CONFIRMED orders can ship");
      const items = await client.query(
        `SELECT * FROM erp_sales_order_items WHERE sales_order_id=$1`,
        [id],
      );
      for (const i of items.rows) {
        const s = await client.query(
          `SELECT * FROM erp_stock_levels WHERE product_id=$1 AND warehouse_id=$2 FOR UPDATE`,
          [i.product_id, o.rows[0].warehouse_id],
        );
        await client.query(
          `UPDATE erp_stock_levels SET quantity=quantity-$1,reserved_quantity=reserved_quantity-$1,updated_at=now() WHERE id=$2`,
          [i.quantity, s.rows[0].id],
        );
        await client.query(
          `INSERT INTO erp_stock_movements(ias_company_id,product_id,product_sku,product_name,warehouse_id,warehouse_name,quantity_delta,unit_cost,reason,reference_type,reference_id,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,'SALE','sales_order',$9,$10)`,
          [
            c,
            i.product_id,
            i.product_sku,
            i.product_name,
            i.warehouse_id,
            (
              await client.query(
                `SELECT name FROM erp_warehouses WHERE id=$1`,
                [o.rows[0].warehouse_id],
              )
            ).rows[0].name,
            -i.quantity,
            0,
            id,
            u,
          ],
        );
      }
      return (
        await client.query(
          `UPDATE erp_sales_orders SET status='SHIPPED',updated_at=now() WHERE id=$1 RETURNING *`,
          [id],
        )
      ).rows[0];
    }),
};
