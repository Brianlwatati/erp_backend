import { z } from "zod";

export const createWarehouseSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
  name: z.string().min(2),
  location: z.string().max(255).optional(),
});

export const createProductSchema = z.object({
  sku: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[A-Za-z0-9_-]+$/, "Letters, numbers, - and _ only"),
  name: z.string().min(2),
  description: z.string().optional(),
  unit: z.string().min(1).max(50).default("pcs"),
  category: z.string().max(100).optional(),
  costPrice: z.number().nonnegative().default(0),
  sellPrice: z.number().nonnegative().default(0),
  reorderLevel: z.number().nonnegative().default(0),
});

export const updateProductSchema = z.object({
  name: z.string().min(2).optional(),
  description: z.string().optional(),
  unit: z.string().min(1).max(50).optional(),
  category: z.string().max(100).optional(),
  costPrice: z.number().nonnegative().optional(),
  sellPrice: z.number().nonnegative().optional(),
  reorderLevel: z.number().nonnegative().optional(),
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
});

export const adjustStockSchema = z.object({
  productId: z.number().int().positive(),
  warehouseId: z.number().int().positive(),
  quantityDelta: z.number().refine((n) => n !== 0, "quantityDelta cannot be 0"),
  reason: z.enum(["RECEIVE", "SALE", "ADJUSTMENT"]),
  // Required for RECEIVE — drives the weighted-average cost recompute.
  // Ignored for SALE/ADJUSTMENT, which don't change the cost basis.
  unitCost: z.number().nonnegative().optional(),
  referenceType: z.string().optional(),
  referenceId: z.number().int().positive().optional(),
  notes: z.string().optional(),
}).refine((v) => v.reason !== "RECEIVE" || v.unitCost !== undefined, {
  message: "unitCost is required for RECEIVE",
  path: ["unitCost"],
});

export const transferStockSchema = z.object({
  productId: z.number().int().positive(),
  fromWarehouseId: z.number().int().positive(),
  toWarehouseId: z.number().int().positive(),
  quantity: z.number().positive(),
  notes: z.string().optional(),
}).refine((v) => v.fromWarehouseId !== v.toWarehouseId, {
  message: "fromWarehouseId and toWarehouseId must differ",
  path: ["toWarehouseId"],
});

export const recordStockCountSchema = z.object({
  productId: z.number().int().positive(),
  warehouseId: z.number().int().positive(),
  countedQuantity: z.number().nonnegative(),
  notes: z.string().optional(),
});

export const lowStockQuerySchema = z.object({
  warehouseId: z.coerce.number().int().positive().optional(),
});

export const stockLevelsQuerySchema = z.object({
  productId: z.coerce.number().int().positive().optional(),
  warehouseId: z.coerce.number().int().positive().optional(),
});

export type CreateWarehouseInput = z.infer<typeof createWarehouseSchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type TransferStockInput = z.infer<typeof transferStockSchema>;
export type RecordStockCountInput = z.infer<typeof recordStockCountSchema>;
export type StockLevelsQuery = z.infer<typeof stockLevelsQuerySchema>;
