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

export interface ErpReportSubscription {
  id: number;
  iasCompanyId: number;
  channel: "EMAIL" | "WHATSAPP";
  frequency: "DAILY" | "WEEKLY";
  dayOfWeek: number | null;
  timeOfDay: string;
  recipient: string;
  enabled: boolean;
  createdBy: number;
  createdAt: string;
  updatedAt: string;
}

export interface ErpReportSnapshot {
  id: number;
  iasCompanyId: number;
  periodType: "DAILY" | "WEEKLY";
  periodStart: string;
  periodEnd: string;
  data: ErpReportSnapshotData;
  generatedAt: string;
}

// Shape written by the snapshot job and read back by the formatters.
// Kept intentionally flat/plain so it round-trips through JSONB cleanly.
export interface ErpReportSnapshotData {
  salesValue: number;
  ordersCount: number;
  outstandingInvoices: number;
  stockValue: number;
  lowStockCount: number;
}

export interface ErpReportSendLog {
  id: number;
  subscriptionId: number;
  snapshotId: number | null;
  status: "SUCCESS" | "FAILED";
  errorMessage: string | null;
  sentAt: string;
}
