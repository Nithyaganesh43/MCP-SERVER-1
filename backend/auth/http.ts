import type { Express, NextFunction, Request, Response } from "express";
import type { Config } from "../config";
import { HttpError } from "../errors";
import { generateUserApiKey, UserModel, type User } from "../model/index";
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
  apiKey: string;
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
    apiKey: user.apiKey,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

export async function ensureApiKey(user: User): Promise<User> {
  if (typeof user.apiKey === "string" && user.apiKey.length > 0) {
    return user;
  }
  const apiKey = generateUserApiKey();
  await UserModel.updateOne({ _id: user._id }, { $set: { apiKey } });
  user.apiKey = apiKey;
  return user;
}

export async function findOrCreateUser(
  profile: GoogleProfile,
  timezone: string,
): Promise<User> {
  const existing = await UserModel.findOne({
    $or: [{ googleId: profile.googleId }, { email: profile.email }],
  });
  if (existing) {
    if (existing.googleId !== profile.googleId) {
      existing.googleId = profile.googleId;
      await UserModel.updateOne(
        { _id: existing._id },
        {
          $set: {
            googleId: profile.googleId,
            ...(profile.name ? { name: profile.name } : {}),
            ...(profile.picture ? { picture: profile.picture } : {}),
          },
        },
      );
    }
    return ensureApiKey(existing);
  }
  return UserModel.create({
    googleId: profile.googleId,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
    timezone,
    apiKey: generateUserApiKey(),
  });
}

async function loginFromGoogleCode(
  code: string,
  config: Config,
): Promise<{ token: string; user: User }> {
  const profile = await exchangeGoogleCode(code, config);
  const user = await findOrCreateUser(profile, config.timezone);
  const token = signJwt(
    { sub: String(user._id), email: user.email, name: user.name },
    config.jwtSecret,
    config.jwtExpiresIn,
  );
  return { token, user };
}

export function mountAuth(app: Express, config: Config): void {
  const auth = requireAuth(config);

  const startGoogle = (_req: Request, res: Response) => {
    res.redirect(googleAuthUrl(config));
  };

  app.get("/auth/google", startGoogle);
  app.get("/api/google", startGoogle);
  app.get("/google", startGoogle);

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
      const { token, user } = await loginFromGoogleCode(code, config);
      res.json({ token, user: toUserView(user) });
    }),
  );

  const handleBrowserCallback = wrap(async (req, res) => {
    const error = req.query.error;
    const code = req.query.code;
    if (typeof error === "string" && error !== "") {
      res.redirect("/?error=auth");
      return;
    }
    if (typeof code !== "string" || code.trim() === "") {
      res.redirect("/?error=auth");
      return;
    }
    try {
      const { token } = await loginFromGoogleCode(code, config);
      res.redirect(`/?token=${encodeURIComponent(token)}`);
    } catch (err) {
      console.error("[Google OAuth Error]", err);
      res.redirect("/?error=auth");
    }
  });

  app.get("/api/google/callback", handleBrowserCallback);
  app.get("/google/callback", handleBrowserCallback);

  app.post(
    "/auth/api-key",
    wrap(async (req, res) => {
      const apiKey = req.body?.apiKey;
      if (typeof apiKey !== "string" || apiKey.trim() === "") {
        throw new HttpError(401, "Unauthorized");
      }
      const user = await UserModel.findOne({ apiKey: apiKey.trim() });
      if (!user) {
        throw new HttpError(401, "Unauthorized");
      }
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
      const withKey = await ensureApiKey(user);
      res.json(toUserView(withKey));
    }),
  );

  app.post(
    "/auth/regenerate-api-key",
    auth,
    wrap(async (req, res) => {
      const newApiKey = generateUserApiKey();
      const updated = await UserModel.findByIdAndUpdate(
        req.user?.id,
        { $set: { apiKey: newApiKey } },
        { new: true },
      );
      if (!updated) {
        throw new HttpError(401, "Unauthorized");
      }
      res.json(toUserView(updated));
    }),
  );
}
