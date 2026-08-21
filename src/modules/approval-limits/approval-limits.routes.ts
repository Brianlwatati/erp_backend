import { Router } from "express";
import { approvalLimitsController } from "./approval-limits.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

router.use(authenticate);
router.get("/", authorize("access", "view"), approvalLimitsController.get);
router.put("/", authorize("access", "manage_users"), approvalLimitsController.set);

export default router;
