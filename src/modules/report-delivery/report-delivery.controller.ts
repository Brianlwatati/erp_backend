import type { Request, Response } from "express";
import { z } from "zod";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { reportDeliveryRepository as r } from "./report-delivery.repository.js";

function companyId(req: Request): number {
  return req.auth!.companyId;
}

const subscription = z
  .object({
    channel: z.enum(["EMAIL", "WHATSAPP"]),
    frequency: z.enum(["DAILY", "WEEKLY"]),
    dayOfWeek: z.number().int().min(0).max(6).optional(),
    timeOfDay: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Expected HH:MM"),
    recipient: z.string().min(3),
  })
  .refine((v) => v.frequency === "DAILY" || v.dayOfWeek !== undefined, {
    message: "dayOfWeek is required for weekly subscriptions",
    path: ["dayOfWeek"],
  })
  .refine(
    (v) =>
      v.channel !== "EMAIL" ||
      z.string().email().safeParse(v.recipient).success,
    {
      message: "recipient must be a valid email for the EMAIL channel",
      path: ["recipient"],
    },
  )
  .refine(
    // OpenWA expects a bare phone number (country code + number, no "+" or
    // spaces) that it turns into a chatId — reject anything else early
    // rather than letting a malformed number fail silently at send time.
    (v) => v.channel !== "WHATSAPP" || /^\+?[1-9]\d{7,14}$/.test(v.recipient),
    {
      message:
        "recipient must be a phone number in international format for WHATSAPP",
      path: ["recipient"],
    },
  );

const patch = z.object({
  frequency: z.enum(["DAILY", "WEEKLY"]).optional(),
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  timeOfDay: z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .optional(),
  recipient: z.string().min(3).optional(),
  enabled: z.boolean().optional(),
});

export const reportDeliveryController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    ok(res, await r.list(companyId(req)));
  }),

  snapshot: asyncHandler(async (req: Request, res: Response) => {
    const parsed = z
      .object({
        periodType: z.enum(["DAILY", "WEEKLY"]).optional(),
      })
      .safeParse({ periodType: req.query.periodType });

    if (!parsed.success) {
      return fail(res, "Invalid query", 422, parsed.error.flatten());
    }

    const snapshot = await r.latestSnapshotByQuery(
      companyId(req),
      parsed.data.periodType,
    );

    if (!snapshot) {
      return fail(res, "Snapshot not found", 404);
    }

    ok(res, snapshot);
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const parsed = subscription.safeParse(req.body);
    if (!parsed.success)
      return fail(res, "Invalid input", 422, parsed.error.flatten());
    const created = await r.create(
      companyId(req),
      req.auth!.userId,
      parsed.data,
    );
    ok(res, created, "Subscription created", 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const parsed = patch.safeParse(req.body);
    if (!parsed.success)
      return fail(res, "Invalid input", 422, parsed.error.flatten());
    const updated = await r.update(
      Number(req.params.id),
      companyId(req),
      parsed.data,
    );
    if (!updated) return fail(res, "Subscription not found", 404);
    ok(res, updated);
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await r.remove(Number(req.params.id), companyId(req));
    ok(res, null, "Subscription deleted");
  }),

  sendLogs: asyncHandler(async (req: Request, res: Response) => {
    ok(
      res,
      await r.sendLogsForSubscription(Number(req.params.id), companyId(req)),
    );
  }),
};
