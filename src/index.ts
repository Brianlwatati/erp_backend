import { app } from "./app.js";
import { env } from "./config/env.js";

app.listen(env.port, () => {
  console.log(`erp_backend listening on port ${env.port} (${env.nodeEnv})`);
});
