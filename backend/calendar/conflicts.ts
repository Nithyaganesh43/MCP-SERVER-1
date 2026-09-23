import type { Types } from "mongoose";
import { ActivityModel, type Activity } from "../model/index";
import type {
  CalendarConflictView,
  CalendarConflictsInput,
  CalendarSuggestInput,
  CalendarWeeklySummaryInput,
} from "./contract";
import { loadSchedulingPrefs } from "./preferences";
import { instancesOverlappingWindow } from "./recurrence";
import {
  MS_PER_MIN,
  addCalendarDays,
  dayBounds,
  formatHm,
  largestSlot,
  occupancy,
  overlaps,
  quietHoursOccupied,
  reserveFloatingGaps,
  zonedLocal,
  zonedYmd,
  type Occupied,
} from "./time";

function asTimeWindow(value: unknown): { start: string; end: string } | null {
  if (value && typeof value === "object" && "start" in value && "end" in value) {
    return value as { start: string; end: string };
  }
  return null;
}

export async function findConflicts(
  userId: Types.ObjectId,
  input: CalendarConflictsInput,
): Promise<{ conflicts: CalendarConflictView[] }> {
  const window = { start: input.startAt, end: input.endAt };
  const searchStart = new Date(input.startAt.getTime() - 24 * 60 * MS_PER_MIN);
  const searchEnd = new Date(input.endAt.getTime() + 24 * 60 * MS_PER_MIN);
  const docs = await ActivityModel.find({
    userId,
    status: "pending",
    "schedule.startAt": { $ne: null, $lt: searchEnd },
  }).lean<Activity[]>();
  const conflicts: CalendarConflictView[] = [];
  for (const doc of docs) {
    for (const instance of instancesOverlappingWindow(doc, { start: searchStart, end: searchEnd })) {
      const occ = occupancy(
        instance.startAt,
        instance.endAt,
        doc.schedule.durationMin,
        doc.schedule.bufferBeforeMin,
        doc.schedule.bufferAfterMin,
      );
      if (occ && overlaps(occ, window)) {
        conflicts.push({
          activityId: String(doc._id),
          title: doc.title,
          priority: doc.priority,
          flexibility: doc.behavior.flexibility,
        });
        break;
      }
    }
  }
  return { conflicts };
}

export async function suggestSlot(
  userId: Types.ObjectId,
  input: CalendarSuggestInput,
): Promise<{
  suggestedStart: string | null;
  suggestedEnd: string | null;
  reason: string;
}> {
  const prefs = await loadSchedulingPrefs(userId);
  const bounds = dayBounds(input.date, input.timezone);
  const docs = await ActivityModel.find({
    userId,
    status: "pending",
    $or: [
      { "schedule.startAt": { $ne: null, $lt: bounds.end } },
      {
        "behavior.flexibility": "floating",
        "schedule.startAt": null,
      },
    ],
  }).lean<Activity[]>();

  const busy: Occupied[] = [];
  const quiet = prefs.get("quiet_hours");
  const quietWindow = quiet ? asTimeWindow(quiet.value) : null;
  if (quietWindow) {
    busy.push(...quietHoursOccupied(input.date, input.timezone, quietWindow));
  }

  const floaters: { title: string; durationMin: number; priority: number }[] = [];
  for (const doc of docs) {
    if (
      doc.behavior.flexibility === "floating" &&
      !doc.schedule.startAt &&
      doc.schedule.durationMin != null
    ) {
      floaters.push({
        title: doc.title,
        durationMin: doc.schedule.durationMin,
        priority: doc.priority,
      });
      continue;
    }
    for (const instance of instancesOverlappingWindow(doc, bounds)) {
      const slot = occupancy(
        instance.startAt,
        instance.endAt,
        doc.schedule.durationMin,
        doc.schedule.bufferBeforeMin,
        doc.schedule.bufferAfterMin,
      );
      if (!slot) continue;
      busy.push({ start: slot.start, end: slot.end, title: doc.title });
    }
  }

  const reserved = reserveFloatingGaps(bounds.start, bounds.end, busy, floaters);

  let preferredWindow: { start: Date; end: Date } | undefined;
  const learning = prefs.get("learning_window");
  const learningWindow = learning ? asTimeWindow(learning.value) : null;
  if (learningWindow) {
    const pStart = zonedLocal(input.date, `${learningWindow.start}:00`, input.timezone);
    const pEnd = zonedLocal(input.date, `${learningWindow.end}:00`, input.timezone);
    if (pStart < pEnd) {
      preferredWindow = { start: pStart, end: pEnd };
    }
  }

  const found = largestSlot(
    bounds.start,
    bounds.end,
    [...busy, ...reserved],
    input.durationMin,
    preferredWindow ? { preferredWindow } : undefined,
  );

  if (!found) {
    return {
      suggestedStart: null,
      suggestedEnd: null,
      reason: `No free slot of ${input.durationMin} minutes.`,
    };
  }

  const isLearningSlot =
    preferredWindow &&
    found.start >= preferredWindow.start &&
    found.end <= preferredWindow.end;

  const reason = isLearningSlot
    ? "Suggested during your preferred learning window."
    : found.nextTitle
      ? `Largest free slot before ${found.nextTitle}.`
      : "Largest free slot.";

  return {
    suggestedStart: formatHm(found.start, input.timezone),
    suggestedEnd: formatHm(found.end, input.timezone),
    reason,
  };
}

export async function calculateWeeklySummary(
  userId: Types.ObjectId,
  input: CalendarWeeklySummaryInput,
): Promise<{
  days: { date: string; scheduledHours: number; isOverloaded: boolean }[];
  overloadedDays: string[];
  freeDay: string | null;
}> {
  const date = input.date ?? zonedYmd(new Date(), input.timezone);
  const weekStart = dayBounds(date, input.timezone).start;
  const weekStartYmd = zonedYmd(weekStart, input.timezone);
  const days: { date: string; scheduledHours: number; isOverloaded: boolean }[] = [];
  const overloadedDays: string[] = [];
  let minHours = Infinity;
  let freeDay: string | null = null;

  for (let i = 0; i < 7; i += 1) {
    const curYmd = addCalendarDays(weekStartYmd, i);
    const bounds = dayBounds(curYmd, input.timezone);
    const docs = await ActivityModel.find({
      userId,
      status: "pending",
      "schedule.startAt": { $gte: bounds.start, $lt: bounds.end },
    }).lean<Activity[]>();

    let totalMin = 0;
    for (const doc of docs) {
      totalMin += doc.schedule.durationMin ?? 30;
    }
    const hours = Number((totalMin / 60).toFixed(1));
    const isOverloaded = hours > 8;
    if (isOverloaded) {
      overloadedDays.push(curYmd);
    }
    if (hours < minHours) {
      minHours = hours;
      freeDay = curYmd;
    }
    days.push({ date: curYmd, scheduledHours: hours, isOverloaded });
  }

  return { days, overloadedDays, freeDay };
}
