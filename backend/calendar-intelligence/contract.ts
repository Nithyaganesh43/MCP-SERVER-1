import { HttpError } from "../errors";
import { PREFERENCE_TYPE, type PreferenceType } from "../model/index";
import type { CalendarActivityView } from "../calendar/contract";

export const CALENDAR_INTELLIGENCE_TOOLS = [
  "calendar.preferences.save",
  "calendar.preferences.get",
  "calendar.preferences.update",
  "calendar.preferences.delete",
  "calendar.capacity.check",
  "calendar.missed.review",
  "calendar.preview",
] as const;

// Note: calendar.split_task already exists in calendar module

export type CalendarIntelligenceTool = (typeof CALENDAR_INTELLIGENCE_TOOLS)[number];

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
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, `${key} must be a string`);
  }
  return value;
}

function parseObjectIdHex(value: string, key: string): string {
  if (!/^[a-fA-F0-9]{24}$/.test(value)) {
    throw new HttpError(400, `${key} must be a 24-character hex id`);
  }
  return value;
}

function parseYmd(value: unknown, key: string): string {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, `${key} must be YYYY-MM-DD`);
  }
  return value;
}

function assertTimeZone(tz: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
  } catch {
    throw new HttpError(400, `Invalid timezone: ${tz}`);
  }
}

// Input types

export type PreferencesSaveInput = {
  type: PreferenceType;
  value: Record<string, unknown>;
  timezone: string;
};

export type PreferencesGetInput = {
  types?: PreferenceType[];
};

export type PreferencesUpdateInput = {
  preferenceId: string;
  value: Record<string, unknown>;
};

export type PreferencesDeleteInput = {
  preferenceId: string;
};

export type CapacityCheckInput = {
  date: string;
  timezone: string;
};

export type MissedReviewInput = {
  date: string;
  timezone: string;
};

// SplitTaskInput removed - calendar.split_task already exists in calendar module

export type PreviewInput = {
  date: string;
  timezone: string;
};

// Output types

export type PreferenceView = {
  preferenceId: string;
  type: PreferenceType;
  value: Record<string, unknown>;
  timezone: string;
  updatedAt: string;
};

export type CapacityCheckOutput = {
  exceedsLimit: boolean;
  count: number;
  limit: number | null;
  date: string;
};

export type MissedActivityView = {
  activityId: string;
  title: string;
  priority: number;
  flexibility: string;
};

export type MissedSuggestionView = {
  activityId: string;
  suggestedDate: string;
  reason: string;
};

export type MissedReviewOutput = {
  missed: MissedActivityView[];
  suggestions: MissedSuggestionView[];
};

// SplitSessionView and SplitTaskOutput removed - calendar.split_task already exists in calendar module

export type PreviewOutput = {
  summary: string;
  activities: CalendarActivityView[];
  workload: {
    count: number;
    limit: number | null;
  };
};

// Parsers

const SAVE_KEYS = ["type", "value", "timezone"] as const;

export function parsePreferencesSaveInput(
  body: unknown,
  fallbackTimezone: string,
): PreferencesSaveInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Invalid body");
  }
  rejectUnknown(body, SAVE_KEYS);
  const type = requireString(body, "type");
  if (!PREFERENCE_TYPE.includes(type as PreferenceType)) {
    throw new HttpError(400, `Invalid preference type: ${type}`);
  }
  if (!isRecord(body.value)) {
    throw new HttpError(400, "value must be an object");
  }
  const timezone =
    typeof body.timezone === "string" && body.timezone !== ""
      ? body.timezone
      : fallbackTimezone;
  assertTimeZone(timezone);
  return {
    type: type as PreferenceType,
    value: body.value,
    timezone,
  };
}

const GET_KEYS = ["types"] as const;

export function parsePreferencesGetInput(body: unknown): PreferencesGetInput {
  const record = body === undefined || body === null ? {} : body;
  if (!isRecord(record)) {
    throw new HttpError(400, "Invalid body");
  }
  rejectUnknown(record, GET_KEYS);
  if (record.types !== undefined) {
    if (!Array.isArray(record.types)) {
      throw new HttpError(400, "types must be an array");
    }
    for (const t of record.types) {
      if (typeof t !== "string" || !PREFERENCE_TYPE.includes(t as PreferenceType)) {
        throw new HttpError(400, `Invalid preference type: ${t}`);
      }
    }
    return { types: record.types as PreferenceType[] };
  }
  return {};
}

const UPDATE_KEYS = ["preferenceId", "value"] as const;

export function parsePreferencesUpdateInput(body: unknown): PreferencesUpdateInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Invalid body");
  }
  rejectUnknown(body, UPDATE_KEYS);
  const preferenceId = parseObjectIdHex(requireString(body, "preferenceId"), "preferenceId");
  if (!isRecord(body.value)) {
    throw new HttpError(400, "value must be an object");
  }
  return {
    preferenceId,
    value: body.value,
  };
}

const DELETE_KEYS = ["preferenceId"] as const;

export function parsePreferencesDeleteInput(body: unknown): PreferencesDeleteInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Invalid body");
  }
  rejectUnknown(body, DELETE_KEYS);
  return {
    preferenceId: parseObjectIdHex(requireString(body, "preferenceId"), "preferenceId"),
  };
}

const CAPACITY_KEYS = ["date", "timezone"] as const;

export function parseCapacityCheckInput(
  body: unknown,
  fallbackTimezone: string,
): CapacityCheckInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Invalid body");
  }
  rejectUnknown(body, CAPACITY_KEYS);
  const date = parseYmd(body.date, "date");
  const timezone =
    typeof body.timezone === "string" && body.timezone !== ""
      ? body.timezone
      : fallbackTimezone;
  assertTimeZone(timezone);
  return { date, timezone };
}

const MISSED_KEYS = ["date", "timezone"] as const;

export function parseMissedReviewInput(
  body: unknown,
  fallbackTimezone: string,
): MissedReviewInput {
  const record = body === undefined || body === null ? {} : body;
  if (!isRecord(record)) {
    throw new HttpError(400, "Invalid body");
  }
  rejectUnknown(record, MISSED_KEYS);
  const now = new Date();
  const defaultDate = now.toISOString().split("T")[0];
  const date = record.date ? parseYmd(record.date, "date") : defaultDate;
  const timezone =
    typeof record.timezone === "string" && record.timezone !== ""
      ? record.timezone
      : fallbackTimezone;
  assertTimeZone(timezone);
  return { date, timezone };
}

// parseSplitTaskInput removed - calendar.split_task already exists in calendar module

const PREVIEW_KEYS = ["date", "timezone"] as const;

export function parsePreviewInput(body: unknown, fallbackTimezone: string): PreviewInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Invalid body");
  }
  rejectUnknown(body, PREVIEW_KEYS);
  const date = parseYmd(body.date, "date");
  const timezone =
    typeof body.timezone === "string" && body.timezone !== ""
      ? body.timezone
      : fallbackTimezone;
  assertTimeZone(timezone);
  return { date, timezone };
}
