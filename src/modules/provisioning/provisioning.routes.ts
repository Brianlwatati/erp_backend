import { Router } from "express";
import { provisioningController } from "./provisioning.controller.js";
import { verifyWebhookSecret } from "./provisioning.middleware.js";

const router = Router();

// Called by IAS, not the frontend — register these URLs with IAS as
// webhook targets for company/user creation events.
router.use(verifyWebhookSecret);
router.post("/company-provisioned", provisioningController.onCompanyProvisioned);
router.post("/user-created", provisioningController.onUserCreated);

export default router;
