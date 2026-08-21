import axios from "axios";
import { env } from "../config/env.js";
import type { IasMeUser } from "../modules/auth/auth.types.js";

// NOT part of the auth path anymore — authenticate.ts verifies the JWT
// locally. This is only for the rarer case of needing display info the
// token doesn't carry (email, first/last name, full company record) —
// e.g. showing "prepared by Jane Doe" rather than just userId 42.
export async function fetchIasMeProfile(bearerToken: string): Promise<IasMeUser> {
  const response = await axios.get<{ success: boolean; message: string; data: IasMeUser }>(
    `${env.iasBaseUrl}${env.iasTokenVerifyPath}`,
    { headers: { Authorization: bearerToken } },
  );
  return response.data.data;
}
