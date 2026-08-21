import type { NextFunction, Request, Response } from "express";

// Express 5 auto-forwards rejected promises from async route handlers to the
// error middleware, but wrapping explicitly keeps this working even if the
// app is ever downgraded, and makes the intent obvious at each call site.
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
