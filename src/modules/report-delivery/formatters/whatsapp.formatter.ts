import type { ErpReportSnapshot } from "../../../types/domain.js";

// Maps a snapshot onto the {{1}}..{{n}} body variables of the approved
// "daily_report_notification" / "weekly_report_notification" Meta
// templates. Keep this in sync with whatever template text is approved —
// the variable count and order must match exactly.
export function formatReportWhatsApp(snapshot: ErpReportSnapshot): {
  templateName: string;
  bodyParams: string[];
} {
  const { data, periodType, periodEnd } = snapshot;
  return {
    templateName:
      periodType === "DAILY"
        ? "daily_report_notification"
        : "weekly_report_notification",
    bodyParams: [
      periodEnd,
      data.salesValue.toFixed(2),
      String(data.ordersCount),
      data.outstandingInvoices.toFixed(2),
    ],
  };
}
