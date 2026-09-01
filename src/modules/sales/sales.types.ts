export interface SalesOrderItem {
  id: number;
  salesOrderId: number;
  productId: number;
  sku: string;
  name: string;
  warehouseId: number;
  warehouseName: string;
  quantity: number;
  unitPrice: number;
  discountAmount: number;
  taxRate: number;
  lineTotal: number;
}
