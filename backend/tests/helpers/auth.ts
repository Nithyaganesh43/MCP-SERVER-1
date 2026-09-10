import jwt from "jsonwebtoken";
import { signJwt } from "../../auth/jwt";
import { OTHER_USER_ID_HEX, TEST_GOOGLE_PROFILE, TEST_USER_ID_HEX } from "./seed";

export const TEST_JWT_SECRET = "test-jwt-secret-rytham-v1-auth-lock";
export const TEST_GOOGLE_CLIENT_ID = "test-google-client-id";
export const TEST_GOOGLE_CLIENT_SECRET = "test-google-client-secret";
export const TEST_GOOGLE_CALLBACK_URL = "http://localhost:3000/auth/google/callback";

export function validJwt(): string {
  return signJwt(
    {
      sub: TEST_USER_ID_HEX,
      email: TEST_GOOGLE_PROFILE.email,
      name: TEST_GOOGLE_PROFILE.name,
    },
    TEST_JWT_SECRET,
    "7d",
  );
}

export function expiredJwt(): string {
  return jwt.sign(
    {
      sub: TEST_USER_ID_HEX,
      email: TEST_GOOGLE_PROFILE.email,
      name: TEST_GOOGLE_PROFILE.name,
      exp: Math.floor(Date.now() / 1000) - 10,
    },
    TEST_JWT_SECRET,
  );
}

export function invalidJwt(): string {
  return "not-a-valid-jwt";
}

export function authHeader(token = validJwt()): { Authorization: string } {
  return { Authorization: `Bearer ${token}` };
}

export function otherUserJwt(): string {
  return signJwt(
    {
      sub: OTHER_USER_ID_HEX,
      email: "user_test_002@gmail.com",
      name: "Other User",
    },
    TEST_JWT_SECRET,
    "7d",
  );
}
