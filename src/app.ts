import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import { errorHandler } from "./middleware/errorHandler.js";
import authRoutes from "./modules/auth/auth.routes.js";

import rolesRoutes from "./modules/roles/roles.routes.js";
import permissionsRoutes from "./modules/permissions/permissions.routes.js";
import roleAssignmentsRoutes from "./modules/role-assignments/role-assignments.routes.js";
import branchesRoutes from "./modules/branches/branches.routes.js";
import approvalLimitsRoutes from "./modules/approval-limits/approval-limits.routes.js";
import approvalDelegationsRoutes from "./modules/approval-delegations/approval-delegations.routes.js";
import auditLogRoutes from "./modules/audit-log/audit-log.routes.js";
import provisioningRoutes from "./modules/provisioning/provisioning.routes.js";
import inventoryRoutes from "./modules/inventory/inventory.routes.js";
import salesRoutes from "./modules/sales/sales.routes.js";
import purchasingRoutes from "./modules/purchasing/purchasing.routes.js";
import contactsRoutes from "./modules/contacts/contacts.routes.js";
import financeRoutes from "./modules/finance/finance.routes.js";
import hrRoutes from "./modules/hr/hr.routes.js";
import reportingRoutes from "./modules/reporting/reporting.routes.js";
import workflowRoutes from "./modules/workflow/workflow.routes.js";

export const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));

app.get("/health", (_req, res) => res.json({ success: true, message: "OK" }));

const API_PREFIX = "/api/v1";

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

// Called by IAS on provisioning events, not by the frontend — deliberately
// outside API_PREFIX's implicit "user-facing" grouping for clarity, though
// it could just as easily live under it.
app.use(`${API_PREFIX}/webhooks/ias`, provisioningRoutes);

app.use(errorHandler);
