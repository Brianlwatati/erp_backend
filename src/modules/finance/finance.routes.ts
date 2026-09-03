import { Router } from "express";
import { authenticate } from "../../middleware/authenticate.js";
import { authorize } from "../../middleware/authorize.js";
import { financeController as c } from "./finance.controller.js";
const r = Router();
r.use(authenticate);
r.get("/invoices", authorize("finance", "view"), c.invoices);
r.get("/invoices/:id", authorize("finance", "view"), c.invoice);
r.post(
  "/invoices/from-order/:orderId",
  authorize("sales", "create_invoice"),
  c.fromOrder,
);
r.get("/receivables", authorize("finance", "view_reports"), c.ar);
r.post("/payments", authorize("finance", "post_payment"), c.payment);
r.get("/supplier-bills", authorize("finance", "view_reports"), c.supplierBills);
r.get("/payables", authorize("finance", "view_reports"), c.ap);
r.post(
  "/supplier-bills/from-order/:orderId",
  authorize("finance", "manage_payables"),
  c.supplierBillFromOrder,
);
r.post(
  "/supplier-payments",
  authorize("finance", "post_supplier_payment"),
  c.supplierPayment,
);
r.post("/journal-entries", authorize("finance", "post_journal"), c.journal);
export default r;
