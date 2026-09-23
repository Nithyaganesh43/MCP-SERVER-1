import {
  ACTIVITY_STATUS,
  CREATED_BY,
  FLEXIBILITY,
  PRIORITY,
  RECURRENCE_RULE,
  type ActivityStatus,
  type CreatedBy,
  type Flexibility,
  type Priority,
  type RecurrenceRule,
} from "../model/index";
import { HttpError } from "../shared/errors";
import { addCalendarDays, assertTimeZone, dayBounds } from "./time";
import {
  ALLOWED_UPDATE_PATHS,
  LIST_RANGE,
  type CalendarCreateInput,
  type CalendarUpdateInput,
  type CalendarRescheduleInput,
  type CalendarListInput,
  type CalendarCompleteInput,
  type CalendarDeleteInput,
  type ListRange,
} from "./types";

export * from "./ops-schemas";

const CREATE_KEYS = [
  "title",
  "note",
  "category",
  "schedule",
  "behavior",
  "priority",
  "reminders",
  "tags",
  "metadata",
  "createdBy",
] as const;

const UPDATE_KEYS = ["activityId", "changes"] as const;
const RESCHEDULE_KEYS = ["activityId", "newStartAt", "reason"] as const;
const LIST_KEYS = ["range", "date", "startAt", "endAt", "timezone"] as const;
const COMPLETE_KEYS = ["activityId"] as const;
const DELETE_KEYS = ["activityId", "deleteFutureRecurrences"] as const;

const DATE_PATHS = new Set([
  "schedule.startAt",
  "schedule.endAt",
  "behavior.recurrence.until",
]);

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

function optionalString(value: unknown, key: string): string | undefined {
  if (value === undefined) return undefined;
  if (typeof value !== "string") throw new HttpError(400, `${key} must be a string`);
  return value;
}

export function parseObjectIdHex(value: string, key: string): string {
  if (!/^[a-fA-F0-9]{24}$/.test(value)) {
    throw new HttpError(400, `${key} must be a 24-character hex id`);
  }
  return value;
}

export function parseIsoDate(value: unknown, key: string): Date {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${key} must be an ISO date string`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${key} must be an ISO date string`);
  }
  return date;
}

function parseOptionalDate(value: unknown, key: string): Date | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  return parseIsoDate(value, key);
}

function parseYmd(value: unknown, key: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${key} must be YYYY-MM-DD`);
  }
  return value;
}

function parsePriority(value: unknown): Priority {
  if (typeof value !== "number" || !(PRIORITY as readonly number[]).includes(value)) {
    throw new HttpError(400, "priority must be 1–5");
  }
  return value as Priority;
}

function parseFlexibility(value: unknown): Flexibility {
  if (typeof value !== "string" || !FLEXIBILITY.includes(value as Flexibility)) {
    throw new HttpError(400, "behavior.flexibility is invalid");
  }
  return value as Flexibility;
}

function parseRecurrenceRule(value: unknown): RecurrenceRule {
  if (typeof value !== "string" || !RECURRENCE_RULE.includes(value as RecurrenceRule)) {
    throw new HttpError(400, "behavior.recurrence.rule is invalid");
  }
  return value as RecurrenceRule;
}

function parseReminders(value: unknown): { beforeMin: number }[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) throw new HttpError(400, "reminders must be an array");
  return value.map((item, index) => {
    if (!isRecord(item) || typeof item.beforeMin !== "number" || item.beforeMin < 0) {
      throw new HttpError(400, `reminders[${index}].beforeMin must be >= 0`);
    }
    return { beforeMin: item.beforeMin };
  });
}

function parseDays(value: unknown): number[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value) || value.some((day) => typeof day !== "number" || day < 1 || day > 7)) {
    throw new HttpError(400, "behavior.recurrence.days must be ISO weekdays 1–7");
  }
  return value;
}

export function parseCreateInput(body: unknown): CalendarCreateInput {
  if (!isRecord(body)) throw new HttpError(400, "Invalid body");
  rejectUnknown(body, CREATE_KEYS);
  const title = requireString(body, "title");
  if (!isRecord(body.schedule)) throw new HttpError(400, "schedule is required");
  rejectUnknown(body.schedule, [
    "startAt",
    "endAt",
    "durationMin",
    "bufferBeforeMin",
    "bufferAfterMin",
    "timezone",
  ]);
  const timezone = requireString(body.schedule, "timezone");
  assertTimeZone(timezone);

  if (body.schedule.durationMin !== undefined && body.schedule.durationMin !== null) {
    if (typeof body.schedule.durationMin !== "number" || body.schedule.durationMin < 0) {
      throw new HttpError(400, "schedule.durationMin must be >= 0");
    }
  }
  if (body.schedule.bufferBeforeMin !== undefined && body.schedule.bufferBeforeMin !== null) {
    if (typeof body.schedule.bufferBeforeMin !== "number" || body.schedule.bufferBeforeMin < 0) {
      throw new HttpError(400, "schedule.bufferBeforeMin must be >= 0");
    }
  }
  if (body.schedule.bufferAfterMin !== undefined && body.schedule.bufferAfterMin !== null) {
    if (typeof body.schedule.bufferAfterMin !== "number" || body.schedule.bufferAfterMin < 0) {
      throw new HttpError(400, "schedule.bufferAfterMin must be >= 0");
    }
  }
  if (!isRecord(body.behavior)) throw new HttpError(400, "behavior is required");
  rejectUnknown(body.behavior, ["flexibility", "recurrence"]);
  const flexibility = parseFlexibility(body.behavior.flexibility);
  let recurrence: CalendarCreateInput["behavior"]["recurrence"];
  if (body.behavior.recurrence !== undefined) {
    if (!isRecord(body.behavior.recurrence)) {
      throw new HttpError(400, "behavior.recurrence is invalid");
    }
    rejectUnknown(body.behavior.recurrence, ["rule", "interval", "days", "until"]);
    if (
      body.behavior.recurrence.interval !== undefined &&
      (typeof body.behavior.recurrence.interval !== "number" ||
        body.behavior.recurrence.interval < 1)
    ) {
      throw new HttpError(400, "behavior.recurrence.interval must be >= 1");
    }
    recurrence = {
      rule:
        body.behavior.recurrence.rule === undefined
          ? undefined
          : parseRecurrenceRule(body.behavior.recurrence.rule),
      interval: body.behavior.recurrence.interval,
      days: parseDays(body.behavior.recurrence.days),
      until: parseOptionalDate(body.behavior.recurrence.until, "behavior.recurrence.until"),
    };
  }
  let createdBy: CreatedBy | undefined;
  if (body.createdBy !== undefined) {
    if (typeof body.createdBy !== "string" || !CREATED_BY.includes(body.createdBy as CreatedBy)) {
      throw new HttpError(400, "createdBy is invalid");
    }
    createdBy = body.createdBy as CreatedBy;
  }
  let tags: string[] | undefined;
  if (body.tags !== undefined) {
    if (!Array.isArray(body.tags) || body.tags.some((tag) => typeof tag !== "string")) {
      throw new HttpError(400, "tags must be strings");
    }
    tags = body.tags;
  }
  let metadata: Record<string, unknown> | undefined;
  if (body.metadata !== undefined) {
    if (!isRecord(body.metadata)) throw new HttpError(400, "metadata must be an object");
    metadata = body.metadata;
  }
  return {
    title,
    note: optionalString(body.note, "note"),
    category: optionalString(body.category, "category"),
    schedule: {
      startAt: parseOptionalDate(body.schedule.startAt, "schedule.startAt"),
      endAt: parseOptionalDate(body.schedule.endAt, "schedule.endAt"),
      durationMin:
        body.schedule.durationMin === undefined
          ? undefined
          : (body.schedule.durationMin as number | null),
      bufferBeforeMin:
        body.schedule.bufferBeforeMin === undefined
          ? undefined
          : (body.schedule.bufferBeforeMin as number | null),
      bufferAfterMin:
        body.schedule.bufferAfterMin === undefined
          ? undefined
          : (body.schedule.bufferAfterMin as number | null),
      timezone,
    },
    behavior: { flexibility, recurrence },
    priority: parsePriority(body.priority),
    reminders: parseReminders(body.reminders),
    tags,
    metadata,
    createdBy,
  };
}

function coerceChangeValue(path: string, value: unknown): unknown {
  if (DATE_PATHS.has(path)) return parseOptionalDate(value, path);
  if (path === "schedule.durationMin") {
    if (value === null) return null;
    if (typeof value !== "number" || value < 0) throw new HttpError(400, "schedule.durationMin must be >= 0");
    return value;
  }
  if (path === "schedule.bufferBeforeMin" || path === "schedule.bufferAfterMin") {
    if (value === null) return null;
    if (typeof value !== "number" || value < 0) throw new HttpError(400, `${path} must be >= 0`);
    return value;
  }
  if (path === "priority") return parsePriority(value);
  if (path === "behavior.flexibility") return parseFlexibility(value);
  if (path === "behavior.recurrence.rule") return parseRecurrenceRule(value);
  if (path === "behavior.recurrence.interval") {
    if (typeof value !== "number" || value < 1) throw new HttpError(400, "behavior.recurrence.interval must be >= 1");
    return value;
  }
  if (path === "behavior.recurrence.days") {
    const days = parseDays(value);
    if (!days) throw new HttpError(400, "behavior.recurrence.days is invalid");
    return days;
  }
  if (path === "reminders") {
    const reminders = parseReminders(value);
    if (!reminders) throw new HttpError(400, "reminders is invalid");
    return reminders;
  }
  if (path === "schedule.timezone") {
    if (typeof value !== "string") throw new HttpError(400, "schedule.timezone must be a string");
    assertTimeZone(value);
    return value;
  }
  if (path === "tags") {
    if (!Array.isArray(value) || value.some((tag) => typeof tag !== "string")) {
      throw new HttpError(400, "tags must be strings");
    }
    return value;
  }
  if (path === "metadata") {
    if (!isRecord(value)) throw new HttpError(400, "metadata must be an object");
    return value;
  }
  if (path === "status") {
    if (typeof value !== "string" || !ACTIVITY_STATUS.includes(value as ActivityStatus)) {
      throw new HttpError(400, "status is invalid");
    }
    return value;
  }
  if (path === "title" || path === "note" || path === "category") {
    if (typeof value !== "string") throw new HttpError(400, `${path} must be a string`);
    return value;
  }
  return value;
}

export function parseUpdateInput(body: unknown, idFromRoute?: string): CalendarUpdateInput {
  if (!isRecord(body)) throw new HttpError(400, "Invalid body");
  rejectUnknown(body, UPDATE_KEYS);
  const activityId = parseObjectIdHex(
    idFromRoute ?? requireString(body, "activityId"),
    "activityId",
  );
  if (!isRecord(body.changes)) throw new HttpError(400, "changes is required");
  const changes: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(body.changes)) {
    if (!(ALLOWED_UPDATE_PATHS as readonly string[]).includes(path)) {
      throw new HttpError(400, `Cannot update ${path}`);
    }
    changes[path] = coerceChangeValue(path, value);
  }
  if (Object.keys(changes).length === 0) throw new HttpError(400, "changes cannot be empty");
  return { activityId, changes };
}

export function parseRescheduleInput(body: unknown, idFromRoute?: string): CalendarRescheduleInput {
  if (!isRecord(body)) throw new HttpError(400, "Invalid body");
  rejectUnknown(body, RESCHEDULE_KEYS);
  return {
    activityId: parseObjectIdHex(
      idFromRoute ?? requireString(body, "activityId"),
      "activityId",
    ),
    newStartAt: parseIsoDate(body.newStartAt, "newStartAt"),
    reason: optionalString(body.reason, "reason"),
  };
}

export function parseListInput(
  raw: Record<string, unknown>,
  fallbackTimezone: string,
): CalendarListInput {
  rejectUnknown(raw, LIST_KEYS);
  const rangeRaw = raw.range;
  if (typeof rangeRaw !== "string" || !LIST_RANGE.includes(rangeRaw as ListRange)) {
    throw new HttpError(400, "range must be day, week, month, or custom");
  }
  const range = rangeRaw as ListRange;
  const timezone =
    typeof raw.timezone === "string" && raw.timezone !== ""
      ? raw.timezone
      : fallbackTimezone;
  assertTimeZone(timezone);
  if (range === "custom") {
    if (raw.startAt === undefined || raw.endAt === undefined) {
      throw new HttpError(400, "custom range requires startAt and endAt");
    }
    const startAt = parseBound(raw.startAt, timezone, "start");
    const endAt = parseBound(raw.endAt, timezone, "end");
    if (!(startAt < endAt)) throw new HttpError(400, "startAt must be before endAt");
    return { range, startAt, endAt, timezone };
  }
  if (raw.date === undefined) throw new HttpError(400, "date is required");
  return { range, date: parseYmd(raw.date, "date"), timezone };
}

function parseBound(value: unknown, timezone: string, edge: "start" | "end"): Date {
  if (typeof value !== "string") throw new HttpError(400, `${edge} bound is invalid`);
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return edge === "start"
      ? dayBounds(value, timezone).start
      : dayBounds(addCalendarDays(value, 1), timezone).start;
  }
  return parseIsoDate(value, edge === "start" ? "startAt" : "endAt");
}

export function parseCompleteInput(body: unknown, idFromRoute?: string): CalendarCompleteInput {
  const record = body === undefined || body === null ? {} : body;
  if (!isRecord(record)) throw new HttpError(400, "Invalid body");
  rejectUnknown(record, COMPLETE_KEYS);
  return {
    activityId: parseObjectIdHex(
      idFromRoute ?? requireString(record, "activityId"),
      "activityId",
    ),
  };
}

export function parseDeleteInput(body: unknown, idFromRoute?: string): CalendarDeleteInput {
  const record = body === undefined || body === null ? {} : body;
  if (!isRecord(record)) throw new HttpError(400, "Invalid body");
  rejectUnknown(record, DELETE_KEYS);
  if (record.deleteFutureRecurrences === true) {
    throw new HttpError(400, "deleteFutureRecurrences is not in V1");
  }
  return {
    activityId: parseObjectIdHex(
      idFromRoute ?? requireString(record, "activityId"),
      "activityId",
    ),
  };
}

export function toIso(value: Date | null | undefined): string | null {
  if (!value) return null;
  return value.toISOString();
}

export function queryRecord(query: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(query)) {
    if (value === undefined) continue;
    out[key] = Array.isArray(value) ? value[0] : value;
  }
  return out;
}
