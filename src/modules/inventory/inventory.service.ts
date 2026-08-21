import { inventoryRepository } from "./inventory.repository.js";
import type {
  CreateWarehouseInput,
  CreateProductInput,
  UpdateProductInput,
  AdjustStockInput,
  TransferStockInput,
  RecordStockCountInput,
} from "./inventory.validation.js";

class NotFoundError extends Error {}
class ConflictError extends Error {}

export const inventoryService = {
  // ---- Warehouses ----
  listWarehouses: (iasCompanyId: number) => inventoryRepository.listWarehouses(iasCompanyId),

  createWarehouse: async (iasCompanyId: number, input: CreateWarehouseInput) => {
    try {
      return await inventoryRepository.createWarehouse(iasCompanyId, input);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(`Warehouse code "${input.code}" already exists`);
      }
      throw error;
    }
  },

  getWarehouseOrThrow: async (id: number, iasCompanyId: number) => {
    const warehouse = await inventoryRepository.findWarehouseById(id, iasCompanyId);
    if (!warehouse) throw new NotFoundError("Warehouse not found");
    return warehouse;
  },

  // ---- Products ----
  listProducts: (iasCompanyId: number, status?: "ACTIVE" | "ARCHIVED") =>
    inventoryRepository.listProducts(iasCompanyId, status),

  getProduct: async (id: number, iasCompanyId: number) => {
    const product = await inventoryRepository.findProductById(id, iasCompanyId);
    if (!product) throw new NotFoundError("Product not found");

    const stockByWarehouse = await inventoryRepository.getStockByWarehouse(id);
    const withAvailability = stockByWarehouse.map((row) => ({
      ...row,
      availableQuantity: (Number(row.quantity) - Number(row.reservedQuantity)).toString(),
    }));
    const totalQuantity = stockByWarehouse
      .reduce((sum, row) => sum + Number(row.quantity), 0)
      .toString();
    const totalAvailable = withAvailability
      .reduce((sum, row) => sum + Number(row.availableQuantity), 0)
      .toString();

    return { ...product, stockByWarehouse: withAvailability, totalQuantity, totalAvailable };
  },

  // addProduct
  createProduct: async (iasCompanyId: number, input: CreateProductInput) => {
    try {
      return await inventoryRepository.createProduct(iasCompanyId, input);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictError(`SKU "${input.sku}" already exists`);
      }
      throw error;
    }
  },

  // updateProduct
  updateProduct: async (id: number, iasCompanyId: number, input: UpdateProductInput) => {
    const updated = await inventoryRepository.updateProduct(id, iasCompanyId, input);
    if (!updated) throw new NotFoundError("Product not found");
    return updated;
  },

  // archiveProduct — soft delete; stock history and movements are preserved
  archiveProduct: async (id: number, iasCompanyId: number) => {
    const archived = await inventoryRepository.updateProduct(id, iasCompanyId, {
      status: "ARCHIVED",
    });
    if (!archived) throw new NotFoundError("Product not found");
    return archived;
  },

  // ---- Stock ----
  getLowStockItems: (iasCompanyId: number, warehouseId?: number) =>
    inventoryRepository.getLowStockItems(iasCompanyId, warehouseId),

  // Product + stock level per warehouse, browsable and filterable —
  // GET /inventory/stock.
  listStockLevels: (iasCompanyId: number, filters: { productId?: number; warehouseId?: number }) =>
    inventoryRepository.listStockLevels(iasCompanyId, filters),

  getStockValuation: (iasCompanyId: number) =>
    inventoryRepository.getStockValuation(iasCompanyId),

  listMovements: async (productId: number, iasCompanyId: number, warehouseId?: number) => {
    await inventoryService.getProductOrThrow(productId, iasCompanyId);
    return inventoryRepository.listMovements(productId, warehouseId);
  },

  // adjustStockLevel(productId, quantity, reason)
  adjustStock: async (
    iasCompanyId: number,
    input: AdjustStockInput,
    createdBy: number,
  ) => {
    await inventoryService.getProductOrThrow(input.productId, iasCompanyId);
    await inventoryService.getWarehouseOrThrow(input.warehouseId, iasCompanyId);

    if (input.quantityDelta < 0) {
      const current = await inventoryRepository.getStockLevel(
        input.productId,
        input.warehouseId,
      );
      const available = Number(current.quantity) - Number(current.reservedQuantity);
      if (available + input.quantityDelta < 0) {
        throw new ConflictError(
          `Adjustment would take available stock negative (available: ${available}, on hand: ${current.quantity}, reserved: ${current.reservedQuantity})`,
        );
      }
    }

    return inventoryRepository.adjustStock({ ...input, iasCompanyId, createdBy });
  },

  // transferStock(fromWarehouse, toWarehouse, items) — single item per
  // call at the repository level; loop here for a multi-item transfer so
  // each item's insufficient-stock failure doesn't roll back items already
  // confirmed available (each item is its own transaction).
  transferStock: async (
    iasCompanyId: number,
    input: TransferStockInput,
    createdBy: number,
  ) => {
    await inventoryService.getProductOrThrow(input.productId, iasCompanyId);
    await inventoryService.getWarehouseOrThrow(input.fromWarehouseId, iasCompanyId);
    await inventoryService.getWarehouseOrThrow(input.toWarehouseId, iasCompanyId);
    return inventoryRepository.transferStock({ ...input, iasCompanyId, createdBy });
  },

  // recordStockCount
  recordStockCount: async (
    iasCompanyId: number,
    input: RecordStockCountInput,
    createdBy: number,
  ) => {
    await inventoryService.getProductOrThrow(input.productId, iasCompanyId);
    await inventoryService.getWarehouseOrThrow(input.warehouseId, iasCompanyId);
    return inventoryRepository.recordStockCount({ ...input, iasCompanyId, createdBy });
  },

  // Shared guards used by every stock-mutation method above so a bad
  // productId/warehouseId fails with a clean 404 instead of an FK
  // violation surfacing from erp_stock_movements.
  getProductOrThrow: async (productId: number, iasCompanyId: number) => {
    const product = await inventoryRepository.findProductById(productId, iasCompanyId);
    if (!product) throw new NotFoundError("Product not found");
    return product;
  },
};

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "23505"
  );
}

export { NotFoundError, ConflictError };
