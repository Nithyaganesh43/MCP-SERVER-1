import type { Types } from "mongoose";
import type { PreferenceType } from "./constants";

export type { PreferenceType };

/** `HH:mm` local clock time, 00:00–23:59. */
export type TimeWindow = { start: string; end: string };
export type CommuteDuration = { durationMin: number };
export type WorkloadLimit = { maxImportant: number };
export type FocusDuration = { durationMin: number };
export type ExamPlanning = { enabled: true; daysBeforeExam: number };

export type PreferenceValue =
  | TimeWindow
  | CommuteDuration
  | WorkloadLimit
  | FocusDuration
  | ExamPlanning;

/** V1 scheduling_preferences document. Field set is closed. preferenceId in tools is String(_id). */
export interface SchedulingPreference {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  type: PreferenceType;
  value: PreferenceValue;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export type SchedulingPreferenceCreateInput = Omit<
  SchedulingPreference,
  "_id" | "createdAt" | "updatedAt"
>;

const HH_MM = /^([01]\d|2[0-3]):[0-5]\d$/;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasExactKeys(
  value: Record<string, unknown>,
  keys: readonly string[],
): boolean {
  const actual = Object.keys(value);
  return actual.length === keys.length && keys.every((key) => actual.includes(key));
}

export function isValidPreferenceValue(
  type: PreferenceType,
  value: unknown,
): boolean {
  if (!isPlainObject(value)) {
    return false;
  }
  switch (type) {
    case "sleep_window":
    case "learning_window":
    case "quiet_hours":
      return (
        hasExactKeys(value, ["start", "end"]) &&
        typeof value.start === "string" &&
        typeof value.end === "string" &&
        HH_MM.test(value.start) &&
        HH_MM.test(value.end)
      );
    case "commute":
      return (
        hasExactKeys(value, ["durationMin"]) &&
        typeof value.durationMin === "number" &&
        Number.isFinite(value.durationMin) &&
        value.durationMin >= 0
      );
    case "focus_duration":
      return (
        hasExactKeys(value, ["durationMin"]) &&
        typeof value.durationMin === "number" &&
        Number.isFinite(value.durationMin) &&
        value.durationMin >= 1
      );
    case "workload_limit":
      return (
        hasExactKeys(value, ["maxImportant"]) &&
        typeof value.maxImportant === "number" &&
        Number.isInteger(value.maxImportant) &&
        value.maxImportant >= 1
      );
    case "exam_planning":
      return (
        hasExactKeys(value, ["enabled", "daysBeforeExam"]) &&
        value.enabled === true &&
        typeof value.daysBeforeExam === "number" &&
        Number.isInteger(value.daysBeforeExam) &&
        value.daysBeforeExam >= 1
      );
  }
}
