import { HttpError } from "../errors";
import { assertTimeZone } from "../calendar/time";

export const REFLECTION_TOOLS = [
  "reflection.daily",
  "reflection.weekly",
  "reflection.monthly",
] as const;

export type ReflectionTool = (typeof REFLECTION_TOOLS)[number];

const DAILY_KEYS = ["date", "timezone"] as const;
const WEEKLY_KEYS = ["date", "timezone"] as const;
const MONTHLY_KEYS = ["date", "timezone"] as const;

// Input types
export interface ReflectionDailyInput {
  date?: string; // YYYY-MM-DD
  timezone?: string;
}

export interface ReflectionWeeklyInput {
  date?: string; // YYYY-MM-DD
  timezone?: string;
}

export interface ReflectionMonthlyInput {
  date?: string; // YYYY-MM-DD
  timezone?: string;
}

// Output types
export interface ReflectionDailyOutput {
  summary: string;
  completed: number;
  missed: number;
  upcoming: number;
}

export interface ReflectionWeeklyOutput {
  summary: string;
  insights: string[];
}

export interface ReflectionMonthlyOutput {
  summary: string;
  trends: string[];
}

// Validation helpers
function rejectExtraKeys(input: unknown, allowed: readonly string[]): void {
  if (typeof input !== "object" || input === null) {
    throw new HttpError(400, "Invalid input: must be an object");
  }
  const keys = Object.keys(input);
  const extra = keys.filter((k) => !allowed.includes(k));
  if (extra.length > 0) {
    throw new HttpError(400, `Unknown field(s): ${extra.join(", ")}`);
  }
}

function parseOptionalDate(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new HttpError(400, "date must be a string (YYYY-MM-DD)");
  }
  // Validate YYYY-MM-DD format
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new HttpError(400, "date must be in YYYY-MM-DD format");
  }
  return value;
}

function parseOptionalTimezone(value: unknown): string | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "string") {
    throw new HttpError(400, "timezone must be a string");
  }
  assertTimeZone(value);
  return value;
}

// Parsers
export function parseReflectionDailyInput(input: unknown): ReflectionDailyInput {
  rejectExtraKeys(input, DAILY_KEYS);
  const raw = input as Record<string, unknown>;

  const date = parseOptionalDate(raw.date);
  const timezone = parseOptionalTimezone(raw.timezone);

  return { date, timezone };
}

export function parseReflectionWeeklyInput(input: unknown): ReflectionWeeklyInput {
  rejectExtraKeys(input, WEEKLY_KEYS);
  const raw = input as Record<string, unknown>;

  const date = parseOptionalDate(raw.date);
  const timezone = parseOptionalTimezone(raw.timezone);

  return { date, timezone };
}

export function parseReflectionMonthlyInput(input: unknown): ReflectionMonthlyInput {
  rejectExtraKeys(input, MONTHLY_KEYS);
  const raw = input as Record<string, unknown>;

  const date = parseOptionalDate(raw.date);
  const timezone = parseOptionalTimezone(raw.timezone);

  return { date, timezone };
}
