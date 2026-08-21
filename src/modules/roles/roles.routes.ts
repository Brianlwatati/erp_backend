import { Router } from "express";
import { rolesController } from "./roles.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("access", "view"), rolesController.list);
router.get("/:id", authorize("access", "view"), rolesController.get);
router.post("/", authorize("access", "manage_roles"), rolesController.create);
router.patch("/:id", authorize("access", "manage_roles"), rolesController.update);
router.delete("/:id", authorize("access", "manage_roles"), rolesController.remove);

router.get(
  "/:id/permissions",
  authorize("access", "view"),
  rolesController.getPermissionMatrix,
);
router.put(
  "/:id/permissions",
  authorize("access", "manage_roles"),
  rolesController.setPermissions,
);

export default router;
