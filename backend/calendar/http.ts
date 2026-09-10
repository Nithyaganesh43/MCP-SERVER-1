import express, {
  type ErrorRequestHandler,
  type NextFunction,
  type Request,
  type Response,
} from "express";
import mongoose, { Types } from "mongoose";
import { mountAuth } from "../auth/http";
import { requireAuth } from "../auth/middleware";
import type { Config } from "../config";
import { HttpError } from "../errors";
import {
  parseCompleteInput,
  parseConflictsInput,
  parseCreateInput,
  parseDeleteInput,
  parseListInput,
  parseRescheduleInput,
  parseSuggestInput,
  parseUpdateInput,
  queryRecord,
} from "./contract";
import { CalendarService } from "./service";

function wrap(
  handler: (req: Request, res: Response) => Promise<void>,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    handler(req, res).catch(next);
  };
}

function routeId(req: Request): string {
  const id = req.params.id;
  if (typeof id !== "string") {
    throw new HttpError(400, "activityId is required");
  }
  return id;
}

function calendarFor(req: Request): CalendarService {
  const id = req.user?.id;
  if (!id) {
    throw new HttpError(401, "Unauthorized");
  }
  return new CalendarService(new Types.ObjectId(id));
}

export function createApp(config: Config): express.Express {
  const app = express();
  const auth = requireAuth(config);

  app.use((_req, res, next) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,DELETE,OPTIONS");
    if (_req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  });
  app.use(express.json());

  app.get("/health", (_req, res) => {
    res.json({ ok: true, db: mongoose.connection.readyState === 1 });
  });

  mountAuth(app, config);

  app.post(
    "/activities",
    auth,
    wrap(async (req, res) => {
      const result = await calendarFor(req).create(parseCreateInput(req.body));
      res.status(201).json(result);
    }),
  );

  app.patch(
    "/activities/:id",
    auth,
    wrap(async (req, res) => {
      const result = await calendarFor(req).update(parseUpdateInput(req.body, routeId(req)));
      res.json(result);
    }),
  );

  app.delete(
    "/activities/:id",
    auth,
    wrap(async (req, res) => {
      const result = await calendarFor(req).delete(parseDeleteInput(req.body, routeId(req)));
      res.json(result);
    }),
  );

  app.get(
    "/activities",
    auth,
    wrap(async (req, res) => {
      const result = await calendarFor(req).list(
        parseListInput(queryRecord(req.query as Record<string, unknown>), config.timezone),
      );
      res.json(result);
    }),
  );

  app.post(
    "/activities/:id/complete",
    auth,
    wrap(async (req, res) => {
      const result = await calendarFor(req).complete(parseCompleteInput(req.body, routeId(req)));
      res.json(result);
    }),
  );

  app.post(
    "/activities/:id/reschedule",
    auth,
    wrap(async (req, res) => {
      const result = await calendarFor(req).reschedule(
        parseRescheduleInput(req.body, routeId(req)),
      );
      res.json(result);
    }),
  );

  app.post(
    "/calendar/conflicts",
    auth,
    wrap(async (req, res) => {
      const result = await calendarFor(req).conflicts(parseConflictsInput(req.body));
      res.json(result);
    }),
  );

  app.post(
    "/calendar/suggest-slot",
    auth,
    wrap(async (req, res) => {
      const result = await calendarFor(req).suggestSlot(
        parseSuggestInput(req.body, config.timezone),
      );
      res.json(result);
    }),
  );

  const errors: ErrorRequestHandler = (err, _req, res, _next) => {
    if (err instanceof HttpError) {
      res.status(err.status).json({ success: false, message: err.message });
      return;
    }
    if (err instanceof mongoose.Error.ValidationError) {
      res.status(400).json({ success: false, message: err.message });
      return;
    }
    if (err instanceof SyntaxError) {
      res.status(400).json({ success: false, message: "Invalid JSON" });
      return;
    }
    console.error(err);
    res.status(500).json({ success: false, message: "Internal error" });
  };
  app.use(errors);

  return app;
}
