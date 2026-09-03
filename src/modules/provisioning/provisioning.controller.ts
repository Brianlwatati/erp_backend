import type { Request, Response } from "express";
import { provisioningRepository } from "./provisioning.repository.js";
import {
  companyProvisionedSchema,
  userCreatedSchema,
} from "./provisioning.validators.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

export const provisioningController = {
  onCompanyProvisioned: asyncHandler(async (req: Request, res: Response) => {
    const parsed = companyProvisionedSchema.safeParse(req.body);
    if (!parsed.success)
      return fail(res, "Invalid input", 422, parsed.error.flatten());
    const { companyId } = parsed.data;

    if (
      await provisioningRepository.hasProcessed(
        "company_provisioned",
        companyId,
        null,
      )
    ) {
      return ok(res, null, "Already processed");
    }

    await provisioningRepository.seedDefaultsForCompany(companyId);
    await provisioningRepository.markProcessed(
      "company_provisioned",
      companyId,
      null,
    );
    ok(res, null, "Company provisioned in ERP", 201);
  }),

  onUserCreated: asyncHandler(async (req: Request, res: Response) => {
    const parsed = userCreatedSchema.safeParse(req.body);
    if (!parsed.success)
      return fail(res, "Invalid input", 422, parsed.error.flatten());
    const { userId, companyId } = parsed.data;

    if (
      await provisioningRepository.hasProcessed(
        "user_created",
        companyId,
        userId,
      )
    ) {
      return ok(res, null, "Already processed");
    }

    await provisioningRepository.assignDefaultRoleToUser(userId, companyId);
    await provisioningRepository.markProcessed(
      "user_created",
      companyId,
      userId,
    );
    ok(res, null, "User provisioned in ERP", 201);
  }),
};
