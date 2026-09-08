import type { Express } from "express";
import authRoutes from "../src/modules/auth/auth.routes.js";
import rolesRoutes from "../src/modules/roles/roles.routes.js";
import permissionsRoutes from "../src/modules/permissions/permissions.routes.js";
import roleAssignmentsRoutes from "../src/modules/role-assignments/role-assignments.routes.js";
import branchesRoutes from "../src/modules/branches/branches.routes.js";
import approvalLimitsRoutes from "../src/modules/approval-limits/approval-limits.routes.js";
import approvalDelegationsRoutes from "../src/modules/approval-delegations/approval-delegations.routes.js";
import auditLogRoutes from "../src/modules/audit-log/audit-log.routes.js";
import provisioningRoutes from "../src/modules/provisioning/provisioning.routes.js";
import inventoryRoutes from "../src/modules/inventory/inventory.routes.js";
import salesRoutes from "../src/modules/sales/sales.routes.js";
import purchasingRoutes from "../src/modules/purchasing/purchasing.routes.js";
import contactsRoutes from "../src/modules/contacts/contacts.routes.js";
import financeRoutes from "../src/modules/finance/finance.routes.js";
import hrRoutes from "../src/modules/hr/hr.routes.js";
import reportingRoutes from "../src/modules/reporting/reporting.routes.js";
import workflowRoutes from "../src/modules/workflow/workflow.routes.js";

const API_PREFIX = "/api/v1";

export function registerRoutes(app: Express): void {
  app.use(`${API_PREFIX}/auth`, authRoutes);
  app.use(`${API_PREFIX}/roles`, rolesRoutes);
  app.use(`${API_PREFIX}/permissions`, permissionsRoutes);
  app.use(`${API_PREFIX}/role-assignments`, roleAssignmentsRoutes);
  app.use(`${API_PREFIX}/branches`, branchesRoutes);
  app.use(`${API_PREFIX}/approval-limits`, approvalLimitsRoutes);
  app.use(`${API_PREFIX}/approval-delegations`, approvalDelegationsRoutes);
  app.use(`${API_PREFIX}/audit-log`, auditLogRoutes);
  app.use(`${API_PREFIX}/inventory`, inventoryRoutes);
  app.use(`${API_PREFIX}/sales`, salesRoutes);
  app.use(`${API_PREFIX}/purchasing`, purchasingRoutes);
  app.use(`${API_PREFIX}/contacts`, contactsRoutes);
  app.use(`${API_PREFIX}/finance`, financeRoutes);
  app.use(`${API_PREFIX}/hr`, hrRoutes);
  app.use(`${API_PREFIX}/reporting`, reportingRoutes);
  app.use(`${API_PREFIX}/workflow`, workflowRoutes);

  // Called by IAS on provisioning events, not by the frontend.
  app.use(`${API_PREFIX}/webhooks/ias`, provisioningRoutes);
}
