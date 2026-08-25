import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { workflowController as c } from "./workflow.controller.js";
const r = Router();
r.use(authenticate);
r.get(
  "/notifications",
  authorize("workflow", "manage_approvals"),
  c.notifications,
);
r.post("/notifications", authorize("workflow", "manage_rules"), c.notify);
r.post(
  "/notifications/:id/read",
  authorize("workflow", "manage_approvals"),
  c.read,
);
r.get("/rules", authorize("workflow", "manage_rules"), c.rules);
r.post("/rules", authorize("workflow", "manage_rules"), c.createRule);
r.get("/approvals", authorize("workflow", "manage_approvals"), c.approvals);
r.post("/approvals", authorize("workflow", "manage_approvals"), c.request);
r.post(
  "/approvals/:id/decide",
  authorize("workflow", "manage_approvals"),
  c.decide,
);
export default r;
