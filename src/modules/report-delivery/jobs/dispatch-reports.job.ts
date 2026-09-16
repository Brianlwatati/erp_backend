import { reportDeliveryRepository as r } from "../report-delivery.repository.js";
import { sendReportEmail } from "../senders/email.sender.js";
import { sendReportWhatsApp } from "../senders/whatsapp.sender.js";
import { formatReportEmail } from "../formatters/email.formatter.js";
import { formatReportWhatsApp } from "../formatters/whatsapp.formatter.js";

// Run frequently (e.g. every 5-15 min via cron) so a subscription's
// time_of_day is caught promptly. Matches on UTC HH:MM — if per-client
// local time zones matter later, store an offset on the subscription and
// adjust `nowHHMM` per row instead of assuming a single server time zone.
function nowParts(): { dayOfWeek: number; hhmm: string } {
  const now = new Date();
  return {
    dayOfWeek: now.getUTCDay(),
    hhmm: `${String(now.getUTCHours()).padStart(2, "0")}:${String(
      now.getUTCMinutes(),
    ).padStart(2, "0")}`,
  };
}

export async function dispatchReports(): Promise<void> {
  const { dayOfWeek, hhmm } = nowParts();

  const due = [
    ...(await r.dueNow("DAILY", dayOfWeek, hhmm)),
    ...(await r.dueNow("WEEKLY", dayOfWeek, hhmm)),
  ];

  for (const sub of due) {
    try {
      const snapshot = await r.latestSnapshot(sub.iasCompanyId, sub.frequency);
      if (!snapshot) {
        await r.logSend(sub.id, null, "FAILED", "No snapshot available yet");
        continue;
      }

      if (sub.channel === "EMAIL") {
        const { subject, html } = formatReportEmail(snapshot);
        await sendReportEmail({ to: sub.recipient, subject, html });
      } else {
        const { text } = formatReportWhatsApp(snapshot);
        await sendReportWhatsApp({ to: sub.recipient, text });
      }

      await r.logSend(sub.id, snapshot.id, "SUCCESS");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown send error";
      await r.logSend(sub.id, null, "FAILED", message);
      console.error(`report-delivery: dispatch failed for subscription ${sub.id}`, err);
    }
  }
}
