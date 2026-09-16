import type { Express, NextFunction, Request, Response } from "express";
import { requireAuth } from "../auth/middleware";
import { appendTurn, listMessages, toMessageView } from "../chat/service";
import type { Config } from "../config";
import { HttpError } from "../errors";
import { handle } from "./index";

export function mountOrchestrator(app: Express, config: Config): void {
  const auth = requireAuth(config);

  app.get("/chat/messages", auth, (req: Request, res: Response, next: NextFunction) => {
    void (async () => {
      const user = req.user;
      if (!user) {
        throw new HttpError(401, "Unauthorized");
      }
      const messages = await listMessages(user.id);
      res.json({ messages: messages.map(toMessageView) });
    })().catch(next);
  });

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
      await appendTurn(user.id, message.trim(), result.reply);
      res.json(result);
    })().catch(next);
  });
}
