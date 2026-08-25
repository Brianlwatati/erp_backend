import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { hrController as c } from "./hr.controller.js";
const r = Router();
r.use(authenticate);
r.get("/employees", authorize("hr", "view"), c.employees);
r.post("/employees", authorize("hr", "manage_employees"), c.createEmployee);
r.get("/attendance", authorize("hr", "view"), c.attendance);
r.post(
  "/attendance/:employeeId",
  authorize("hr", "manage_attendance"),
  c.clock,
);
r.get("/leave", authorize("hr", "view"), c.leave);
r.post(
  "/employees/:employeeId/leave",
  authorize("hr", "manage_attendance"),
  c.requestLeave,
);
r.post("/leave/:id/approve", authorize("hr", "approve_leave"), c.approveLeave);
r.post("/payroll/runs", authorize("hr", "run_payroll"), c.payroll);
export default r;
