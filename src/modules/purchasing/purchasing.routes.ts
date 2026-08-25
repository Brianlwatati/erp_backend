import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { purchasingController as c } from "./purchasing.controller.js";
const r = Router();
r.use(authenticate);
r.get("/orders", authorize("purchasing", "view"), c.list);
r.get("/orders/:id", authorize("purchasing", "view"), c.get);
r.post("/orders", authorize("purchasing", "manage_po"), c.create);
r.post("/orders/:id/approve", authorize("purchasing", "approve_po"), c.approve);
r.post(
  "/orders/:id/receive",
  authorize("purchasing", "receive_goods"),
  c.receive,
);
export default r;
