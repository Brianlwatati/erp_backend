import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { reportDeliveryController as c } from "./report-delivery.controller.js";

const r = Router();
r.use(authenticate);
r.get("/subscriptions", authorize("report-delivery", "view"), c.list);
r.post("/subscriptions", authorize("report-delivery", "manage"), c.create);
r.patch("/subscriptions/:id", authorize("report-delivery", "manage"), c.update);
r.delete(
  "/subscriptions/:id",
  authorize("report-delivery", "manage"),
  c.remove,
);
r.get(
  "/subscriptions/:id/send-logs",
  authorize("report-delivery", "view"),
  c.sendLogs,
);

export default r;
