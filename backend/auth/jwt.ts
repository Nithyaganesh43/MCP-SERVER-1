import jwt, { type JwtPayload, type SignOptions } from "jsonwebtoken";
import { HttpError } from "../errors";

export type JwtClaims = {
  sub: string;
  email: string;
  name: string;
};

export function signJwt(claims: JwtClaims, secret: string, expiresIn: string): string {
  return jwt.sign(claims, secret, { expiresIn: expiresIn as SignOptions["expiresIn"] });
}

export function verifyJwt(token: string, secret: string): JwtClaims {
  let decoded: string | JwtPayload;
  try {
    decoded = jwt.verify(token, secret);
  } catch {
    throw new HttpError(401, "Unauthorized");
  }
  if (
    typeof decoded === "string" ||
    typeof decoded.sub !== "string" ||
    decoded.sub === "" ||
    typeof decoded.email !== "string" ||
    typeof decoded.name !== "string"
  ) {
    throw new HttpError(401, "Unauthorized");
  }
  return {
    sub: decoded.sub,
    email: decoded.email,
    name: decoded.name,
  };
}
