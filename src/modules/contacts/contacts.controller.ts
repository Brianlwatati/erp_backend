import type { Request, Response } from "express";
import { ok, fail } from "../../utils/apiResponse.js";
import { asyncHandler } from "../../utils/asyncHandler.js";
import { contactsRepository as r } from "./contacts.repository.js";
import { z } from "zod";
const contact = z.object({
  contactType: z.enum(["CUSTOMER", "SUPPLIER", "BOTH"]),
  name: z.string().min(1),
  phone: z.string().optional(),
  email: z.string().email().optional(),
  address: z.string().optional(),
  taxId: z.string().optional(),
  creditLimit: z.number().nonnegative().optional(),
});
const patch = contact.partial().omit({ contactType: true });
const interaction = z.object({
  interactionType: z.string().min(1),
  notes: z.string().optional(),
});
export const contactsController = {
  list: asyncHandler(async (req, res) =>
    ok(
      res,
      await r.list(
        req.auth!.companyId,
        typeof req.query.type === "string" ? req.query.type : undefined,
      ),
    ),
  ),
  create: asyncHandler(async (req, res) => {
    const p = contact.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    ok(
      res,
      await r.create(req.auth!.companyId, p.data),
      "Contact created",
      201,
    );
  }),
  update: asyncHandler(async (req, res) => {
    const p = patch.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    const x = await r.update(
      Number(req.params.id),
      req.auth!.companyId,
      p.data,
    );
    if (!x) return fail(res, "Contact not found", 404);
    ok(res, x);
  }),
  history: asyncHandler(async (req, res) =>
    ok(res, await r.history(Number(req.params.id), req.auth!.companyId)),
  ),
  interaction: asyncHandler(async (req, res) => {
    const p = interaction.safeParse(req.body);
    if (!p.success) return fail(res, "Invalid input", 422, p.error.flatten());
    ok(
      res,
      await r.interaction(
        req.auth!.companyId,
        Number(req.params.id),
        req.auth!.userId,
        p.data,
      ),
      "Interaction logged",
      201,
    );
  }),
};
