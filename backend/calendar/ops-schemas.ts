import { HttpError } from "../shared/errors";
import { assertTimeZone } from "./time";
import {
  type CalendarConflictsInput,
  type CalendarSuggestInput,
  type CalendarUndoInput,
  type CalendarUserPreferencesBlob,
  type CalendarUserPreferencesInput,
  type CalendarSplitTaskInput,
  type CalendarRescueMissedInput,
  type CalendarRolloverInput,
  type CalendarWeeklySummaryInput,
} from "./types";
import { parseIsoDate, parseObjectIdHex } from "./schemas";

const CONFLICT_KEYS = ["startAt", "endAt"] as const;
const SUGGEST_KEYS = ["date", "durationMin", "timezone"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknown(record: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new HttpError(400, `Unknown field: ${key}`);
    }
  }
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${key} is required`);
  }
  return value;
}

function parseYmd(value: unknown, key: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${key} must be YYYY-MM-DD`);
  }
  return value;
}

export function parseConflictsInput(body: unknown): CalendarConflictsInput {
  if (!isRecord(body)) throw new HttpError(400, "Invalid body");
  rejectUnknown(body, CONFLICT_KEYS);
  const startAt = parseIsoDate(body.startAt, "startAt");
  const endAt = parseIsoDate(body.endAt, "endAt");
  if (!(startAt < endAt)) throw new HttpError(400, "startAt must be before endAt");
  return { startAt, endAt };
}

export function parseSuggestInput(body: unknown, fallbackTimezone: string): CalendarSuggestInput {
  if (!isRecord(body)) throw new HttpError(400, "Invalid body");
  rejectUnknown(body, SUGGEST_KEYS);
  const timezone =
    typeof body.timezone === "string" && body.timezone !== ""
      ? body.timezone
      : fallbackTimezone;
  assertTimeZone(timezone);
  if (typeof body.durationMin !== "number" || body.durationMin <= 0) {
    throw new HttpError(400, "durationMin must be > 0");
  }
  return {
    date: parseYmd(body.date, "date"),
    durationMin: body.durationMin,
    timezone,
  };
}

export function parseUndoInput(_body: unknown): CalendarUndoInput {
  return {};
}

function requireHour(record: Record<string, unknown>, key: string): number {
  const value = record[key];
  if (typeof value !== "number" || !Number.isInteger(value) || value < 0 || value > 23) {
    throw new HttpError(400, `${key} must be an integer 0–23`);
  }
  return value;
}

function parseHourWindow(value: unknown, field: string): { startHour: number; endHour: number } {
  if (!isRecord(value)) throw new HttpError(400, `${field} must be an object`);
  rejectUnknown(value, ["startHour", "endHour"]);
  return {
    startHour: requireHour(value, "startHour"),
    endHour: requireHour(value, "endHour"),
  };
}

export function parseUserPreferencesInput(body: unknown): CalendarUserPreferencesInput {
  const record = body === undefined || body === null ? {} : body;
  if (!isRecord(record)) throw new HttpError(400, "Invalid body");
  rejectUnknown(record, ["action", "preferences"]);
  const action = requireString(record, "action");
  if (action !== "get" && action !== "update") throw new HttpError(400, "action must be get or update");
  if (action === "get") return { action };
  if (!isRecord(record.preferences)) throw new HttpError(400, "preferences object is required for update");
  rejectUnknown(record.preferences, [
    "quietHours",
    "bestLearningWindow",
    "focusDurationMin",
    "maxDailyHighPriorityTasks",
  ]);
  const preferences: CalendarUserPreferencesBlob = {};
  if (record.preferences.quietHours !== undefined) {
    preferences.quietHours = parseHourWindow(record.preferences.quietHours, "quietHours");
  }
  if (record.preferences.bestLearningWindow !== undefined) {
    preferences.bestLearningWindow = parseHourWindow(
      record.preferences.bestLearningWindow,
      "bestLearningWindow",
    );
  }
  if (record.preferences.focusDurationMin !== undefined) {
    const value = record.preferences.focusDurationMin;
    if (typeof value !== "number" || !Number.isFinite(value) || value < 1) {
      throw new HttpError(400, "focusDurationMin must be >= 1");
    }
    preferences.focusDurationMin = value;
  }
  if (record.preferences.maxDailyHighPriorityTasks !== undefined) {
    const value = record.preferences.maxDailyHighPriorityTasks;
    if (typeof value !== "number" || !Number.isInteger(value) || value < 1) {
      throw new HttpError(400, "maxDailyHighPriorityTasks must be an integer >= 1");
    }
    preferences.maxDailyHighPriorityTasks = value;
  }
  return { action, preferences };
}

export function parseSplitTaskInput(body: unknown, fallbackTimezone: string): CalendarSplitTaskInput {
  if (!isRecord(body)) throw new HttpError(400, "Invalid body");
  const title = requireString(body, "title");
  if (typeof body.totalDurationMin !== "number" || body.totalDurationMin <= 0) {
    throw new HttpError(400, "totalDurationMin must be > 0");
  }
  const timezone =
    typeof body.timezone === "string" && body.timezone !== ""
      ? body.timezone
      : fallbackTimezone;
  assertTimeZone(timezone);
  return {
    title,
    totalDurationMin: body.totalDurationMin,
    maxChunkMin:
      typeof body.maxChunkMin === "number" && body.maxChunkMin > 0
        ? body.maxChunkMin
        : undefined,
    date: body.date ? parseYmd(body.date, "date") : undefined,
    timezone,
  };
}

export function parseRescueMissedInput(body: unknown, fallbackTimezone: string): CalendarRescueMissedInput {
  const record = body === undefined || body === null ? {} : body;
  if (!isRecord(record)) throw new HttpError(400, "Invalid body");
  const timezone =
    typeof record.timezone === "string" && record.timezone !== ""
      ? record.timezone
      : fallbackTimezone;
  assertTimeZone(timezone);
  return {
    autoReschedule: Boolean(record.autoReschedule),
    date: record.date ? parseYmd(record.date, "date") : undefined,
    timezone,
  };
}

export function parseRolloverInput(body: unknown, fallbackTimezone: string): CalendarRolloverInput {
  const record = body === undefined || body === null ? {} : body;
  if (!isRecord(record)) throw new HttpError(400, "Invalid body");
  const timezone =
    typeof record.timezone === "string" && record.timezone !== ""
      ? record.timezone
      : fallbackTimezone;
  assertTimeZone(timezone);
  return {
    targetDate: record.targetDate ? parseYmd(record.targetDate, "targetDate") : undefined,
    timezone,
  };
}

export function parseWeeklySummaryInput(body: unknown, fallbackTimezone: string): CalendarWeeklySummaryInput {
  const record = body === undefined || body === null ? {} : body;
  if (!isRecord(record)) throw new HttpError(400, "Invalid body");
  const timezone =
    typeof record.timezone === "string" && record.timezone !== ""
      ? record.timezone
      : fallbackTimezone;
  assertTimeZone(timezone);
  return {
    date: record.date ? parseYmd(record.date, "date") : undefined,
    timezone,
  };
}
