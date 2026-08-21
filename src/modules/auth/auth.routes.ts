import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authController } from "./auth.controller.js";

const router = Router();

// ERP session bootstrap / identity verification. This endpoint may call IAS;
// normal ERP endpoints authenticate locally from the IAS-issued JWT.
router.get("/me", authenticate, authController.me);

export default router;
