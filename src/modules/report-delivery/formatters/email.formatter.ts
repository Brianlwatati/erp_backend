import type { ErpReportSnapshot } from "../../../types/domain.js";

export function formatReportEmail(snapshot: ErpReportSnapshot): {
  subject: string;
  html: string;
} {
  const { data, periodType, periodStart, periodEnd } = snapshot;
  const label = periodType === "DAILY" ? "Daily" : "Weekly";

  return {
    subject: `${label} report — ${periodStart} to ${periodEnd}`,
    html: `
      <h2>${label} report</h2>
      <p>${periodStart} to ${periodEnd}</p>
      <table cellpadding="6" style="border-collapse:collapse">
        <tr><td>Sales value</td><td><strong>${data.salesValue.toFixed(2)}</strong></td></tr>
        <tr><td>Orders</td><td><strong>${data.ordersCount}</strong></td></tr>
        <tr><td>Outstanding invoices</td><td><strong>${data.outstandingInvoices.toFixed(2)}</strong></td></tr>
        <tr><td>Stock value</td><td><strong>${data.stockValue.toFixed(2)}</strong></td></tr>
        <tr><td>Low stock items</td><td><strong>${data.lowStockCount}</strong></td></tr>
      </table>
    `.trim(),
  };
}
