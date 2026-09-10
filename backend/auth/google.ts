import type { Config } from "../config";
import { HttpError } from "../errors";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";
const GOOGLE_USERINFO_URL = "https://www.googleapis.com/oauth2/v3/userinfo";

export type GoogleProfile = {
  googleId: string;
  email: string;
  name: string;
  picture: string;
};

export function googleAuthUrl(config: Config): string {
  const params = new URLSearchParams({
    client_id: config.googleClientId,
    redirect_uri: config.googleCallbackUrl,
    response_type: "code",
    scope: "openid email profile",
  });
  return `${GOOGLE_AUTH_URL}?${params.toString()}`;
}

export async function exchangeGoogleCode(code: string, config: Config): Promise<GoogleProfile> {
  const body = new URLSearchParams({
    code,
    client_id: config.googleClientId,
    client_secret: config.googleClientSecret,
    redirect_uri: config.googleCallbackUrl,
    grant_type: "authorization_code",
  });
  const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  const tokenJson: unknown = await tokenRes.json();
  if (!tokenRes.ok || !isRecord(tokenJson) || typeof tokenJson.access_token !== "string") {
    throw new HttpError(401, "Unauthorized");
  }
  const userRes = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${tokenJson.access_token}` },
  });
  const profileJson: unknown = await userRes.json();
  if (!userRes.ok || !isRecord(profileJson)) {
    throw new HttpError(401, "Unauthorized");
  }
  const googleId = typeof profileJson.sub === "string" ? profileJson.sub : "";
  const email = typeof profileJson.email === "string" ? profileJson.email : "";
  const name = typeof profileJson.name === "string" ? profileJson.name : "";
  const picture = typeof profileJson.picture === "string" ? profileJson.picture : "";
  if (googleId === "" || email === "" || name === "") {
    throw new HttpError(401, "Unauthorized");
  }
  return { googleId, email, name, picture };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
