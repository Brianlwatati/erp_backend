# erp_backend — User & Access Management module

Express 5 + TypeScript + PostgreSQL service. First module of the ERP;
identity and companies stay owned by **IAS** — this service never verifies
JWTs itself, only ERP-specific authorization on top.

## How it relates to IAS

- **Identity**: every authenticated request's bearer token is verified
  **locally**, using the same `JWT_ACCESS_SECRET`/issuer/audience IAS signs
  with (see `src/middleware/authenticate.ts`, mirroring IAS's own
  `verifyAuth`). No network call to IAS on the hot path — `req.auth` is
  populated straight from the verified token's claims (`userId`,
  `companyId`, `roleName`, `roleCode`, `roleScope`, `roleScopeKey`), all
  already the right types (numbers, not strings).
  - Tradeoff: a user disabled or role-changed in IAS stays valid here until
    their access token expires (`JWT_ACCESS_EXPIRES_IN`, 15m by default) —
    not instantly. Fine for this service's needs; revisit with a
    revocation list if that window ever matters.
  - `src/lib/iasClient.ts` still exists for the rarer case of needing
    richer profile info the JWT doesn't carry (email, name, full company
    record) via IAS's `/auth/me` — not part of the auth path anymore.
- **Companies/products**: unchanged — the ERP registers as a product in IAS
  (`IAS_PRODUCT_CODE=ERP`), and a company only sees it once IAS grants a
  `CompanyProduct` for it.
- **Provisioning**: when IAS creates a company or user, it should call this
  service's webhooks (`POST /api/v1/webhooks/ias/company-provisioned` and
  `/user-created`, guarded by `X-IAS-Webhook-Secret`) so the ERP can seed a
  default role/branch and assign new users to it. Wire these up on the IAS
  side as webhook targets once IAS supports outbound webhooks — if it
  doesn't yet, these can be called manually as a stopgap.

## Open design question: IAS roles vs. ERP roles

IAS's JWT already carries `roleCode`/`roleScope`/`roleScopeKey` (e.g.
`"HR_ADMIN"` / `"PRODUCT"` / `"PRODUCT:HR"`) — a role that's scoped to a
specific product/module. Right now `authorize()` ignores all of that and
only checks the ERP's own `erp_role_assignments` table. Worth deciding:
should `roleScopeKey` gate which ERP modules a user can reach at all (e.g.
a `"PRODUCT:HR"` role has no business calling Inventory routes), on top of
the ERP's own finer-grained module:action permissions? Not applied yet —
flagging it as a real option, not assuming the answer.

## Structure

```
db/
  schema.sql              # full schema (see previous message)
src/
  config/
    env.ts                 # required env vars, fails fast if missing
    db.ts                  # pg Pool + query()/queryOne() helpers
  lib/
    iasClient.ts            # calls IAS's /auth/me
  middleware/
    authenticate.ts          # validates the bearer token against IAS
    authorize.ts              # checkPermission(module, action) as middleware
    errorHandler.ts
  modules/
    roles/                   # ERP roles + their permission matrix
    permissions/              # read-only catalog of module:action permissions
    role-assignments/          # user ↔ role, getUserScope()
    branches/                   # warehouses/cost-centers
    inventory/                    # products, stock levels, movements, transfers, counts
    approval-limits/             # per-user spend caps by module
    approval-delegations/         # temporary approval coverage
    audit-log/                     # read history; writes happen from other services
    provisioning/                    # IAS webhook handlers (company/user created)
  utils/
    apiResponse.ts             # ok()/okList()/fail() — mirrors IAS's envelope shape
    asyncHandler.ts
  app.ts
  index.ts
```

Each module under `modules/` follows the same six-file shape:
`*.types.ts` (interfaces mirroring the DB rows) → `*.validation.ts` (zod
schemas + inferred input types) → `*.repository.ts` (raw SQL, including
`withTransaction` for compound writes) → `*.service.ts` (business logic —
only where there's more than pass-through CRUD) → `*.controller.ts` (parses
request, calls service/repository, shapes response) → `*.routes.ts` (wires
`authenticate`/`authorize` + HTTP methods to controller functions).

## Inventory module

Built on `erp_warehouses`, `erp_products`, `erp_stock_levels`,
`erp_stock_movements` (an append-only ledger — the source of truth
`erp_stock_levels` is derived from), and `erp_stock_transfers` (one record
per transfer, backed by a paired TRANSFER_OUT/TRANSFER_IN movement).

This schema was merged with an independently-written one that made several
real improvements over the original — `ias_company_id` denormalized onto
every table (not just reachable via a join, which matters if this ever
needs Postgres row-level security), `reserved_quantity` so Sales can hold
stock against an open order without a schema change later, `average_cost`
for a true weighted-average valuation instead of an approximation, `BIGINT`
ids throughout (`erp_stock_movements` is the table most likely to actually
accumulate billions of rows over years), and `NUMERIC(15,3)` for quantities
vs. `NUMERIC(15,2)` for money, since those are different precision domains.

**Warehouses are deliberately separate from `erp_branches`** (the
Access module's org/scoping unit) rather than reusing branches as stock
locations — not every branch holds stock, and not every warehouse maps to
an org unit. If a company's warehouses and branches happen to line up 1:1
in practice, that's fine; this just doesn't assume it. One open thread from
this: `erp_role_assignments.branch_id` scopes a user's *access*, but has no
relationship to which *warehouses* they can act on — worth deciding whether
warehouse-level permission scoping is needed once Sales/Purchasing exist
and stock movements get restricted per-location.

**BIGINT ids come back from Postgres as JS strings by default** —
node-postgres does this deliberately, since a bigint can exceed
`Number.MAX_SAFE_INTEGER`. Every `id` field in this codebase is still typed
(and used) as `number`, so `src/config/db.ts` registers a type parser for
oid 20 (int8) that parses them to numbers on the way out. Verified directly
against Postgres — see the note below. `NUMERIC`/`DECIMAL` columns
(money, quantities) are deliberately *not* parsed this way and stay
strings, since those genuinely need to avoid floating-point precision loss.

Every stock mutation (`adjustStock`, `transferStock`, `recordStockCount`)
goes through `inventoryRepository.applyMovement`, which locks the stock
level row (`FOR UPDATE`), computes the new quantity and — for stock-in
movements with a `unitCost` — the new weighted-average cost, then writes
both the level and the ledger row in one transaction. `transferStock` and
`reserveStock` check *available* quantity (`quantity - reserved_quantity`),
not raw quantity, so stock held by an open order can't be transferred out
from under it; a transfer's destination warehouse inherits the source's
`average_cost` at transfer time, since moving stock between locations isn't
a new cost event.

This was verified end-to-end against a real Postgres instance, not just
`tsc`: weighted-average cost across two RECEIVEs at different unit costs
computed correctly ((50×100 + 50×200)/100 = 150), a transfer request for
more than what's *available* (accounting for a reservation) was correctly
rejected while leaving nothing written, and a subsequent transfer within
the available amount correctly carried the averaged cost to the
destination warehouse.

`getStockValuation` now uses `average_cost`, not the product's current
`cost_price` — the earlier version's known limitation, fixed by this merge.

## Getting started

This project uses **Node.js ESM** consistently. `package.json` sets `"type": "module"` and `tsconfig.json` uses `module`/`moduleResolution: "NodeNext"`. Relative TypeScript imports intentionally use `.js` extensions so the compiled `dist/` output runs directly in Node.

```bash
npm install
cp .env.example .env
# fill in DATABASE_URL, IAS_BASE_URL, IAS_WEBHOOK_SECRET and JWT_ACCESS_SECRET
npm run db:check
npm run migrate
npm run dev
```

Do not use `module: commonjs` with this project. The migration runner is executed with `tsx` and the production build is executed with `node dist/index.js` using the same ESM model.

### Database commands

```bash
npm run db:check
npm run migrate
```

`migrate` tracks the applied initial schema in `schema_migrations` and does not execute it again once `001_initial` has been recorded.

### IAS session bootstrap

`GET /api/v1/auth/me` authenticates the IAS JWT locally first, then calls IAS's configured `IAS_TOKEN_VERIFY_PATH` to retrieve the authoritative current-user profile. This is intended for ERP session bootstrap/profile verification, not for every ERP API request. Normal requests only verify the IAS-signed JWT locally.

## Auth model in one paragraph

`authenticate` populates `req.iasUser` from IAS. `authorize(module, action)`
then checks whether that user — in `req.iasUser.companyId` — holds an ERP
role (`erp_role_assignments` → `erp_role_permissions` → `erp_permissions`)
granting `module:action`. The two are separate middlewares on purpose: some
routes only need "is this a real logged-in user" (e.g. `GET /role-assignments/me/scope`),
others need a specific permission.

## What's deliberately thin right now

- `roles`/`permissions`/`role-assignments`/`branches`/`provisioning` are
  fully built out (repository → service → controller → routes where it
  matters).
- `approval-limits`, `approval-delegations`, `audit-log` have working
  repository + controller + routes, but no service layer — there's no
  business logic beyond CRUD yet (e.g. nothing currently *enforces* an
  approval limit against a purchase order, since Purchasing doesn't exist
  yet). Revisit once those modules exist.
- No tests yet.
- `verifyWebhookSecret` is a static shared-secret header check, fine for a
  trusted internal call from IAS but worth upgrading to HMAC-signed payloads
  if this ever crosses a public network boundary.
