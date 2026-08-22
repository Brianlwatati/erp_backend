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
  SELECT
    id,
    ias_company_id AS "iasCompanyId",
    code,
    name,
    location,
    status,
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM erp_warehouses
`;

const SELECT_STOCK_LEVEL = `
SELECT
  id,
  ias_company_id AS "iasCompanyId",
  product_id AS "productId",
  product_sku AS "productSku",
  product_name AS "productName",
  warehouse_id AS "warehouseId",
  warehouse_name AS "warehouseName",
  quantity,
  reserved_quantity AS "reservedQuantity",
  average_cost AS "averageCost",
  updated_at AS "updatedAt"
FROM erp_stock_levels
`;

const SELECT_PRODUCT = `
  SELECT
    id,
    ias_company_id AS "iasCompanyId",
    sku,
    name,
    description,
    unit,
    category,
    cost_price AS "costPrice",
    sell_price AS "sellPrice",
    reorder_level AS "reorderLevel",
    status,
    created_at AS "createdAt",
    updated_at AS "updatedAt"
  FROM erp_products
`;

interface RawStockLevel {
  quantity: string;
  reservedQuantity: string;
  averageCost: string;
}

export const inventoryRepository = {
  // ---------------------------------------------------------------------------
  // Warehouses
  // ---------------------------------------------------------------------------

  listWarehouses: (iasCompanyId: number) =>
    query<Warehouse>(
      `${SELECT_WAREHOUSE}
       WHERE ias_company_id = $1
       ORDER BY name`,
      [iasCompanyId],
    ),

  findWarehouseById: (id: number, iasCompanyId: number) =>
    queryOne<Warehouse>(
      `${SELECT_WAREHOUSE}
       WHERE id = $1
         AND ias_company_id = $2`,
      [id, iasCompanyId],
    ),

  createWarehouse: (
    iasCompanyId: number,
    input: {
      code: string;
      name: string;
      location?: string;
    },
  ) =>
    queryOne<Warehouse>(
      `INSERT INTO erp_warehouses (
         ias_company_id,
         code,
         name,
         location
       )
       VALUES ($1, $2, $3, $4)
       RETURNING
         id,
         ias_company_id AS "iasCompanyId",
         code,
         name,
         location,
         status,
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
      [iasCompanyId, input.code, input.name, input.location ?? null],
    ),

  // ---------------------------------------------------------------------------
  // Products
  // ---------------------------------------------------------------------------

  listProducts: (iasCompanyId: number, status?: "ACTIVE" | "ARCHIVED") =>
    query<Product>(
      `${SELECT_PRODUCT}
       WHERE ias_company_id = $1
         AND ($2::varchar IS NULL OR status = $2)
       ORDER BY name`,
      [iasCompanyId, status ?? null],
    ),

  findProductById: (id: number, iasCompanyId: number) =>
    queryOne<Product>(
      `${SELECT_PRODUCT}
       WHERE id = $1
         AND ias_company_id = $2`,
      [id, iasCompanyId],
    ),

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
      `INSERT INTO erp_products (
         ias_company_id,
         sku,
         name,
         description,
         unit,
         category,
         cost_price,
         sell_price,
         reorder_level
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING
         id,
         ias_company_id AS "iasCompanyId",
         sku,
         name,
         description,
         unit,
         category,
         cost_price AS "costPrice",
         sell_price AS "sellPrice",
         reorder_level AS "reorderLevel",
         status,
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
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
      `UPDATE erp_products
       SET
         name = COALESCE($3, name),
         description = COALESCE($4, description),
         unit = COALESCE($5, unit),
         category = COALESCE($6, category),
         cost_price = COALESCE($7, cost_price),
         sell_price = COALESCE($8, sell_price),
         reorder_level = COALESCE($9, reorder_level),
         status = COALESCE($10, status),
         updated_at = now()
       WHERE id = $1
         AND ias_company_id = $2
       RETURNING
         id,
         ias_company_id AS "iasCompanyId",
         sku,
         name,
         description,
         unit,
         category,
         cost_price AS "costPrice",
         sell_price AS "sellPrice",
         reorder_level AS "reorderLevel",
         status,
         created_at AS "createdAt",
         updated_at AS "updatedAt"`,
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

  // archiveProduct is intentionally handled by the service through
  // updateProduct({ status: "ARCHIVED" }).

  // ---------------------------------------------------------------------------
  // Stock Levels
  // ---------------------------------------------------------------------------

  getStockLevel: async (productId: number, warehouseId: number) => {
    const row = await queryOne<RawStockLevel>(
      `${SELECT_STOCK_LEVEL}
       WHERE product_id = $1
         AND warehouse_id = $2`,
      [productId, warehouseId],
    );

    return (
      row ?? {
        quantity: "0",
        reservedQuantity: "0",
        averageCost: "0",
      }
    );
  },

  getStockByWarehouse: (productId: number) =>
    query<{
      warehouseId: number;
      quantity: string;
      reservedQuantity: string;
    }>(
      `${SELECT_STOCK_LEVEL}
       WHERE product_id = $1`,
      [productId],
    ),

  // GET /inventory/stock
  //
  // Product × warehouse combination with the identity information required
  // by the inventory UI.
  //
  // Company scoping is applied to both joined tables.
  listStockLevels: (
    iasCompanyId: number,
    filters: {
      productId?: number;
      warehouseId?: number;
    },
  ) =>
    query<StockLevelWithDetails>(
      `SELECT
         sl."productId",
         sl."productSku" AS "sku",
         sl."productName",

         sl."warehouseId",
         w.code AS "warehouseCode",
         sl."warehouseName",

         sl.quantity,
         sl."reservedQuantity",
         (sl.quantity - sl."reservedQuantity") AS "availableQuantity",
         sl."averageCost",
         sl."updatedAt"

       FROM (${SELECT_STOCK_LEVEL}) sl

       JOIN erp_warehouses w
         ON w.id = sl."warehouseId"
        AND w.ias_company_id = $1

       WHERE sl."iasCompanyId" = $1
         AND ($2::bigint IS NULL OR sl."productId" = $2)
         AND ($3::bigint IS NULL OR sl."warehouseId" = $3)

       ORDER BY sl."productName", sl."warehouseName"`,
      [iasCompanyId, filters.productId ?? null, filters.warehouseId ?? null],
    ),

  // ---------------------------------------------------------------------------
  // Low Stock
  // ---------------------------------------------------------------------------

  // Total quantity across all warehouses, or a specific warehouse.
  //
  // Uses physical quantity rather than available quantity because
  // replenishment decisions are based on stock physically on hand.
  getLowStockItems: (iasCompanyId: number, warehouseId?: number) =>
    query<Product & { totalQuantity: string }>(
      `SELECT
         p.id,
         p.ias_company_id AS "iasCompanyId",
         p.sku,
         p.name,
         p.description,
         p.unit,
         p.category,
         p.cost_price AS "costPrice",
         p.sell_price AS "sellPrice",
         p.reorder_level AS "reorderLevel",
         p.status,
         p.created_at AS "createdAt",
         p.updated_at AS "updatedAt",

         COALESCE(SUM(sl.quantity), 0) AS "totalQuantity"

       FROM erp_products p

       LEFT JOIN erp_stock_levels sl
         ON sl.product_id = p.id
        AND ($2::bigint IS NULL OR sl.warehouse_id = $2)

       WHERE p.ias_company_id = $1
         AND p.status = 'ACTIVE'

       GROUP BY p.id

       HAVING COALESCE(SUM(sl.quantity), 0) <= p.reorder_level

       ORDER BY p.name`,
      [iasCompanyId, warehouseId ?? null],
    ),

  // ---------------------------------------------------------------------------
  // Stock Valuation
  // ---------------------------------------------------------------------------

  // Weighted-average valuation based on the average_cost stored against
  // each product/warehouse stock level.
  getStockValuation: (iasCompanyId: number) =>
    query<StockValuationRow>(
      `SELECT
         p.id AS "productId",
         p.sku,
         p.name,

         COALESCE(SUM(sl.quantity), 0) AS "totalQuantity",

         CASE
           WHEN COALESCE(SUM(sl.quantity), 0) > 0
           THEN SUM(sl.quantity * sl.average_cost)
                / SUM(sl.quantity)
           ELSE 0
         END AS "averageCost",

         COALESCE(
           SUM(sl.quantity * sl.average_cost),
           0
         ) AS valuation

       FROM erp_products p

       LEFT JOIN erp_stock_levels sl
         ON sl.product_id = p.id

       WHERE p.ias_company_id = $1
         AND p.status = 'ACTIVE'

       GROUP BY p.id

       ORDER BY valuation DESC`,
      [iasCompanyId],
    ),

  // ---------------------------------------------------------------------------
  // Stock Movements
  // ---------------------------------------------------------------------------

  // Product-specific movement history.
  //
  // productSku, productName and warehouseName come directly from the
  // denormalized movement row, so no product/warehouse joins are required.
  listMovements: (productId: number, warehouseId?: number) =>
    query<StockMovement>(
      `SELECT
         id,

         product_id AS "productId",
         product_sku AS "productSku",
         product_name AS "productName",

         warehouse_id AS "warehouseId",
         warehouse_name AS "warehouseName",

         quantity_delta AS "quantityDelta",
         unit_cost AS "unitCost",
         reason,

         reference_type AS "referenceType",
         reference_id AS "referenceId",

         notes,
         created_by AS "createdBy",
         created_at AS "createdAt"

       FROM erp_stock_movements

       WHERE product_id = $1
         AND (
           $2::bigint IS NULL
           OR warehouse_id = $2
         )

       ORDER BY created_at DESC`,
      [productId, warehouseId ?? null],
    ),

  listAllMovements: (iasCompanyId: number, warehouseId?: number) => {
    return query<StockMovement>(
      `SELECT
         id,

         product_id AS "productId",
         product_sku AS "productSku",
         product_name AS "productName",

         warehouse_id AS "warehouseId",
         warehouse_name AS "warehouseName",

         quantity_delta AS "quantityDelta",
         unit_cost AS "unitCost",
         reason,

         reference_type AS "referenceType",
         reference_id AS "referenceId",

         notes,
         created_by AS "createdBy",
         created_at AS "createdAt"

       FROM erp_stock_movements

       WHERE ias_company_id = $1
         AND (
           $2::bigint IS NULL
           OR warehouse_id = $2
         )

       ORDER BY created_at DESC`,
      [iasCompanyId, warehouseId ?? null],
    );
  },

  // Company-wide movement history.
  //
  // This is especially useful for an inventory movement screen because
  // product and warehouse names are already stored on the ledger row.
  listGeneralMovements: (iasCompanyId: number) =>
    query<StockMovement>(
      `SELECT
         id,

         product_id AS "productId",
         product_sku AS "productSku",
         product_name AS "productName",

         warehouse_id AS "warehouseId",
         warehouse_name AS "warehouseName",

         quantity_delta AS "quantityDelta",
         unit_cost AS "unitCost",
         reason,

         reference_type AS "referenceType",
         reference_id AS "referenceId",

         notes,
         created_by AS "createdBy",
         created_at AS "createdAt"

       FROM erp_stock_movements

       WHERE ias_company_id = $1

       ORDER BY created_at DESC`,
      [iasCompanyId],
    ),

  // ---------------------------------------------------------------------------
  // Core Movement Primitive
  // ---------------------------------------------------------------------------

  // Every stock mutation eventually uses this method.
  //
  // Responsibilities:
  // 1. Ensure the product/warehouse stock-level row exists.
  // 2. Lock the stock-level row.
  // 3. Calculate the new quantity.
  // 4. Recalculate weighted average cost for stock-in movements.
  // 5. Update erp_stock_levels.
  // 6. Insert an immutable ledger row into erp_stock_movements.
  //
  // The denormalized product/warehouse identity is stored as a snapshot
  // on the movement itself.
  applyMovement: async (
    client: PoolClient,
    input: {
      iasCompanyId: number;

      productId: number;
      productSku: string;
      productName: string;

      warehouseId: number;
      warehouseName: string;

      quantityDelta: number;
      unitCost?: number | null;

      reason: StockMovementReason;

      referenceType?: string | null;
      referenceId?: number | null;
      notes?: string | null;

      createdBy: number;
    },
  ): Promise<StockMovement> => {
    // Ensure a stock-level row exists before attempting to lock it.
    await client.query(
      `INSERT INTO erp_stock_levels (
         ias_company_id,
         product_id,
         product_sku,
         product_name,
         warehouse_id,
         warehouse_name
       )
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (product_id, warehouse_id)
       DO NOTHING`,
      [
        input.iasCompanyId,
        input.productId,
        input.productSku,
        input.productName,
        input.warehouseId,
        input.warehouseName,
      ],
    );

    // Lock the current stock level so concurrent stock mutations
    // cannot calculate from the same stale quantity.
    const lockResult = await client.query<RawStockLevel>(
      `${SELECT_STOCK_LEVEL}
       WHERE product_id = $1
         AND warehouse_id = $2
       FOR UPDATE`,
      [input.productId, input.warehouseId],
    );

    const current = lockResult.rows[0]!;

    const currentQuantity = Number(current.quantity);

    const currentAverageCost = Number(current.averageCost);

    const newQuantity = currentQuantity + input.quantityDelta;

    // Only stock-in movements with a supplied unit cost
    // affect the weighted average cost.
    let newAverageCost = currentAverageCost;

    if (input.quantityDelta > 0 && input.unitCost != null && newQuantity > 0) {
      newAverageCost =
        (currentQuantity * currentAverageCost +
          input.quantityDelta * input.unitCost) /
        newQuantity;
    }

    // Update current stock level.
    await client.query(
      `UPDATE erp_stock_levels
       SET
         quantity = $3,
         average_cost = $4,
         updated_at = now()
       WHERE product_id = $1
         AND warehouse_id = $2`,
      [input.productId, input.warehouseId, newQuantity, newAverageCost],
    );

    // Insert immutable movement ledger record.
    //
    // IMPORTANT:
    // product_sku, product_name and warehouse_name are intentionally
    // denormalized here. They represent the identity snapshot associated
    // with this movement at the time it occurred.
    const movementResult = await client.query<StockMovement>(
      `INSERT INTO erp_stock_movements (
           ias_company_id,

           product_id,
           product_sku,
           product_name,

           warehouse_id,
           warehouse_name,

           quantity_delta,
           unit_cost,
           reason,

           reference_type,
           reference_id,

           notes,
           created_by
         )
         VALUES (
           $1,
           $2, $3, $4,
           $5, $6,
           $7, $8, $9,
           $10, $11,
           $12, $13
         )
         RETURNING
           id,

           product_id AS "productId",
           product_sku AS "productSku",
           product_name AS "productName",

           warehouse_id AS "warehouseId",
           warehouse_name AS "warehouseName",

           quantity_delta AS "quantityDelta",
           unit_cost AS "unitCost",
           reason,

           reference_type AS "referenceType",
           reference_id AS "referenceId",

           notes,
           created_by AS "createdBy",
           created_at AS "createdAt"`,
      [
        input.iasCompanyId,

        input.productId,
        input.productSku,
        input.productName,

        input.warehouseId,
        input.warehouseName,

        input.quantityDelta,
        input.unitCost ?? null,
        input.reason,

        input.referenceType ?? null,
        input.referenceId ?? null,

        input.notes ?? null,
        input.createdBy,
      ],
    );

    return movementResult.rows[0]!;
  },

  // ---------------------------------------------------------------------------
  // Adjust Stock
  // ---------------------------------------------------------------------------

  adjustStock: (input: {
    iasCompanyId: number;

    productId: number;
    productSku: string;
    productName: string;

    warehouseId: number;
    warehouseName: string;

    quantityDelta: number;
    unitCost?: number;

    reason: "RECEIVE" | "SALE" | "ADJUSTMENT";

    referenceType?: string;
    referenceId?: number;
    notes?: string;

    createdBy: number;
  }) =>
    withTransaction((client) =>
      inventoryRepository.applyMovement(client, input),
    ),

  // ---------------------------------------------------------------------------
  // Transfer Stock
  // ---------------------------------------------------------------------------

  // Transfers one product between two warehouses.
  //
  // The source movement gets the source warehouse name.
  // The destination movement gets the destination warehouse name.
  transferStock: (input: {
    iasCompanyId: number;
    productId: number;
    productSku: string;
    productName: string;
    fromWarehouseId: number;
    fromWarehouseName: string;
    toWarehouseId: number;
    toWarehouseName: string;
    quantity: number;
    notes?: string;
    createdBy: number;
  }) =>
    withTransaction(async (client) => {
      // Ensure source stock level exists.
      await client.query(
        `INSERT INTO erp_stock_levels (
           ias_company_id,
           product_id,
           product_sku,
           product_name,
           warehouse_id,
           warehouse_name
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (product_id, warehouse_id)
         DO NOTHING`,
        [
          input.iasCompanyId,
          input.productId,
          input.productSku,
          input.productName,
          input.fromWarehouseId,
          input.fromWarehouseName,
        ],
      );

      // Lock source stock level.
      const lockResult = await client.query<RawStockLevel>(
        `${SELECT_STOCK_LEVEL}
         WHERE product_id = $1
           AND warehouse_id = $2
         FOR UPDATE`,
        [input.productId, input.fromWarehouseId],
      );

      const source = lockResult.rows[0]!;

      const available =
        Number(source.quantity) - Number(source.reservedQuantity);

      if (available < input.quantity) {
        throw new Error(
          `Insufficient available stock: ${available} available ` +
            `(${source.quantity} on hand, ` +
            `${source.reservedQuantity} reserved), ` +
            `${input.quantity} requested`,
        );
      }

      // Transfer OUT.
      await inventoryRepository.applyMovement(client, {
        iasCompanyId: input.iasCompanyId,

        productId: input.productId,
        productSku: input.productSku,
        productName: input.productName,
        warehouseId: input.fromWarehouseId,
        warehouseName: input.fromWarehouseName,
        quantityDelta: -input.quantity,
        reason: "TRANSFER_OUT",
        referenceType: "transfer",
        notes: input.notes,
        createdBy: input.createdBy,
      });

      // Transfer IN.
      //
      // The source average cost becomes the destination cost basis
      // because a transfer does not create a new acquisition cost.
      await inventoryRepository.applyMovement(client, {
        iasCompanyId: input.iasCompanyId,
        productId: input.productId,
        productSku: input.productSku,
        productName: input.productName,
        warehouseId: input.toWarehouseId,
        warehouseName: input.toWarehouseName,
        quantityDelta: input.quantity,
        unitCost: Number(source.averageCost),
        reason: "TRANSFER_IN",
        referenceType: "transfer",
        notes: input.notes,
        createdBy: input.createdBy,
      });

      // Create transfer record.
      const transferResult = await client.query<StockTransfer>(
        `INSERT INTO erp_stock_transfers (
             ias_company_id,
             product_id,
             product_sku,
             product_name,
             from_warehouse_id,
             from_warehouse_name,
             to_warehouse_id,
             to_warehouse_name,
             quantity,
             created_by
           )
           VALUES ($1, $2, $3, $4, $5, $6 , $7, $8, $9, $10)
           RETURNING
             id,
             ias_company_id AS "iasCompanyId",
             product_id AS "productId",
             product_sku AS "productSku",
             product_name AS "productName",
             from_warehouse_id AS "fromWarehouseId",
             from_warehouse_name AS "fromWarehouseName",
             to_warehouse_id AS "toWarehouseId",
             to_warehouse_name AS "toWarehouseName",
             quantity,
             status,
             created_by AS "createdBy",
             created_at AS "createdAt"`,
        [
          input.iasCompanyId,
          input.productId,
          input.productSku,
          input.productName,
          input.fromWarehouseId,
          input.fromWarehouseName,
          input.toWarehouseId,
          input.toWarehouseName,
          input.quantity,
          input.createdBy,
        ],
      );

      return transferResult.rows[0]!;
    }),

  listStockTransfers: (iasCompanyId: number) =>
    query<StockTransfer>(
      `SELECT
         id,
         ias_company_id AS "iasCompanyId",
         product_id AS "productId",
         product_sku AS "productSku",
         product_name AS "productName",
         from_warehouse_id AS "fromWarehouseId",
         from_warehouse_name AS "fromWarehouseName",
         to_warehouse_id AS "toWarehouseId",
         to_warehouse_name AS "toWarehouseName",
         quantity,
         status,
         created_by AS "createdBy",
         created_at AS "createdAt"
       FROM erp_stock_transfers
       WHERE ias_company_id = $1
       ORDER BY created_at DESC`,
      [iasCompanyId],
    ),

  // ---------------------------------------------------------------------------
  // Stock Count
  // ---------------------------------------------------------------------------

  // Reconciles physical stock against the system quantity.
  //
  // The difference becomes a STOCK_COUNT movement.
  // Average cost remains unchanged.
  recordStockCount: (input: {
    iasCompanyId: number;
    productId: number;
    productSku: string;
    productName: string;
    warehouseId: number;
    warehouseName: string;
    countedQuantity: number;
    notes?: string;
    createdBy: number;
  }) =>
    withTransaction(async (client) => {
      await client.query(
        `INSERT INTO erp_stock_levels (
           ias_company_id,
           product_id,
           product_sku,
           product_name,
           warehouse_id,
            warehouse_name
         )
         VALUES ($1, $2, $3, $4, $5, $6)
         ON CONFLICT (product_id, warehouse_id)
         DO NOTHING`,
        [
          input.iasCompanyId,
          input.productId,
          input.productSku,
          input.productName,
          input.warehouseId,
          input.warehouseName,
        ],
      );

      const lockResult = await client.query<RawStockLevel>(
        `${SELECT_STOCK_LEVEL}
         WHERE product_id = $1
           AND warehouse_id = $2
         FOR UPDATE`,
        [input.productId, input.warehouseId],
      );
      const systemQuantity = Number(lockResult.rows[0]!.quantity);
      const variance = input.countedQuantity - systemQuantity;

      // No movement is required if the physical count
      // matches the system quantity.
      if (variance === 0) {
        return {
          systemQuantity,
          countedQuantity: input.countedQuantity,
          variance,
          movement: null,
        };
      }

      const movement = await inventoryRepository.applyMovement(client, {
        iasCompanyId: input.iasCompanyId,

        productId: input.productId,

        productSku: input.productSku,

        productName: input.productName,

        warehouseId: input.warehouseId,

        warehouseName: input.warehouseName,

        quantityDelta: variance,

        reason: "STOCK_COUNT",

        notes:
          input.notes ??
          `Physical count reconciliation ` + `(variance ${variance})`,

        createdBy: input.createdBy,
      });

      return {
        systemQuantity,
        countedQuantity: input.countedQuantity,
        variance,
        movement,
      };
    }),

  // ---------------------------------------------------------------------------
  // Reservations
  // ---------------------------------------------------------------------------

  // Reservations do not create stock movement ledger entries.
  // They only change reserved_quantity.
  reserveStock: (input: {
    productId: number;
    warehouseId: number;
    quantity: number;
  }) =>
    withTransaction(async (client) => {
      const lockResult = await client.query<RawStockLevel>(
        `${SELECT_STOCK_LEVEL}
         WHERE product_id = $1
           AND warehouse_id = $2
         FOR UPDATE`,
        [input.productId, input.warehouseId],
      );

      const row = lockResult.rows[0];

      const available = row
        ? Number(row.quantity) - Number(row.reservedQuantity)
        : 0;

      if (available < input.quantity) {
        throw new Error(
          `Insufficient available stock to reserve: ` +
            `${available} available`,
        );
      }

      await client.query(
        `UPDATE erp_stock_levels
         SET
           reserved_quantity =
             reserved_quantity + $3,
           updated_at = now()
         WHERE product_id = $1
           AND warehouse_id = $2`,
        [input.productId, input.warehouseId, input.quantity],
      );
    }),

  releaseReservation: (input: {
    productId: number;
    warehouseId: number;
    quantity: number;
  }) =>
    query(
      `UPDATE erp_stock_levels
       SET
         reserved_quantity =
           GREATEST(
             reserved_quantity - $3,
             0
           ),
         updated_at = now()
       WHERE product_id = $1
         AND warehouse_id = $2`,
      [input.productId, input.warehouseId, input.quantity],
    ),
};
