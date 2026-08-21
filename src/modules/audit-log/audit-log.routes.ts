import { Router } from "express";
import { auditLogController } from "./audit-log.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

router.use(authenticate);
router.get("/", authorize("access", "view"), auditLogController.getHistory);

export default router;
