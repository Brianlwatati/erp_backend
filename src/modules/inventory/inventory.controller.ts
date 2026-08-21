import type { Request, Response } from "express";
import { inventoryService, NotFoundError, ConflictError } from "./inventory.service.js";
import {
  createWarehouseSchema,
  createProductSchema,
  updateProductSchema,
  adjustStockSchema,
  transferStockSchema,
  recordStockCountSchema,
  lowStockQuerySchema,
  stockLevelsQuerySchema,
} from "./inventory.validation.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";

function companyId(req: Request): number {
  return req.auth!.companyId;
}

function userId(req: Request): number {
  return req.auth!.userId;
}

// Every route below funnels domain errors through this, so NotFoundError /
// ConflictError from the service become the right HTTP status without each
// handler repeating its own try/catch.
async function handleServiceCall<T>(
  res: Response,
  fn: () => Promise<T>,
  successMessage?: string,
  successStatus = 200,
) {
  try {
    const result = await fn();
    ok(res, result, successMessage, successStatus);
  } catch (error) {
    if (error instanceof NotFoundError) return fail(res, error.message, 404);
    if (error instanceof ConflictError) return fail(res, error.message, 409);
    throw error;
  }
}

export const inventoryController = {
  // ---- Warehouses ----
  listWarehouses: asyncHandler(async (req: Request, res: Response) => {
    const warehouses = await inventoryService.listWarehouses(companyId(req));
    ok(res, warehouses);
  }),

  createWarehouse: asyncHandler(async (req: Request, res: Response) => {
    const parsed = createWarehouseSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid input", 422, parsed.error.flatten());
    await handleServiceCall(
      res,
      () => inventoryService.createWarehouse(companyId(req), parsed.data),
      "Warehouse created",
      201,
    );
  }),

  // ---- Products ----
  listProducts: asyncHandler(async (req: Request, res: Response) => {
    const status = req.query.status as "ACTIVE" | "ARCHIVED" | undefined;
    const products = await inventoryService.listProducts(companyId(req), status);
    ok(res, products);
  }),

  getProduct: asyncHandler(async (req: Request, res: Response) => {
    await handleServiceCall(res, () =>
      inventoryService.getProduct(Number(req.params.id), companyId(req)),
    );
  }),

  createProduct: asyncHandler(async (req: Request, res: Response) => {
    const parsed = createProductSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid input", 422, parsed.error.flatten());
    await handleServiceCall(
      res,
      () => inventoryService.createProduct(companyId(req), parsed.data),
      "Product created",
      201,
    );
  }),

  updateProduct: asyncHandler(async (req: Request, res: Response) => {
    const parsed = updateProductSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid input", 422, parsed.error.flatten());
    await handleServiceCall(
      res,
      () => inventoryService.updateProduct(Number(req.params.id), companyId(req), parsed.data),
      "Product updated",
    );
  }),

  archiveProduct: asyncHandler(async (req: Request, res: Response) => {
    await handleServiceCall(
      res,
      () => inventoryService.archiveProduct(Number(req.params.id), companyId(req)),
      "Product archived",
    );
  }),

  // ---- Stock ----
  getLowStockItems: asyncHandler(async (req: Request, res: Response) => {
    const parsed = lowStockQuerySchema.safeParse(req.query);
    if (!parsed.success) return fail(res, "Invalid query", 422, parsed.error.flatten());
    const items = await inventoryService.getLowStockItems(companyId(req), parsed.data.warehouseId);
    ok(res, items);
  }),

  // GET /inventory/stock?productId=&warehouseId= — view product + stock
  // level per warehouse. Both filters optional: no filters browses every
  // product×warehouse combination for the company; either filter narrows
  // it (e.g. warehouseId alone = "everything in this warehouse").
  listStockLevels: asyncHandler(async (req: Request, res: Response) => {
    const parsed = stockLevelsQuerySchema.safeParse(req.query);
    if (!parsed.success) return fail(res, "Invalid query", 422, parsed.error.flatten());
    const levels = await inventoryService.listStockLevels(companyId(req), parsed.data);
    ok(res, levels);
  }),

  getStockValuation: asyncHandler(async (req: Request, res: Response) => {
    const valuation = await inventoryService.getStockValuation(companyId(req));
    ok(res, valuation);
  }),

  listMovements: asyncHandler(async (req: Request, res: Response) => {
    const warehouseId = req.query.warehouseId ? Number(req.query.warehouseId) : undefined;
    await handleServiceCall(res, () =>
      inventoryService.listMovements(Number(req.params.id), companyId(req), warehouseId),
    );
  }),

  adjustStock: asyncHandler(async (req: Request, res: Response) => {
    const parsed = adjustStockSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid input", 422, parsed.error.flatten());
    await handleServiceCall(
      res,
      () => inventoryService.adjustStock(companyId(req), parsed.data, userId(req)),
      "Stock adjusted",
      201,
    );
  }),

  transferStock: asyncHandler(async (req: Request, res: Response) => {
    const parsed = transferStockSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid input", 422, parsed.error.flatten());
    await handleServiceCall(
      res,
      () => inventoryService.transferStock(companyId(req), parsed.data, userId(req)),
      "Stock transferred",
      201,
    );
  }),

  recordStockCount: asyncHandler(async (req: Request, res: Response) => {
    const parsed = recordStockCountSchema.safeParse(req.body);
    if (!parsed.success) return fail(res, "Invalid input", 422, parsed.error.flatten());
    await handleServiceCall(
      res,
      () => inventoryService.recordStockCount(companyId(req), parsed.data, userId(req)),
      "Stock count recorded",
      201,
    );
  }),
};
