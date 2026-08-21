import { z } from "zod";

export const assignRoleSchema = z.object({
  iasUserId: z.number().int().positive(),
  roleId: z.number().int().positive(),
  branchId: z.number().int().positive().nullable().optional(),
});

export type AssignRoleInput = z.infer<typeof assignRoleSchema>;
