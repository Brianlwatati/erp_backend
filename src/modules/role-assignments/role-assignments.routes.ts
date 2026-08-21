import { Router } from "express";
import { roleAssignmentsController } from "./role-assignments.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

router.use(authenticate);

router.get("/me/scope", roleAssignmentsController.getMyScope);
router.get(
  "/user/:userId",
  authorize("access", "view"),
  roleAssignmentsController.listForUser,
);
router.post(
  "/",
  authorize("access", "manage_users"),
  roleAssignmentsController.assign,
);
router.delete(
  "/:id",
  authorize("access", "manage_users"),
  roleAssignmentsController.revoke,
);

export default router;
