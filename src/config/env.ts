import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const env = {
  port: Number(process.env.PORT ?? 4100),
  nodeEnv: process.env.NODE_ENV ?? "development",
  databaseUrl: required("DATABASE_URL"),
  iasBaseUrl: required("IAS_BASE_URL").replace(/\/$/, ""),
  iasTokenVerifyPath: process.env.IAS_TOKEN_VERIFY_PATH ?? "/api/v1/auth/me",
  iasProductCode: process.env.IAS_PRODUCT_CODE ?? "ERP",
  iasWebhookSecret: required("IAS_WEBHOOK_SECRET"),

  // Same signing secret as IAS — lets this service verify access tokens
  // locally instead of calling out to /auth/me on every request.
  jwtAccessSecret: required("JWT_ACCESS_SECRET"),
  jwtIssuer: process.env.JWT_ISSUER ?? "auth-service",
  jwtAudience: process.env.JWT_AUDIENCE ?? "auth-api",
  // Not used for verification (the token's own `exp` claim already governs
  // that) — kept here only so this service's .env mirrors IAS's for anyone
  // diffing the two configs.
  jwtAccessExpiresIn: process.env.JWT_ACCESS_EXPIRES_IN ?? "15m",
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? "7d",
};
