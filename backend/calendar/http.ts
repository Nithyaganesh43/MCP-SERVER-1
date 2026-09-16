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
  parseRescueMissedInput,
  parseRolloverInput,
  parseSplitTaskInput,
  parseSuggestInput,
  parseUndoInput,
  parseUpdateInput,
  parseUserPreferencesInput,
  parseWeeklySummaryInput,
  queryRecord,
} from "./contract";
import { CalendarService } from "./service";
import { mountOrchestrator } from "../orchestrator/http";

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

const CORS_METHODS = "GET,POST,PATCH,DELETE,OPTIONS";
const CORS_HEADERS = "Content-Type, Authorization, x-mcp-api-key, Mcp-Session-Id";

function applyCors(
  config: Config,
): (req: Request, res: Response, next: NextFunction) => void {
  return (req, res, next) => {
    res.setHeader("Access-Control-Allow-Methods", CORS_METHODS);
    res.setHeader("Access-Control-Allow-Headers", CORS_HEADERS);
    res.setHeader("Access-Control-Allow-Credentials", "false");

    if (config.nodeEnv === "production") {
      const origin = req.headers.origin;
      if (typeof origin === "string" && config.corsOrigins.includes(origin)) {
        res.setHeader("Access-Control-Allow-Origin", origin);
        res.setHeader("Vary", "Origin");
      }
    } else {
      res.setHeader("Access-Control-Allow-Origin", "*");
    }

    if (req.method === "OPTIONS") {
      res.status(204).end();
      return;
    }
    next();
  };
}

export function createApp(config: Config): express.Express {
  const app = express();
  const auth = requireAuth(config);

  app.use(applyCors(config));
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

  app.post(
    "/calendar/undo",
    auth,
    wrap(async (req, res) => {
      const result = await calendarFor(req).undo(parseUndoInput(req.body));
      res.json(result);
    }),
  );

  app.post(
    "/calendar/user-preferences",
    auth,
    wrap(async (req, res) => {
      const result = await calendarFor(req).userPreferences(
        parseUserPreferencesInput(req.body),
      );
      res.json(result);
    }),
  );

  app.post(
    "/calendar/split-task",
    auth,
    wrap(async (req, res) => {
      const result = await calendarFor(req).splitTask(
        parseSplitTaskInput(req.body, config.timezone),
      );
      res.json(result);
    }),
  );

  app.post(
    "/calendar/rescue-missed",
    auth,
    wrap(async (req, res) => {
      const result = await calendarFor(req).rescueMissed(
        parseRescueMissedInput(req.body, config.timezone),
      );
      res.json(result);
    }),
  );

  app.post(
    "/calendar/rollover",
    auth,
    wrap(async (req, res) => {
      const result = await calendarFor(req).rollover(
        parseRolloverInput(req.body, config.timezone),
      );
      res.json(result);
    }),
  );

  app.post(
    "/calendar/weekly-summary",
    auth,
    wrap(async (req, res) => {
      const result = await calendarFor(req).weeklySummary(
        parseWeeklySummaryInput(req.body, config.timezone),
      );
      res.json(result);
    }),
  );

  mountOrchestrator(app, config);

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
