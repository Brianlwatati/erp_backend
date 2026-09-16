// Manual trigger for testing — the real schedule is the cron job in
// report-delivery.scheduler.ts. Run with: npm run report:dispatch -- --force
import { dispatchReports } from "../modules/report-delivery/jobs/dispatch-reports.job.js";

const force = process.argv.includes("--force");

dispatchReports({ ignoreSchedule: force })
  .then(() => {
    console.log(
      `Dispatch run complete${force ? " (forced)" : ""} — check erp_report_send_logs for results.`,
    );
    process.exit(0);
  })
  .catch((err) => {
    console.error("Dispatch run failed:", err);
    process.exit(1);
  });
