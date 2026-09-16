import type { NextFunction, Request, Response } from "express";
import type { Config } from "../config";
import { HttpError } from "../errors";
import { UserModel } from "../model/index";
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
    void resolveAuth(req, config)
      .then(() => next())
      .catch(next);
  };
}

async function resolveAuth(req: Request, config: Config): Promise<void> {
  const header = req.headers.authorization;
  if (typeof header !== "string" || !header.startsWith("Bearer ")) {
    throw new HttpError(401, "Unauthorized");
  }
  const token = header.slice("Bearer ".length).trim();
  if (token === "") {
    throw new HttpError(401, "Unauthorized");
  }
  try {
    const claims = verifyJwt(token, config.jwtSecret);
    req.user = { id: claims.sub, email: claims.email, name: claims.name };
  } catch {
    const user = await UserModel.findOne({ apiKey: token });
    if (!user) {
      throw new HttpError(401, "Unauthorized");
    }
    req.user = { id: String(user._id), email: user.email, name: user.name };
  }
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
