import { query } from "../../config/db.js";
export const reportingRepository = {
  dashboard: (c: number) =>
    query(
      `SELECT (SELECT COALESCE(SUM(total_amount),0) FROM erp_sales_orders WHERE ias_company_id=$1 AND status NOT IN ('CANCELLED','DRAFT')) AS "salesValue",(SELECT COALESCE(SUM(total_amount-paid_amount),0) FROM erp_invoices WHERE ias_company_id=$1 AND status<>'PAID') AS "outstandingInvoices",(SELECT COALESCE(SUM(sl.quantity*sl.average_cost),0) FROM erp_stock_levels sl WHERE sl.ias_company_id=$1) AS "stockValue",(SELECT COUNT(*) FROM erp_sales_orders WHERE ias_company_id=$1 AND status IN ('DRAFT','CONFIRMED')) AS "openOrders",(SELECT COUNT(*) FROM erp_purchase_orders WHERE ias_company_id=$1 AND status IN ('DRAFT','APPROVED','PARTIALLY_RECEIVED')) AS "openPurchaseOrders"`,
      [c],
    ).then((r) => r[0]),
  sales: (c: number, from?: string, to?: string) =>
    query(
      `SELECT DATE(order_date) AS date,COUNT(*)::int AS orders,COALESCE(SUM(total_amount),0) AS revenue FROM erp_sales_orders WHERE ias_company_id=$1 AND status NOT IN ('CANCELLED','DRAFT') AND ($2::date IS NULL OR order_date::date>=$2) AND ($3::date IS NULL OR order_date::date<=$3) GROUP BY DATE(order_date) ORDER BY date`,
      [c, from ?? null, to ?? null],
    ),
  lowStock: (c: number) =>
    query(
      `SELECT p.id,p.sku,p.name,w.name AS "warehouseName",sl.quantity,sl.reserved_quantity AS "reservedQuantity",p.reorder_level AS "reorderLevel" FROM erp_stock_levels sl JOIN erp_products p ON p.id=sl.product_id JOIN erp_warehouses w ON w.id=sl.warehouse_id WHERE sl.ias_company_id=$1 AND sl.quantity-sl.reserved_quantity<=p.reorder_level ORDER BY p.name`,
      [c],
    ),
};
