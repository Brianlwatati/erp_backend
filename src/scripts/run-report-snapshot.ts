// Manual trigger for testing — the real schedule is the cron job in
// report-delivery.scheduler.ts. Run with: npm run report:snapshot
import { buildSnapshots } from "../modules/report-delivery/jobs/build-snapshots.job.js";

buildSnapshots()
  .then(() => {
    console.log("Snapshot build complete.");
    process.exit(0);
  })
  .catch((err) => {
    console.error("Snapshot build failed:", err);
    process.exit(1);
  });
