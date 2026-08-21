import type { NextFunction, Request, Response } from "express";
import { env } from "../../config/env.js";
import { fail } from "../../utils/apiResponse.js";

// Provisioning webhooks come from IAS itself, not a logged-in user, so they
// can't go through `authenticate`. A shared secret is enough here since
// this is a trusted service-to-service call, not a public endpoint —
// tighten to HMAC-signed payloads if this ever needs to cross a public
// network boundary.
export function verifyWebhookSecret(req: Request, res: Response, next: NextFunction) {
  const provided = req.headers["x-ias-webhook-secret"];
  if (provided !== env.iasWebhookSecret) {
    return fail(res, "Invalid webhook secret", 401);
  }
  next();
}
