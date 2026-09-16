import type { Express, NextFunction, Request, Response } from "express";
import { requireAuth } from "../auth/middleware";
import type { Config } from "../config";
import { HttpError } from "../errors";
import { handle } from "./index";

export function mountOrchestrator(app: Express, config: Config): void {
  const auth = requireAuth(config);

  app.post("/chat", auth, (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const message = req.body?.message;
      if (typeof message !== "string" || message.trim() === "") {
        throw new HttpError(400, "message is required");
      }
      const user = req.user;
      if (!user) {
        throw new HttpError(401, "Unauthorized");
      }
      const authorization = req.headers.authorization ?? "";
      const jwt = authorization.startsWith("Bearer ")
        ? authorization.slice("Bearer ".length).trim()
        : "";

      const result = await handle({
        message: message.trim(),
        jwt,
        userId: user.id,
        timezone: config.timezone,
        userName: user.name,
      });
      res.json(result);
    })().catch(next);
  });
}
