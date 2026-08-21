import { rolesRepository } from "./roles.repository.js";
import { permissionsRepository } from "../permissions/permissions.repository.js";
import type { CreateRoleInput, UpdateRoleInput } from "./roles.validators.js";

class NotFoundError extends Error {}

export const rolesService = {
  list: (iasCompanyId: number) => rolesRepository.listForCompany(iasCompanyId),

  get: async (id: number, iasCompanyId: number) => {
    const role = await rolesRepository.findById(id, iasCompanyId);
    if (!role) throw new NotFoundError("Role not found");
    return role;
  },

  create: (iasCompanyId: number, input: CreateRoleInput) =>
    rolesRepository.create({ iasCompanyId, ...input }),

  update: async (id: number, iasCompanyId: number, input: UpdateRoleInput) => {
    const updated = await rolesRepository.update(id, iasCompanyId, input);
    if (!updated) throw new NotFoundError("Role not found");
    return updated;
  },

  remove: (id: number, iasCompanyId: number) =>
    rolesRepository.remove(id, iasCompanyId),

  // getPermissionMatrix(erpRoleId)
  getPermissionMatrix: async (id: number, iasCompanyId: number) => {
    await rolesService.get(id, iasCompanyId); // 404s if role isn't in this company
    return permissionsRepository.getMatrixForRole(id);
  },

  setPermissions: async (id: number, iasCompanyId: number, permissionIds: number[]) => {
    await rolesService.get(id, iasCompanyId);
    await permissionsRepository.setRolePermissions(id, permissionIds);
    return permissionsRepository.getMatrixForRole(id);
  },
};

export { NotFoundError };
