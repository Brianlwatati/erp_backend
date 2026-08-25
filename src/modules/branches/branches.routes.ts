import { Router } from "express";
import { branchesController } from "./branches.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("branches", "view"), branchesController.list);
router.post(
  "/",
  authorize("branches", "manage_branches"),
  branchesController.create,
);

export default router;
