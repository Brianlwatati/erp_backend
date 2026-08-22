import { Router } from "express";
import { inventoryController } from "./inventory.controller.js";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";

const router = Router();

router.use(authenticate);

// Warehouses
router.get(
  "/warehouses",
  authorize("inventory", "view"),
  inventoryController.listWarehouses,
);
router.post(
  "/warehouses",
  authorize("inventory", "manage_warehouses"),
  inventoryController.createWarehouse,
);

// Products
router.get(
  "/products",
  authorize("inventory", "view"),
  inventoryController.listProducts,
);
router.get(
  "/products/:id",
  authorize("inventory", "view"),
  inventoryController.getProduct,
);
router.post(
  "/products",
  authorize("inventory", "manage_products"),
  inventoryController.createProduct,
);
router.patch(
  "/products/:id",
  authorize("inventory", "manage_products"),
  inventoryController.updateProduct,
);
router.post(
  "/products/:id/archive",
  authorize("inventory", "manage_products"),
  inventoryController.archiveProduct,
);

// Stock
router.get(
  "/stock/low",
  authorize("inventory", "view"),
  inventoryController.getLowStockItems,
);
router.get(
  "/stock",
  authorize("inventory", "view"),
  inventoryController.listStockLevels,
);
router.get(
  "/stock/valuation",
  authorize("inventory", "view"),
  inventoryController.getStockValuation,
);
router.get(
  "/products/:id/movements",
  authorize("inventory", "view"),
  inventoryController.listMovements,
);

router.get(
  "/stock/movements",
  authorize("inventory", "view"),
  inventoryController.listAllMovements,
);

router.post(
  "/stock/adjust",
  authorize("inventory", "adjust_stock"),
  inventoryController.adjustStock,
);

router.get(
  "/stock/transfers",
  authorize("inventory", "view"),
  inventoryController.listStockTransfers,
);

router.post(
  "/stock/transfers",
  authorize("inventory", "transfer_stock"),
  inventoryController.transferStock,
);
router.post(
  "/stock/count",
  authorize("inventory", "record_stock_count"),
  inventoryController.recordStockCount,
);

export default router;
