import type { ErpReportSnapshot } from "../../../types/domain.js";

// OpenWA sends free-form text through a real WhatsApp client, so unlike
// Meta's Cloud API this doesn't need a pre-approved template — just build
// the message body directly from the snapshot.
export function formatReportWhatsApp(snapshot: ErpReportSnapshot): { text: string } {
  const { data, periodType, periodStart, periodEnd } = snapshot;
  const label = periodType === "DAILY" ? "Daily" : "Weekly";

  const text = [
    `*${label} report* (${periodStart} to ${periodEnd})`,
    `Sales value: ${data.salesValue.toFixed(2)}`,
    `Orders: ${data.ordersCount}`,
    `Outstanding invoices: ${data.outstandingInvoices.toFixed(2)}`,
    `Stock value: ${data.stockValue.toFixed(2)}`,
    `Low stock items: ${data.lowStockCount}`,
  ].join("\n");

  return { text };
}
