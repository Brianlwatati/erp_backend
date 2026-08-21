import type { PoolClient } from "pg";
import { query, queryOne, withTransaction } from "../../config/db.js";
import type {
  Product,
  StockLevelWithDetails,
  StockMovement,
  StockMovementReason,
  StockTransfer,
  StockValuationRow,
  Warehouse,
} from "./inventory.types.js";

const SELECT_WAREHOUSE = `
  SELECT id, ias_company_id AS "iasCompanyId", code, name, location, status,
         created_at AS "createdAt", updated_at AS "updatedAt"
  FROM erp_warehouses
`;

const SELECT_PRODUCT = `
  SELECT id, ias_company_id AS "iasCompanyId", sku, name, description, unit,
         category, cost_price AS "costPrice", sell_price AS "sellPrice",
         reorder_level AS "reorderLevel", status,
         created_at AS "createdAt", updated_at AS "updatedAt"
  FROM erp_products
`;

interface RawStockLevel {
  quantity: string;
  reservedQuantity: string;
  averageCost: string;
}

export const inventoryRepository = {
  // ---- Warehouses ----
  listWarehouses: (iasCompanyId: number) =>
    query<Warehouse>(`${SELECT_WAREHOUSE} WHERE ias_company_id = $1 ORDER BY name`, [
      iasCompanyId,
    ]),

  findWarehouseById: (id: number, iasCompanyId: number) =>
    queryOne<Warehouse>(`${SELECT_WAREHOUSE} WHERE id = $1 AND ias_company_id = $2`, [
      id,
      iasCompanyId,
    ]),

  createWarehouse: (
    iasCompanyId: number,
    input: { code: string; name: string; location?: string },
  ) =>
    queryOne<Warehouse>(
      `INSERT INTO erp_warehouses (ias_company_id, code, name, location)
       VALUES ($1, $2, $3, $4)
       RETURNING id, ias_company_id AS "iasCompanyId", code, name, location, status,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [iasCompanyId, input.code, input.name, input.location ?? null],
    ),

  // ---- Products ----
  listProducts: (iasCompanyId: number, status?: "ACTIVE" | "ARCHIVED") =>
    query<Product>(
      `${SELECT_PRODUCT} WHERE ias_company_id = $1 AND ($2::varchar IS NULL OR status = $2) ORDER BY name`,
      [iasCompanyId, status ?? null],
    ),

  findProductById: (id: number, iasCompanyId: number) =>
    queryOne<Product>(`${SELECT_PRODUCT} WHERE id = $1 AND ias_company_id = $2`, [
      id,
      iasCompanyId,
    ]),

  createProduct: (
    iasCompanyId: number,
    input: {
      sku: string;
      name: string;
      description?: string;
      unit: string;
      category?: string;
      costPrice: number;
      sellPrice: number;
      reorderLevel: number;
    },
  ) =>
    queryOne<Product>(
      `INSERT INTO erp_products
         (ias_company_id, sku, name, description, unit, category, cost_price, sell_price, reorder_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, ias_company_id AS "iasCompanyId", sku, name, description, unit,
                 category, cost_price AS "costPrice", sell_price AS "sellPrice",
                 reorder_level AS "reorderLevel", status,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        iasCompanyId,
        input.sku,
        input.name,
        input.description ?? null,
        input.unit,
        input.category ?? null,
        input.costPrice,
        input.sellPrice,
        input.reorderLevel,
      ],
    ),

  updateProduct: (
    id: number,
    iasCompanyId: number,
    input: Partial<{
      name: string;
      description: string;
      unit: string;
      category: string;
      costPrice: number;
      sellPrice: number;
      reorderLevel: number;
      status: "ACTIVE" | "ARCHIVED";
    }>,
  ) =>
    queryOne<Product>(
      `UPDATE erp_products SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         unit = COALESCE($5, unit),
         category = COALESCE($6, category),
         cost_price = COALESCE($7, cost_price),
         sell_price = COALESCE($8, sell_price),
         reorder_level = COALESCE($9, reorder_level),
         status = COALESCE($10, status),
         updated_at = now()
       WHERE id = $1 AND ias_company_id = $2
       RETURNING id, ias_company_id AS "iasCompanyId", sku, name, description, unit,
                 category, cost_price AS "costPrice", sell_price AS "sellPrice",
                 reorder_level AS "reorderLevel", status,
                 created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        iasCompanyId,
        input.name ?? null,
        input.description ?? null,
        input.unit ?? null,
        input.category ?? null,
        input.costPrice ?? null,
        input.sellPrice ?? null,
        input.reorderLevel ?? null,
        input.status ?? null,
      ],
    ),

  // archiveProduct is just updateProduct with status: "ARCHIVED" — no
  // separate repository method needed, kept as a service-level convenience.

  // ---- Stock levels ----
  getStockLevel: async (productId: number, warehouseId: number) => {
    const row = await queryOne<RawStockLevel>(
      `SELECT quantity, reserved_quantity AS "reservedQuantity", average_cost AS "averageCost"
       FROM erp_stock_levels WHERE product_id = $1 AND warehouse_id = $2`,
      [productId, warehouseId],
    );
    return row ?? { quantity: "0", reservedQuantity: "0", averageCost: "0" };
  },

  getStockByWarehouse: (productId: number) =>
    query<{ warehouseId: number; quantity: string; reservedQuantity: string }>(
      `SELECT warehouse_id AS "warehouseId", quantity, reserved_quantity AS "reservedQuantity"
       FROM erp_stock_levels WHERE product_id = $1`,
      [productId],
    ),

  // GET /inventory/stock — browsable, filterable view across every
  // product×warehouse combination, joined with just enough product/
  // warehouse identity to be readable without a second lookup. Scoped by
  // ias_company_id on both joined tables, not just the product side, so a
  // stray warehouseId belonging to a different company can't leak rows —
  // the join simply won't match anything for it.
  listStockLevels: (
    iasCompanyId: number,
    filters: { productId?: number; warehouseId?: number },
  ) =>
    query<StockLevelWithDetails>(
      `SELECT p.id AS "productId", p.sku, p.name AS "productName",
              w.id AS "warehouseId", w.code AS "warehouseCode", w.name AS "warehouseName",
              sl.quantity, sl.reserved_quantity AS "reservedQuantity",
              (sl.quantity - sl.reserved_quantity) AS "availableQuantity",
              sl.average_cost AS "averageCost", sl.updated_at AS "updatedAt"
       FROM erp_stock_levels sl
       JOIN erp_products p ON p.id = sl.product_id AND p.ias_company_id = $1
       JOIN erp_warehouses w ON w.id = sl.warehouse_id AND w.ias_company_id = $1
       WHERE ($2::bigint IS NULL OR p.id = $2)
         AND ($3::bigint IS NULL OR w.id = $3)
       ORDER BY p.name, w.name`,
      [iasCompanyId, filters.productId ?? null, filters.warehouseId ?? null],
    ),

  // Low stock: total quantity across all warehouses (or one, if given)
  // below the product's reorder_level. Uses raw quantity, not
  // quantity-minus-reserved — replenishment decisions are about what's
  // physically on hand, not what's currently sellable.
  getLowStockItems: (iasCompanyId: number, warehouseId?: number) =>
    query<Product & { totalQuantity: string }>(
      `SELECT p.id, p.ias_company_id AS "iasCompanyId", p.sku, p.name, p.description,
              p.unit, p.category, p.cost_price AS "costPrice", p.sell_price AS "sellPrice",
              p.reorder_level AS "reorderLevel", p.status,
              p.created_at AS "createdAt", p.updated_at AS "updatedAt",
              COALESCE(SUM(sl.quantity), 0) AS "totalQuantity"
       FROM erp_products p
       LEFT JOIN erp_stock_levels sl ON sl.product_id = p.id
         AND ($2::bigint IS NULL OR sl.warehouse_id = $2)
       WHERE p.ias_company_id = $1 AND p.status = 'ACTIVE'
       GROUP BY p.id
       HAVING COALESCE(SUM(sl.quantity), 0) <= p.reorder_level
       ORDER BY p.name`,
      [iasCompanyId, warehouseId ?? null],
    ),

  // True weighted-average valuation now, using average_cost (recomputed on
  // every RECEIVE — see applyMovement) instead of the product's current
  // cost_price. cost_price can drift from what stock actually cost to
  // acquire; average_cost can't, since it's derived from the movements
  // that actually happened.
  getStockValuation: (iasCompanyId: number) =>
    query<StockValuationRow>(
      `SELECT p.id AS "productId", p.sku, p.name,
              COALESCE(SUM(sl.quantity), 0) AS "totalQuantity",
              CASE WHEN COALESCE(SUM(sl.quantity), 0) > 0
                   THEN SUM(sl.quantity * sl.average_cost) / SUM(sl.quantity)
                   ELSE 0 END AS "averageCost",
              COALESCE(SUM(sl.quantity * sl.average_cost), 0) AS valuation
       FROM erp_products p
       LEFT JOIN erp_stock_levels sl ON sl.product_id = p.id
       WHERE p.ias_company_id = $1 AND p.status = 'ACTIVE'
       GROUP BY p.id
       ORDER BY valuation DESC`,
      [iasCompanyId],
    ),

  // ---- Stock movements (the ledger) ----
  listMovements: (productId: number, warehouseId?: number) =>
    query<StockMovement>(
      `SELECT id, product_id AS "productId", warehouse_id AS "warehouseId",
              quantity_delta AS "quantityDelta", unit_cost AS "unitCost", reason,
              reference_type AS "referenceType", reference_id AS "referenceId",
              notes, created_by AS "createdBy", created_at AS "createdAt"
       FROM erp_stock_movements
       WHERE product_id = $1 AND ($2::bigint IS NULL OR warehouse_id = $2)
       ORDER BY created_at DESC`,
      [productId, warehouseId ?? null],
    ),

  // Core primitive every other stock operation is built from: lock the
  // stock-level row (creating it at zero if it doesn't exist yet), compute
  // the new quantity and — for stock-in movements with a unit cost — the
  // new weighted-average cost, write both the updated level and a ledger
  // row, all inside the caller's transaction so it stays atomic.
  //
  // The average-cost math is done in JS on numbers parsed from NUMERIC
  // strings, not in SQL on NUMERIC directly — simpler to read and test,
  // at the cost of a theoretical sliver of float precision versus doing
  // the arithmetic in Postgres. Fine at this scale; revisit if this ever
  // needs to be audit-exact to the last cent.
  applyMovement: async (
    client: PoolClient,
    input: {
      iasCompanyId: number;
      productId: number;
      warehouseId: number;
      quantityDelta: number;
      unitCost?: number | null;
      reason: StockMovementReason;
      referenceType?: string | null;
      referenceId?: number | null;
      notes?: string | null;
      createdBy: number;
    },
  ): Promise<StockMovement> => {
    await client.query(
      `INSERT INTO erp_stock_levels (ias_company_id, product_id, warehouse_id)
       VALUES ($1, $2, $3)
       ON CONFLICT (product_id, warehouse_id) DO NOTHING`,
      [input.iasCompanyId, input.productId, input.warehouseId],
    );

    const lockResult = await client.query<RawStockLevel>(
      `SELECT quantity, reserved_quantity AS "reservedQuantity", average_cost AS "averageCost"
       FROM erp_stock_levels
       WHERE product_id = $1 AND warehouse_id = $2
       FOR UPDATE`,
      [input.productId, input.warehouseId],
    );
    const current = lockResult.rows[0]!;
    const currentQuantity = Number(current.quantity);
    const currentAverageCost = Number(current.averageCost);

    const newQuantity = currentQuantity + input.quantityDelta;

    let newAverageCost = currentAverageCost;
    if (input.quantityDelta > 0 && input.unitCost != null && newQuantity > 0) {
      newAverageCost =
        (currentQuantity * currentAverageCost + input.quantityDelta * input.unitCost) /
        newQuantity;
    }

    await client.query(
      `UPDATE erp_stock_levels
       SET quantity = $3, average_cost = $4, updated_at = now()
       WHERE product_id = $1 AND warehouse_id = $2`,
      [input.productId, input.warehouseId, newQuantity, newAverageCost],
    );

    const movementResult = await client.query(
      `INSERT INTO erp_stock_movements
         (ias_company_id, product_id, warehouse_id, quantity_delta, unit_cost, reason,
          reference_type, reference_id, notes, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id, product_id AS "productId", warehouse_id AS "warehouseId",
                 quantity_delta AS "quantityDelta", unit_cost AS "unitCost", reason,
                 reference_type AS "referenceType", reference_id AS "referenceId",
                 notes, created_by AS "createdBy", created_at AS "createdAt"`,
      [
        input.iasCompanyId,
        input.productId,
        input.warehouseId,
        input.quantityDelta,
        input.unitCost ?? null,
        input.reason,
        input.referenceType ?? null,
        input.referenceId ?? null,
        input.notes ?? null,
        input.createdBy,
      ],
    );

    return movementResult.rows[0] as StockMovement;
  },

  // adjustStockLevel(productId, quantity, reason) — single-warehouse change.
  adjustStock: (input: {
    iasCompanyId: number;
    productId: number;
    warehouseId: number;
    quantityDelta: number;
    unitCost?: number;
    reason: "RECEIVE" | "SALE" | "ADJUSTMENT";
    referenceType?: string;
    referenceId?: number;
    notes?: string;
    createdBy: number;
  }) => withTransaction((client) => inventoryRepository.applyMovement(client, input)),

  // transferStock(fromWarehouse, toWarehouse, items) — here scoped to one
  // product per call; the service loops this for multi-item transfers.
  // Locks the source stock level and checks *available* quantity
  // (quantity - reserved), so stock held by an open sales order can't be
  // transferred out from under it. The destination's average_cost carries
  // over the source's average_cost at transfer time, since moving stock
  // between warehouses isn't a new cost event.
  transferStock: (input: {
    iasCompanyId: number;
    productId: number;
    fromWarehouseId: number;
    toWarehouseId: number;
    quantity: number;
    notes?: string;
    createdBy: number;
  }) =>
    withTransaction(async (client) => {
      await client.query(
        `INSERT INTO erp_stock_levels (ias_company_id, product_id, warehouse_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id, warehouse_id) DO NOTHING`,
        [input.iasCompanyId, input.productId, input.fromWarehouseId],
      );

      const lockResult = await client.query<RawStockLevel>(
        `SELECT quantity, reserved_quantity AS "reservedQuantity", average_cost AS "averageCost"
         FROM erp_stock_levels WHERE product_id = $1 AND warehouse_id = $2 FOR UPDATE`,
        [input.productId, input.fromWarehouseId],
      );
      const source = lockResult.rows[0]!;
      const available = Number(source.quantity) - Number(source.reservedQuantity);
      if (available < input.quantity) {
        throw new Error(
          `Insufficient available stock: ${available} available (${source.quantity} on hand, ${source.reservedQuantity} reserved), ${input.quantity} requested`,
        );
      }

      await inventoryRepository.applyMovement(client, {
        iasCompanyId: input.iasCompanyId,
        productId: input.productId,
        warehouseId: input.fromWarehouseId,
        quantityDelta: -input.quantity,
        reason: "TRANSFER_OUT",
        referenceType: "transfer",
        notes: input.notes,
        createdBy: input.createdBy,
      });
      await inventoryRepository.applyMovement(client, {
        iasCompanyId: input.iasCompanyId,
        productId: input.productId,
        warehouseId: input.toWarehouseId,
        quantityDelta: input.quantity,
        unitCost: Number(source.averageCost),
        reason: "TRANSFER_IN",
        referenceType: "transfer",
        notes: input.notes,
        createdBy: input.createdBy,
      });

      const transferResult = await client.query(
        `INSERT INTO erp_stock_transfers
           (ias_company_id, product_id, from_warehouse_id, to_warehouse_id, quantity, created_by)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, ias_company_id AS "iasCompanyId", product_id AS "productId",
                   from_warehouse_id AS "fromWarehouseId", to_warehouse_id AS "toWarehouseId",
                   quantity, status, created_by AS "createdBy", created_at AS "createdAt"`,
        [
          input.iasCompanyId,
          input.productId,
          input.fromWarehouseId,
          input.toWarehouseId,
          input.quantity,
          input.createdBy,
        ],
      );

      return transferResult.rows[0] as StockTransfer;
    }),

  // recordStockCount — reconciles a physical count against the system
  // quantity by writing the variance as a single ADJUSTMENT-style movement.
  // average_cost is left unchanged: a found surplus has no known cost basis,
  // and a shortfall doesn't change what the remaining stock cost to acquire.
  recordStockCount: (input: {
    iasCompanyId: number;
    productId: number;
    warehouseId: number;
    countedQuantity: number;
    notes?: string;
    createdBy: number;
  }) =>
    withTransaction(async (client) => {
      await client.query(
        `INSERT INTO erp_stock_levels (ias_company_id, product_id, warehouse_id)
         VALUES ($1, $2, $3)
         ON CONFLICT (product_id, warehouse_id) DO NOTHING`,
        [input.iasCompanyId, input.productId, input.warehouseId],
      );

      const lockResult = await client.query<RawStockLevel>(
        `SELECT quantity FROM erp_stock_levels WHERE product_id = $1 AND warehouse_id = $2 FOR UPDATE`,
        [input.productId, input.warehouseId],
      );
      const systemQuantity = Number(lockResult.rows[0]!.quantity);
      const variance = input.countedQuantity - systemQuantity;

      if (variance === 0) {
        return { systemQuantity, countedQuantity: input.countedQuantity, variance, movement: null };
      }

      const movement = await inventoryRepository.applyMovement(client, {
        iasCompanyId: input.iasCompanyId,
        productId: input.productId,
        warehouseId: input.warehouseId,
        quantityDelta: variance,
        reason: "STOCK_COUNT",
        notes: input.notes ?? `Physical count reconciliation (variance ${variance})`,
        createdBy: input.createdBy,
      });

      return { systemQuantity, countedQuantity: input.countedQuantity, variance, movement };
    }),

  // ---- Reservations (not consumed by anything yet — Sales doesn't exist —
  // but exposed now so that module can hold stock against open orders
  // without a schema change later). reserve() checks against *available*
  // quantity the same way transferStock does.
  reserveStock: (input: { productId: number; warehouseId: number; quantity: number }) =>
    withTransaction(async (client) => {
      const lockResult = await client.query<RawStockLevel>(
        `SELECT quantity, reserved_quantity AS "reservedQuantity"
         FROM erp_stock_levels WHERE product_id = $1 AND warehouse_id = $2 FOR UPDATE`,
        [input.productId, input.warehouseId],
      );
      const row = lockResult.rows[0];
      const available = row ? Number(row.quantity) - Number(row.reservedQuantity) : 0;
      if (available < input.quantity) {
        throw new Error(`Insufficient available stock to reserve: ${available} available`);
      }
      await client.query(
        `UPDATE erp_stock_levels SET reserved_quantity = reserved_quantity + $3, updated_at = now()
         WHERE product_id = $1 AND warehouse_id = $2`,
        [input.productId, input.warehouseId, input.quantity],
      );
    }),

  releaseReservation: (input: { productId: number; warehouseId: number; quantity: number }) =>
    query(
      `UPDATE erp_stock_levels
       SET reserved_quantity = GREATEST(reserved_quantity - $3, 0), updated_at = now()
       WHERE product_id = $1 AND warehouse_id = $2`,
      [input.productId, input.warehouseId, input.quantity],
    ),
};
