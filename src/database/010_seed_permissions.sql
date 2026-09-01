-- ============================================================
-- 010_seed_permissions.sql
-- Initial ERP permission catalog
-- ============================================================


INSERT INTO erp_permissions (module, action)
VALUES

  -- Access
  ('access', 'view'),
  ('access', 'manage_roles'),
  ('access', 'manage_users'),
  ('access', 'manage_branches'),
  ('access', 'approve_delegations'),

  -- Inventory
  ('inventory', 'view'),
  ('inventory', 'adjust_stock'),
  ('inventory', 'transfer_stock'),
  ('inventory', 'manage_products'),
  ('inventory', 'record_stock_count'),
  ('inventory', 'manage_warehouses'),

  -- Sales
  ('sales', 'view'),
  ('sales', 'create_order'),
  ('sales', 'manage_orders'),
  ('sales', 'approve_order'),
  ('sales', 'approve_discount'),
  ('sales', 'ship_order'),
  ('sales', 'create_invoice'),

  -- Purchasing
  ('purchasing', 'view'),
  ('purchasing', 'create_po'),
  ('purchasing', 'manage_po'),
  ('purchasing', 'approve_po'),
  ('purchasing', 'receive_goods'),

  -- CRM
  ('crm', 'view'),
  ('crm', 'manage_contacts'),
  ('crm', 'log_interaction'),

  -- Finance
  ('finance', 'view'),
  ('finance', 'manage_invoices'),
  ('finance', 'post_payment'),
  ('finance', 'view_reports'),
  ('finance', 'post_journal'),

  -- HR
  ('hr', 'view'),
  ('hr', 'manage_employees'),
  ('hr', 'manage_attendance'),
  ('hr', 'approve_leave'),
  ('hr', 'run_payroll'),

  -- Reporting
  ('reporting', 'view'),
  ('reporting', 'export'),

  -- Workflow
  ('workflow', 'manage_rules'),
  ('workflow', 'manage_approvals')

ON CONFLICT (module, action) DO NOTHING;