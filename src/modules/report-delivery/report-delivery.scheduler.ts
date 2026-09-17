import cron from "node-cron";
import { env } from "../../config/env.js";
import { buildSnapshots } from "./jobs/build-snapshots.job.js";
import { dispatchReports } from "./jobs/dispatch-reports.job.js";

// Called once from index.ts. Kept separate from app.ts (which only wires
// request handling) since these run independently of any HTTP request.
export function startReportDeliveryScheduler(): void {
  if (!env.reportDeliveryEnabled) return;

  // Refresh snapshots before dispatch so current-day sales are included.
  cron.schedule("*/15 * * * *", () => {
    buildSnapshots().catch((err) =>
      console.error("report-delivery: buildSnapshots crashed", err),
    );
  });

  // Every 15 min: catches each subscription's time_of_day promptly without
  // hammering the DB.
  cron.schedule("*/15 * * * *", () => {
    dispatchReports().catch((err) =>
      console.error("report-delivery: dispatchReports crashed", err),
    );
  });

  console.log("report-delivery: scheduler started");
}
