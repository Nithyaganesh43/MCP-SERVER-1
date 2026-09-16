import type { Express, NextFunction, Request, Response } from "express";
import { requireAuth } from "../auth/middleware";
import type { Config } from "../config";
import { snapshot } from "./service";

function wrap(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

export function mountUsage(app: Express, config: Config): void {
  const auth = requireAuth(config);

  app.get(
    "/api/usage",
    auth,
    wrap(async (req, res) => {
      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({ success: false, message: "Unauthorized" });
        return;
      }
      res.json(await snapshot(userId));
    }),
  );
}
