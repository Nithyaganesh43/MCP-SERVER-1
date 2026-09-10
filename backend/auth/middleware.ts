import type { NextFunction, Request, Response } from "express";
import type { Config } from "../config";
import { HttpError } from "../errors";
import { verifyJwt, type JwtClaims } from "./jwt";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
};

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthUser;
  }
}

export function requireAuth(
  config: Config,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, _res, next) => {
    try {
      const claims = claimsFromHeader(req.headers.authorization, config.jwtSecret);
      req.user = { id: claims.sub, email: claims.email, name: claims.name };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export function claimsFromHeader(header: string | undefined, secret: string): JwtClaims {
  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    throw new HttpError(401, "Unauthorized");
  }
  const token = header.slice("Bearer ".length).trim();
  if (token === "") {
    throw new HttpError(401, "Unauthorized");
  }
  return verifyJwt(token, secret);
}
