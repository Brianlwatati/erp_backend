-- ERP User & Access Management schema
-- Identity, companies, and system-level roles stay in IAS.
-- This schema only holds ERP-specific authorization, scoped by
-- ias_user_id / ias_company_id (no local users/companies tables).

-- ─────────────────────────────────────────────
-- 1. ERP-specific roles (distinct from IAS's SYSTEM/PRODUCT roles)
-- ─────────────────────────────────────────────
CREATE TABLE erp_roles (
  id            SERIAL PRIMARY KEY,
  ias_company_id  INTEGER NOT NULL,       -- which IAS company this role belongs to
  name          VARCHAR(100) NOT NULL,     -- "Warehouse Clerk", "Accountant"
  code          VARCHAR(50) NOT NULL,      -- "WAREHOUSE_CLERK"
  is_default    BOOLEAN DEFAULT FALSE,     -- auto-assigned to new users
  status        VARCHAR(20) DEFAULT 'ACTIVE',
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE (ias_company_id, code)
);

-- ─────────────────────────────────────────────
-- 2. Permission catalog (module × action)
-- ─────────────────────────────────────────────
CREATE TABLE erp_permissions (
  id        SERIAL PRIMARY KEY,
  module    VARCHAR(50) NOT NULL,   -- "inventory", "sales", "finance", "purchasing", "hr"
  action    VARCHAR(50) NOT NULL,   -- "view", "create", "edit", "delete", "approve"
  code      VARCHAR(120) GENERATED ALWAYS AS (module || ':' || action) STORED,
  UNIQUE (module, action)
);

-- Seed examples
INSERT INTO erp_permissions (module, action) VALUES
  ('access', 'view'), ('access', 'manage_roles'), ('access', 'manage_users'),
  ('access', 'manage_branches'), ('access', 'approve_delegations'),
  ('inventory', 'view'), ('inventory', 'adjust_stock'), ('inventory', 'transfer_stock'),
  ('sales', 'view'), ('sales', 'create_order'), ('sales', 'approve_discount'),
  ('purchasing', 'view'), ('purchasing', 'create_po'), ('purchasing', 'approve_po'),
  ('finance', 'view'), ('finance', 'post_payment'), ('finance', 'view_reports'),
  ('hr', 'view'), ('hr', 'run_payroll');

-- ─────────────────────────────────────────────
-- 3. Role → permission mapping
-- ─────────────────────────────────────────────
CREATE TABLE erp_role_permissions (
  role_id       INTEGER NOT NULL REFERENCES erp_roles(id) ON DELETE CASCADE,
  permission_id INTEGER NOT NULL REFERENCES erp_permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);

-- ─────────────────────────────────────────────
-- 4. Branches / warehouses / cost centers (scope beyond company)
-- ─────────────────────────────────────────────
CREATE TABLE erp_branches (
  id             SERIAL PRIMARY KEY,
  ias_company_id INTEGER NOT NULL,
  name           VARCHAR(100) NOT NULL,
  code           VARCHAR(50) NOT NULL,
  status         VARCHAR(20) DEFAULT 'ACTIVE',
  UNIQUE (ias_company_id, code)
);

-- ─────────────────────────────────────────────
-- 5. User → role assignment (per IAS user, per IAS company)
-- ─────────────────────────────────────────────
CREATE TABLE erp_role_assignments (
  id             SERIAL PRIMARY KEY,
  ias_user_id    INTEGER NOT NULL,
  ias_company_id INTEGER NOT NULL,
  role_id        INTEGER NOT NULL REFERENCES erp_roles(id) ON DELETE CASCADE,
  branch_id      INTEGER REFERENCES erp_branches(id),   -- nullable: company-wide if null
  assigned_at    TIMESTAMPTZ DEFAULT now(),
  assigned_by    INTEGER,   -- ias_user_id of the admin who granted it
  UNIQUE (ias_user_id, ias_company_id, role_id, branch_id)
);

-- ─────────────────────────────────────────────
-- 6. Approval limits (finance/purchasing workflow gating)
-- ─────────────────────────────────────────────
CREATE TABLE erp_approval_limits (
  id             SERIAL PRIMARY KEY,
  ias_user_id    INTEGER NOT NULL,
  ias_company_id INTEGER NOT NULL,
  module         VARCHAR(50) NOT NULL,   -- "purchasing", "finance"
  max_amount     NUMERIC(14,2) NOT NULL,
  currency       VARCHAR(10) NOT NULL DEFAULT 'KES',
  UNIQUE (ias_user_id, ias_company_id, module)
);

-- ─────────────────────────────────────────────
-- 7. Delegated approvals (coverage during absence)
-- ─────────────────────────────────────────────
CREATE TABLE erp_approval_delegations (
  id             SERIAL PRIMARY KEY,
  from_user_id   INTEGER NOT NULL,
  to_user_id     INTEGER NOT NULL,
  ias_company_id INTEGER NOT NULL,
  module         VARCHAR(50),            -- null = all modules
  starts_at      TIMESTAMPTZ NOT NULL,
  ends_at        TIMESTAMPTZ NOT NULL,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- ─────────────────────────────────────────────
-- 8. Audit log (compliance trail across all ERP modules)
-- ─────────────────────────────────────────────
CREATE TABLE erp_audit_log (
  id             BIGSERIAL PRIMARY KEY,
  ias_user_id    INTEGER NOT NULL,
  ias_company_id INTEGER NOT NULL,
  entity_type    VARCHAR(50) NOT NULL,   -- "invoice", "purchase_order", "stock_item"
  entity_id      INTEGER NOT NULL,
  action         VARCHAR(50) NOT NULL,   -- "create", "update", "delete", "approve"
  before_state   JSONB,
  after_state    JSONB,
  created_at     TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_audit_entity ON erp_audit_log (entity_type, entity_id);
CREATE INDEX idx_audit_user ON erp_audit_log (ias_user_id, ias_company_id);

-- ─────────────────────────────────────────────
-- 9. Onboarding hook tracking (idempotency for provisioning events)
-- ─────────────────────────────────────────────
CREATE TABLE erp_provisioning_events (
  id             SERIAL PRIMARY KEY,
  ias_company_id INTEGER,
  ias_user_id    INTEGER,
  event_type     VARCHAR(50) NOT NULL,   -- "company_provisioned", "user_created"
  processed_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (ias_company_id, ias_user_id, event_type)
);

-- ─────────────────────────────────────────────
-- ─────────────────────────────────────────────
-- 10. Warehouses — physical stock locations. Deliberately separate from
-- erp_branches (org/access-scoping units from the Access module): not every
-- branch holds stock (a storefront-only office), and not every warehouse
-- maps to an org unit (a third-party fulfillment center). If a company's
-- warehouses and branches happen to be 1:1 in practice, that's fine — this
-- just doesn't assume it.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS erp_warehouses (
  id             BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  ias_company_id BIGINT NOT NULL,
  code           VARCHAR(50) NOT NULL,
  name           VARCHAR(255) NOT NULL,
  location       VARCHAR(255),
  status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | INACTIVE — kept as an
                                                            -- enum, not is_active boolean, to
                                                            -- match erp_roles/erp_branches'
                                                            -- existing convention elsewhere
                                                            -- in this schema
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ias_company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_warehouses_company ON erp_warehouses (ias_company_id);

-- ─────────────────────────────────────────────
-- 11. Products (catalog)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS erp_products (
  id             BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  ias_company_id BIGINT NOT NULL,
  sku            VARCHAR(100) NOT NULL,
  name           VARCHAR(255) NOT NULL,
  description    TEXT,
  unit           VARCHAR(50) NOT NULL DEFAULT 'pcs',
  category       VARCHAR(100),
  cost_price     NUMERIC(15,2) NOT NULL DEFAULT 0,
  sell_price     NUMERIC(15,2) NOT NULL DEFAULT 0,
  reorder_level  NUMERIC(15,3) NOT NULL DEFAULT 0,   -- quantities get 3 decimals (kg/L etc.);
                                                        -- money gets 2 — different domains
  status         VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | ARCHIVED
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (ias_company_id, sku)
);

CREATE INDEX IF NOT EXISTS idx_products_company ON erp_products (ias_company_id);

-- ─────────────────────────────────────────────
-- 12. Stock levels — current quantity per product per warehouse. A cache
-- kept in sync transactionally; erp_stock_movements is the source of truth
-- and can always rebuild this table if it ever drifts.
--
-- reserved_quantity: held by open sales orders but not yet shipped —
-- sellable = quantity - reserved_quantity. Not consumed by anything yet
-- (Sales doesn't exist), but adding it now avoids a painful retrofit once
-- Sales needs to hold stock the moment an order is placed.
--
-- average_cost: a real weighted-average cost, recomputed on every RECEIVE.
-- Fixes the earlier version's getStockValuation(), which only had the
-- product's current cost_price to work with — an approximation, not
-- accounting-grade. This is the actual mechanism that makes it accurate.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS erp_stock_levels (
  id                 BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  ias_company_id     BIGINT NOT NULL,
  product_id         BIGINT NOT NULL REFERENCES erp_products(id) ON DELETE CASCADE,
  product_sku        VARCHAR(100) NOT NULL,  -- denormalized for faster queries; matches erp_products.sku
  product_name       VARCHAR(255) NOT NULL,  -- denormalized for faster queries
  warehouse_id       BIGINT NOT NULL REFERENCES erp_warehouses(id) ON DELETE CASCADE,
  warehouse_name     VARCHAR(255) NOT NULL,  -- denormalized for faster queries
  quantity           NUMERIC(15,3) NOT NULL DEFAULT 0,
  reserved_quantity  NUMERIC(15,3) NOT NULL DEFAULT 0,
  average_cost       NUMERIC(15,2) NOT NULL DEFAULT 0,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (product_id, warehouse_id)
);

CREATE INDEX IF NOT EXISTS idx_stock_levels_company ON erp_stock_levels (ias_company_id);

-- ─────────────────────────────────────────────
-- 13. Stock movements — append-only ledger of every quantity change. The
-- table most likely to actually accumulate billions of rows over years of
-- operation, hence BIGINT from the start rather than growing into it later.
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS erp_stock_movements (
  id             BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  ias_company_id BIGINT NOT NULL,
  product_id     BIGINT NOT NULL REFERENCES erp_products(id) ON DELETE CASCADE,
  product_sku    VARCHAR(100) NOT NULL,  -- denormalized for faster queries; matches erp_products.sku
  product_name   VARCHAR(255) NOT NULL,  -- denormalized for faster queries
  warehouse_id   BIGINT NOT NULL REFERENCES erp_warehouses(id) ON DELETE CASCADE,
  warehouse_name VARCHAR(255) NOT NULL,  -- denormalized for faster queries
  quantity_delta NUMERIC(15,3) NOT NULL,        -- positive = stock in, negative = stock out
  unit_cost      NUMERIC(15,2),                  -- cost basis for this movement; drives the
                                                    -- average_cost recompute on RECEIVE
  reason         VARCHAR(30) NOT NULL,            -- RECEIVE | SALE | ADJUSTMENT | TRANSFER_IN | TRANSFER_OUT | STOCK_COUNT
  reference_type VARCHAR(50),                      -- e.g. "purchase_order", "sales_order", "transfer"
  reference_id   BIGINT,
  notes          TEXT,
  created_by     BIGINT NOT NULL,                  -- ias_user_id
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_stock_movements_company ON erp_stock_movements (ias_company_id);
CREATE INDEX IF NOT EXISTS idx_stock_movements_product ON erp_stock_movements (ias_company_id, product_id);

-- ─────────────────────────────────────────────
-- 14. Stock transfers — one record per transfer, backed by a paired
-- TRANSFER_OUT / TRANSFER_IN movement in erp_stock_movements
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS erp_stock_transfers (
  id                BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  ias_company_id    BIGINT NOT NULL,
  product_id        BIGINT NOT NULL REFERENCES erp_products(id) ON DELETE CASCADE,
  product_sku       VARCHAR(100) NOT NULL,  -- denormalized for faster queries; matches erp_products.sku
  product_name      VARCHAR(255) NOT NULL,  -- denormalized for faster queries
  from_warehouse_id BIGINT NOT NULL REFERENCES erp_warehouses(id),
  from_warehouse_name VARCHAR(255) NOT NULL,  -- denormalized for faster queries
  to_warehouse_id   BIGINT NOT NULL REFERENCES erp_warehouses(id),
  to_warehouse_name VARCHAR(255) NOT NULL,  -- denormalized for faster queries
  quantity          NUMERIC(15,3) NOT NULL,
  status            VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
  created_by        BIGINT NOT NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Permissions for the inventory module
INSERT INTO erp_permissions (module, action) VALUES
  ('inventory', 'manage_products'), ('inventory', 'record_stock_count'),
  ('inventory', 'manage_warehouses');
