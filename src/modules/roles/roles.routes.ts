import { Router } from "express";
import { rolesController } from "./roles.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

router.use(authenticate);

router.get("/", authorize("roles", "view"), rolesController.list);
router.get("/:id", authorize("roles", "view"), rolesController.get);
router.post("/", authorize("roles", "manage_roles"), rolesController.create);
router.patch(
  "/:id",
  authorize("roles", "manage_roles"),
  rolesController.update,
);
router.delete(
  "/:id",
  authorize("roles", "manage_roles"),
  rolesController.remove,
);

router.get(
  "/:id/permissions",
  authorize("roles", "view"),
  rolesController.getPermissionMatrix,
);
router.put(
  "/:id/permissions",
  authorize("roles", "manage_roles"),
  rolesController.setPermissions,
);

export default router;
