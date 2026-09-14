import { app } from "./app.js";
import { env } from "./config/env.js";
import { startReportDeliveryScheduler } from "./modules/report-delivery/report-delivery.scheduler.js";

app.listen(env.port, env.host, () => {
  console.log(
    `erp_backend listening on ${env.host}:${env.port} (${env.nodeEnv})`,
  );
});

startReportDeliveryScheduler();
