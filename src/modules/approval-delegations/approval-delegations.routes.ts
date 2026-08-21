import { Router } from "express";
import { approvalDelegationsController } from "./approval-delegations.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

router.use(authenticate);
router.post("/", approvalDelegationsController.create);
router.get("/me/active", approvalDelegationsController.getMyActiveDelegations);

export default router;
