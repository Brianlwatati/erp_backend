// Mirrors ias_backend's own AccessTokenPayload/AccessTokenUser exactly —
// this is the JWT contract shared between the two services. Keep this file
// in sync with IAS's copy if the token shape ever changes.

export interface AccessTokenPayload {
  sub: string;
  roleName: string;
  companyId: string;
  roleCode: string;
  roleScope: string;
  roleScopeKey: string;
}

export interface AccessTokenUser {
  userId: number;
  companyId: number;
  roleName: string;
  roleCode: string;
  roleScope: string;
  roleScopeKey: string;
}

// Richer profile shape from IAS's /auth/me — NOT part of the JWT (the token
// is deliberately minimal), so this requires an actual network call. Used
// only where display info (email, name, company details) is genuinely
// needed, e.g. showing "prepared by" on a document — never on the hot
// request-auth path, which uses the JWT alone.
export interface IasMeUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roleId: string;
  roleName: string;
  roleCode: string;
  roleScope: string;
  roleScopeKey: string;
  companyId: string;
  company: {
    id: number;
    name: string;
    code: string;
    email: string;
    phone: string;
    status: string;
    createdAt: string;
    updatedAt: string;
  };
  isActive: boolean;
}
