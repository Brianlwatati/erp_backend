import { Router } from "express";
import { permissionsController } from "./permissions.controller.js";
import { authenticate } from "../../middleware/authenticate.js";

const router = Router();

// Read-only catalog — any authenticated user can see what permissions
// exist (needed to build a role-editor UI), but only role management
// routes (see roles.routes.ts) can assign them.
router.get("/", authenticate, permissionsController.list);

export default router;
