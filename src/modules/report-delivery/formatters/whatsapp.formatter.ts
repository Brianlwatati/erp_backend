import type { ErpReportSnapshot } from "../../../types/domain.js";

export function formatReportWhatsApp(snapshot: ErpReportSnapshot): {
  text: string;
} {
  const { data, periodType, periodStart, periodEnd } = snapshot;

  const label = periodType === "DAILY" ? "Daily" : "Weekly";

  const stockStatus =
    data.lowStockCount > 0
      ? `⚠️ ${data.lowStockCount} item(s) need restocking`
      : `✅ Stock levels are healthy`;

  const text = [
    `📈 *ERPKE ${label.toUpperCase()} REPORT*`,
    `📅 *Period:* ${periodStart} — ${periodEnd}`,
    ``,
    `╭───────────────────────╮`,
    `│ 💰 *SALES*`,
    `│`,
    `│ Sales       *${data.salesValue.toFixed(2)}*`,
    `│ Orders      *${data.ordersCount}*`,
    `╰───────────────────────╯`,
    ``,
    `╭───────────────────────╮`,
    `│ 🧾 *FINANCE*`,
    `│`,
    `│ Outstanding *${data.outstandingInvoices.toFixed(2)}*`,
    `╰───────────────────────╯`,
    ``,
    `╭───────────────────────╮`,
    `│ 📦 *INVENTORY*`,
    `│`,
    `│ Stock Value *${data.stockValue.toFixed(2)}*`,
    `│ Low Stock   *${data.lowStockCount}*`,
    `╰───────────────────────╯`,
    ``,
    `🔎 *STATUS*`,
    stockStatus,
    ``,
    `━━━━━━━━━━━━━━━━━━`,
    `🤖 _Automated report from ERPKE_`,
  ].join("\n");

  return { text };
}
