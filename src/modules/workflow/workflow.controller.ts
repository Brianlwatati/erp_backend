import { asyncHandler } from "../../utils/asyncHandler.js";
import { ok, fail } from "../../utils/apiResponse.js";
import { z } from "zod";
import { workflowRepository as r } from "./workflow.repository.js";
const rule = z.object({
  name: z.string(),
  eventType: z.string(),
  thresholdAmount: z.number().nonnegative().optional(),
  actionType: z.string().optional(),
  targetUserId: z.number().int().optional(),
});
const reqs = z.object({
  module: z.string(),
  entityType: z.string(),
  entityId: z.number().int(),
  assignedTo: z.number().int().optional(),
  amount: z.number().nonnegative().optional(),
});
const notify = z.object({
  userId: z.number().int().optional(),
  type: z.string(),
  title: z.string(),
  message: z.string(),
  entityType: z.string().optional(),
  entityId: z.number().int().optional(),
});
export const workflowController = {
  notifications: asyncHandler(async (req, res) =>
    ok(res, await r.notifications(req.auth!.companyId, req.auth!.userId)),
  ),
  read: asyncHandler(async (req, res) => {
    const x = await r.read(
      Number(req.params.id),
      req.auth!.companyId,
      req.auth!.userId,
    );
    if (!x) return fail(res, "Notification not found", 404);
    ok(res, x);
  }),
  rules: asyncHandler(async (req, res) =>
    ok(res, await r.rules(req.auth!.companyId)),
  ),
  createRule: asyncHandler(async (req, res) => {
    const p = rule.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    ok(
      res,
      await r.createRule(req.auth!.companyId, req.auth!.userId, p.data),
      "Workflow rule created",
      201,
    );
  }),
  notify: asyncHandler(async (req, res) => {
    const p = notify.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    ok(
      res,
      await r.notify(req.auth!.companyId, p.data.userId ?? 0, p.data),
      "Notification created",
      201,
    );
  }),
  approvals: asyncHandler(async (req, res) =>
    ok(res, await r.approvals(req.auth!.companyId)),
  ),
  request: asyncHandler(async (req, res) => {
    const p = reqs.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    ok(
      res,
      await r.request(req.auth!.companyId, req.auth!.userId, p.data),
      "Approval requested",
      201,
    );
  }),
  decide: asyncHandler(async (req, res) => {
    const status =
      req.body.status === "APPROVED"
        ? "APPROVED"
        : req.body.status === "REJECTED"
          ? "REJECTED"
          : null;
    if (!status) return fail(res, "status must be APPROVED or REJECTED", 422);
    const x = await r.decide(
      Number(req.params.id),
      req.auth!.companyId,
      req.auth!.userId,
      status,
    );
    if (!x) return fail(res, "Approval not found or already decided", 409);
    ok(res, x, "Approval decided");
  }),
};
