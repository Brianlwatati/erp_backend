import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { contactsController as c } from "./contacts.controller.js";
const r = Router();
r.use(authenticate);
r.get("/", authorize("contacts", "view"), c.list);
r.post("/", authorize("contacts", "manage_contacts"), c.create);
r.patch("/:id", authorize("contacts", "manage_contacts"), c.update);
r.get("/:id/history", authorize("contacts", "view"), c.history);
r.post(
  "/:id/interactions",
  authorize("contacts", "log_interaction"),
  c.interaction,
);
export default r;
