// Mirrors db/schema.sql — kept as plain interfaces, no ORM.

export interface ErpRole {
  id: number;
  iasCompanyId: number;
  name: string;
  code: string;
  isDefault: boolean;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
  updatedAt: string;
}

export interface ErpPermission {
  id: number;
  module: string;
  action: string;
  code: string; // generated column: "module:action"
}

export interface ErpRoleAssignment {
  id: number;
  iasUserId: number;
  iasCompanyId: number;
  roleId: number;
  branchId: number | null;
  assignedAt: string;
  assignedBy: number | null;
}

export interface ErpBranch {
  id: number;
  iasCompanyId: number;
  name: string;
  code: string;
  status: "ACTIVE" | "INACTIVE";
}
