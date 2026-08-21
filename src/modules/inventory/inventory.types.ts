export type ProductStatus = "ACTIVE" | "ARCHIVED";
export type WarehouseStatus = "ACTIVE" | "INACTIVE";

export interface Warehouse {
  id: number;
  iasCompanyId: number;
  code: string;
  name: string;
  location: string | null;
  status: WarehouseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Product {
  id: number;
  iasCompanyId: number;
  sku: string;
  name: string;
  description: string | null;
  unit: string;
  category: string | null;
  costPrice: string;   // NUMERIC comes back from pg as string — cast at the edges, not in the DB layer
  sellPrice: string;
  reorderLevel: string;
  status: ProductStatus;
  createdAt: string;
  updatedAt: string;
}

export interface StockLevel {
  productId: number;
  warehouseId: number;
  quantity: string;
  reservedQuantity: string;
  averageCost: string;
  updatedAt: string;
}

export type StockMovementReason =
  | "RECEIVE"
  | "SALE"
  | "ADJUSTMENT"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "STOCK_COUNT";

export interface StockMovement {
  id: number;
  productId: number;
  warehouseId: number;
  quantityDelta: string;
  unitCost: string | null;
  reason: StockMovementReason;
  referenceType: string | null;
  referenceId: number | null;
  notes: string | null;
  createdBy: number;
  createdAt: string;
}

export interface StockTransfer {
  id: number;
  iasCompanyId: number;
  productId: number;
  fromWarehouseId: number;
  toWarehouseId: number;
  quantity: string;
  status: "COMPLETED" | "PENDING";
  createdBy: number;
  createdAt: string;
}

// Product joined with its stock across every warehouse — the shape
// getLowStockItems() and product-detail views actually want.
export interface ProductWithStock extends Product {
  stockByWarehouse: Array<{
    warehouseId: number;
    quantity: string;
    reservedQuantity: string;
    availableQuantity: string; // quantity - reservedQuantity, computed at the service layer
  }>;
  totalQuantity: string;
  totalAvailable: string;
}

export interface StockValuationRow {
  productId: number;
  sku: string;
  name: string;
  totalQuantity: string;
  averageCost: string;   // weighted average across warehouses, not just cost_price
  valuation: string;      // totalQuantity * averageCost
}

// A single product-in-a-warehouse row, joined with just enough product and
// warehouse identity to be readable on its own — the shape for browsing
// stock (GET /inventory/stock), as opposed to ProductWithStock's "one
// product, every warehouse it's in" shape from GET /inventory/products/:id.
export interface StockLevelWithDetails {
  productId: number;
  sku: string;
  productName: string;
  warehouseId: number;
  warehouseCode: string;
  warehouseName: string;
  quantity: string;
  reservedQuantity: string;
  availableQuantity: string; // quantity - reservedQuantity, computed at the service layer
  averageCost: string;
  updatedAt: string;
}
