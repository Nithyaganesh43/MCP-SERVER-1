import type { Express, NextFunction, Request, Response } from "express";
import type { Config } from "../config";
import { HttpError } from "../shared/errors";
import { googleAuthUrl } from "./google";
import { requireAuth } from "./middleware";
import {
  getUserProfile,
  loginFromGoogleCode,
  loginWithApiKey,
  regenerateApiKey,
} from "./service";

function wrap(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
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
      const result = await loginFromGoogleCode(code, config);
      res.json(result);
    }),
  );

  const handleBrowserCallback = wrap(async (req, res) => {
    const error = req.query.error;
    const code = req.query.code;
    if (typeof error === "string" && error !== "" || typeof code !== "string" || code.trim() === "") {
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
      const result = await loginWithApiKey(req.body?.apiKey, config);
      res.json(result);
    }),
  );

  app.post("/auth/logout", auth, (_req, res) => {
    res.json({ success: true });
  });

  app.get(
    "/auth/me",
    auth,
    wrap(async (req, res) => {
      const profile = await getUserProfile(req.user!.id);
      res.json(profile);
    }),
  );

  app.post(
    "/auth/regenerate-api-key",
    auth,
    wrap(async (req, res) => {
      const updated = await regenerateApiKey(req.user!.id);
      res.json(updated);
    }),
  );
}
