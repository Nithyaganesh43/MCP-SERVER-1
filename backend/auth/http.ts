import type { Express, NextFunction, Request, Response } from "express";
import type { Config } from "../config";
import { HttpError } from "../errors";
import { UserModel, type User } from "../model/index";
import { exchangeGoogleCode, googleAuthUrl, type GoogleProfile } from "./google";
import { signJwt } from "./jwt";
import { requireAuth } from "./middleware";

function wrap(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

export function toUserView(user: User): {
  id: string;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  timezone: string;
  createdAt: string;
  updatedAt: string;
} {
  return {
    id: String(user._id),
    googleId: user.googleId,
    email: user.email,
    name: user.name,
    picture: user.picture,
    timezone: user.timezone,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function findOrCreateUser(
  profile: GoogleProfile,
  timezone: string,
): Promise<User> {
  const existing = await UserModel.findOne({ googleId: profile.googleId });
  if (existing) {
    return existing;
  }
  return UserModel.create({
    googleId: profile.googleId,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    timezone,
  });
}

export function mountAuth(app: Express, config: Config): void {
  const auth = requireAuth(config);

  app.get("/auth/google", (_req, res) => {
    res.redirect(googleAuthUrl(config));
  });

  app.get(
    "/auth/google/callback",
    wrap(async (req, res) => {
      const error = req.query.error;
      const code = req.query.code;
      if (typeof error === "string" && error !== "") {
        throw new HttpError(401, "Unauthorized");
      }
      if (typeof code !== "string" || code.trim() === "") {
        throw new HttpError(401, "Unauthorized");
      }
      const profile = await exchangeGoogleCode(code, config);
      const user = await findOrCreateUser(profile, config.timezone);
      const token = signJwt(
        { sub: String(user._id), email: user.email, name: user.name },
        config.jwtSecret,
        config.jwtExpiresIn,
      );
      res.json({ token, user: toUserView(user) });
    }),
  );

  app.post("/auth/logout", auth, (_req, res) => {
    res.json({ success: true });
  });

  app.get(
    "/auth/me",
    auth,
    wrap(async (req, res) => {
      const user = await UserModel.findById(req.user?.id);
      if (!user) {
        throw new HttpError(401, "Unauthorized");
      }
      res.json(toUserView(user));
    }),
  );
}
