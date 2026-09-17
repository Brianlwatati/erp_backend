import { query, queryOne } from "../../../config/db.js";
import { reportDeliveryRepository } from "../report-delivery.repository.js";
import type { ErpReportSnapshotData } from "../../../types/domain.js";

// The only place that touches live module tables for this feature —
// dispatch always reads back the snapshot this writes, never live data,
// so a report can be re-sent later without the numbers drifting.
async function aggregate(
  companyId: number,
  from: string,
  to: string,
): Promise<ErpReportSnapshotData> {
  const sales = await queryOne<{ salesValue: string; ordersCount: string }>(
    `SELECT COALESCE(SUM(total_amount),0) AS "salesValue", COUNT(*)::int AS "ordersCount"
     FROM erp_sales_orders
     WHERE ias_company_id = $1 AND status NOT IN ('CANCELLED','DRAFT')
       AND order_date::date BETWEEN $2 AND $3`,
    [companyId, from, to],
  );
  const invoices = await queryOne<{ outstandingInvoices: string }>(
    `SELECT COALESCE(SUM(total_amount - paid_amount),0) AS "outstandingInvoices"
     FROM erp_invoices
     WHERE ias_company_id = $1 AND status <> 'PAID'`,
    [companyId],
  );
  const stock = await queryOne<{ stockValue: string }>(
    `SELECT COALESCE(SUM(sl.quantity * sl.average_cost),0) AS "stockValue"
     FROM erp_stock_levels sl WHERE sl.ias_company_id = $1`,
    [companyId],
  );
  const lowStock = await query<{ count: string }>(
    `SELECT COUNT(*)::int AS count
     FROM erp_stock_levels sl JOIN erp_products p ON p.id = sl.product_id
     WHERE sl.ias_company_id = $1 AND sl.quantity - sl.reserved_quantity <= p.reorder_level`,
    [companyId],
  );

  return {
    salesValue: Number(sales?.salesValue ?? 0),
    ordersCount: Number(sales?.ordersCount ?? 0),
    outstandingInvoices: Number(invoices?.outstandingInvoices ?? 0),
    stockValue: Number(stock?.stockValue ?? 0),
    lowStockCount: Number(lowStock[0]?.count ?? 0),
  };
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// Builds the current daily snapshot and a rolling 7-day weekly snapshot for
// every company that has at least one enabled subscription. This runs
// repeatedly so reports include sales made during the current day.
export async function buildSnapshots(): Promise<void> {
  const companies =
    await reportDeliveryRepository.companiesWithActiveSubscriptions();

  const today = new Date();
  const dailyDate = isoDate(today);

  const weekStart = new Date(today);
  weekStart.setUTCDate(weekStart.getUTCDate() - 6);
  const weeklyStart = isoDate(weekStart);

  for (const { iasCompanyId } of companies) {
    try {
      const dailyData = await aggregate(iasCompanyId, dailyDate, dailyDate);
      await reportDeliveryRepository.upsertSnapshot(
        iasCompanyId,
        "DAILY",
        dailyDate,
        dailyDate,
        dailyData,
      );

      const weeklyData = await aggregate(iasCompanyId, weeklyStart, dailyDate);
      await reportDeliveryRepository.upsertSnapshot(
        iasCompanyId,
        "WEEKLY",
        weeklyStart,
        dailyDate,
        weeklyData,
      );
    } catch (err) {
      // One company's aggregation failing shouldn't block the rest.
      console.error(
        `report-delivery: snapshot build failed for company ${iasCompanyId}`,
        err,
      );
    }
  }
}
