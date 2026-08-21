import { z } from "zod";

export const createRoleSchema = z.object({
  name: z.string().min(2),
  code: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[A-Z0-9_]+$/, "Uppercase letters, numbers, and underscores only"),
  isDefault: z.boolean().optional(),
});

export const updateRoleSchema = z.object({
  name: z.string().min(2).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
  isDefault: z.boolean().optional(),
});

export const setPermissionsSchema = z.object({
  permissionIds: z.array(z.number().int().positive()),
});

export type CreateRoleInput = z.infer<typeof createRoleSchema>;
export type UpdateRoleInput = z.infer<typeof updateRoleSchema>;
