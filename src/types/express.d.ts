import type { AccessTokenUser } from "../modules/auth/auth.types.js";

declare global {
  namespace Express {
    interface Request {
      // Set by `authenticate` from the verified JWT. Absent on public
      // routes / provisioning webhooks, which use their own signature
      // check instead. Named `auth` to match IAS's own req.auth
      // convention — same shape, same field, both services.
      auth?: AccessTokenUser;
    }
  }
}

export {};
