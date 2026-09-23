import type { Types } from "mongoose";
import {
  SchedulingPreferenceModel,
  UserModel,
  type PreferenceType,
  type SchedulingPreference,
  type TimeWindow,
} from "../model/index";
import type { CalendarUserPreferencesBlob } from "./types";

const ADAPTER_PREFERENCE_TYPES = [
  "quiet_hours",
  "learning_window",
  "focus_duration",
  "workload_limit",
] as const;

export const DEFAULT_WORKLOAD_LIMIT = 3;
export const DEFAULT_FOCUS_DURATION_MIN = 60;

function hourToHm(hour: number): string {
  return `${String(hour).padStart(2, "0")}:00`;
}

function hmToHour(hm: string): number {
  return Number.parseInt(hm.slice(0, 2), 10);
}

function asTimeWindow(value: SchedulingPreference["value"]): TimeWindow | null {
  if ("start" in value && "end" in value) {
    return value;
  }
  return null;
}

export function blobFromDocs(docs: SchedulingPreference[]): CalendarUserPreferencesBlob {
  const map = new Map(docs.map((doc) => [doc.type, doc]));
  const blob: CalendarUserPreferencesBlob = {};
  const quiet = map.get("quiet_hours");
  const quietWindow = quiet ? asTimeWindow(quiet.value) : null;
  if (quietWindow) {
    blob.quietHours = {
      startHour: hmToHour(quietWindow.start),
      endHour: hmToHour(quietWindow.end),
    };
  }
  const learning = map.get("learning_window");
  const learningWindow = learning ? asTimeWindow(learning.value) : null;
  if (learningWindow) {
    blob.bestLearningWindow = {
      startHour: hmToHour(learningWindow.start),
      endHour: hmToHour(learningWindow.end),
    };
  }
  const focus = map.get("focus_duration");
  if (focus && "durationMin" in focus.value) {
    blob.focusDurationMin = focus.value.durationMin;
  }
  const workload = map.get("workload_limit");
  if (workload && "maxImportant" in workload.value) {
    blob.maxDailyHighPriorityTasks = workload.value.maxImportant;
  }
  return blob;
}

export async function loadSchedulingPrefs(
  userId: Types.ObjectId,
): Promise<Map<PreferenceType, SchedulingPreference>> {
  const docs = await SchedulingPreferenceModel.find({ userId }).lean<SchedulingPreference[]>();
  return new Map(docs.map((doc) => [doc.type, doc]));
}

export async function getAdapterTimezone(userId: Types.ObjectId): Promise<string> {
  const user = await UserModel.findById(userId).lean();
  return user?.timezone ?? process.env.TIMEZONE ?? "Asia/Kolkata";
}

export { hourToHm, hmToHour, ADAPTER_PREFERENCE_TYPES };
