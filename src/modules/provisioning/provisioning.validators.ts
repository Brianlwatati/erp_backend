import { z } from "zod";

export const companyProvisionedSchema = z.object({
  companyId: z.number().int().positive(),
});

export const userCreatedSchema = z.object({
  userId: z.number().int().positive(),
  companyId: z.number().int().positive(),
});
