# ERP Remaining Phases

This build keeps the existing IAS-backed ERP architecture and adds the phases after Inventory.

## Implemented
1. Sales / Order Management
2. Customers & Suppliers (CRM-lite)
3. Purchasing / Procurement
4. Accounting / Finance
5. HR / Payroll (basic tier)
6. Reporting & Dashboard
7. Notifications / Workflow

### Suggested implementation order
- Inventory is the existing foundation.
- Sales reserves stock on confirmation and consumes it on shipment.
- Purchasing receiving creates/updates stock levels and weighted-average cost.
- Finance creates invoices from sales orders and supports payments/allocations and balanced journal entries.
- CRM contacts are shared by Sales, Purchasing and Finance.
- HR is isolated from inventory/sales and can be expanded later.
- Reporting is read-only and aggregates operational data.
- Workflow provides a generic approval/notification layer.

## Important design decisions
- Every business table is scoped by `ias_company_id`.
- Existing local JWT authentication/ERP authorization is preserved.
- Stock movements remain the inventory source of truth.
- `erp_stock_levels.reserved_quantity` is used by Sales.
- Sales and purchasing store product/contact snapshots where appropriate to preserve historical reporting.
- No accounting chart-of-accounts master was introduced yet; journal lines accept account codes so a full GL/COA phase can be added without replacing transaction tables.

## API roots
- `/api/v1/inventory`
- `/api/v1/sales`
- `/api/v1/contacts`
- `/api/v1/purchasing`
- `/api/v1/finance`
- `/api/v1/hr`
- `/api/v1/reporting`
- `/api/v1/workflow`

Run:
`npm run migrate`
`npm run type-check`
`npm run build`
