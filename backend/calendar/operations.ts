import mongoose, { Types, type ClientSession } from "mongoose";
import { HttpError } from "../shared/errors";
import {
  ActivityHistoryModel,
  ActivityModel,
  SchedulingPreferenceModel,
  type Activity,
  type SchedulingPreference,
} from "../model/index";
import {
  toIso,
  type CalendarRescheduleInput,
  type CalendarRescueMissedInput,
  type CalendarRolloverInput,
  type CalendarSplitTaskInput,
  type CalendarUndoInput,
  type CalendarUserPreferencesBlob,
  type CalendarUserPreferencesInput,
} from "./contract";
import { objectId, supportsTransactions } from "./crud";
import { suggestSlot } from "./conflicts";
import {
  blobFromDocs,
  getAdapterTimezone,
  hourToHm,
  loadSchedulingPrefs,
  ADAPTER_PREFERENCE_TYPES,
  DEFAULT_FOCUS_DURATION_MIN,
} from "./preferences";
import { MS_PER_MIN, addCalendarDays, dayBounds, zonedLocal, zonedYmd } from "./time";

export async function applyReschedule(
  userId: Types.ObjectId,
  input: CalendarRescheduleInput,
  session?: ClientSession,
): Promise<{ success: true; newEndAt: string | null }> {
  const current = await ActivityModel.findOne({
    _id: objectId(input.activityId),
    userId,
  }).session(session ?? null);
  if (!current) throw new HttpError(404, "Activity not found");
  if (current.behavior.flexibility === "fixed") {
    throw new HttpError(400, "Fixed activities cannot be rescheduled");
  }
  const previousState = current.toObject();
  const durationMin = current.schedule.durationMin;
  const previousStart = current.schedule.startAt;
  const previousEnd = current.schedule.endAt;
  let newEndAt: Date | null = null;
  if (durationMin != null) {
    newEndAt = new Date(input.newStartAt.getTime() + durationMin * MS_PER_MIN);
  } else if (previousStart && previousEnd) {
    const span = previousEnd.getTime() - previousStart.getTime();
    newEndAt = new Date(input.newStartAt.getTime() + span);
  } else {
    newEndAt = null;
  }
  const $set = {
    "schedule.startAt": input.newStartAt,
    "schedule.endAt": newEndAt,
  };
  const updated = await ActivityModel.findOneAndUpdate(
    {
      _id: objectId(input.activityId),
      userId,
      updatedAt: current.updatedAt,
    },
    { $set },
    { new: true, runValidators: true, session: session ?? null },
  );
  if (!updated) {
    throw new HttpError(409, "Activity was modified; retry reschedule");
  }

  await ActivityHistoryModel.create(
    [
      {
        userId,
        activityId: current._id,
        action: "reschedule",
        previousState,
        newState: updated.toObject(),
      },
    ],
    { session: session ?? null },
  );

  return { success: true, newEndAt: toIso(newEndAt) };
}

export async function rescheduleActivity(
  userId: Types.ObjectId,
  input: CalendarRescheduleInput,
): Promise<{ success: true; newEndAt: string | null }> {
  if (!supportsTransactions()) {
    return applyReschedule(userId, input);
  }
  const session = await mongoose.startSession();
  try {
    const result = await session.withTransaction(() => applyReschedule(userId, input, session));
    return result;
  } finally {
    await session.endSession();
  }
}

export async function undoLastAction(
  userId: Types.ObjectId,
  _input?: CalendarUndoInput,
): Promise<{ success: boolean; message: string }> {
  const entry = await ActivityHistoryModel.findOneAndDelete(
    { userId },
    { sort: { createdAt: -1 } },
  );
  if (!entry) {
    return { success: false, message: "Nothing to undo." };
  }
  if (entry.action === "create") {
    await ActivityModel.deleteOne({ _id: entry.activityId });
    return { success: true, message: "Reverted creation." };
  }
  if (entry.action === "delete" && entry.previousState) {
    await ActivityModel.create(entry.previousState);
    return { success: true, message: "Reverted deletion." };
  }
  if (
    (entry.action === "update" ||
      entry.action === "complete" ||
      entry.action === "reschedule") &&
    entry.previousState
  ) {
    await ActivityModel.replaceOne({ _id: entry.activityId }, entry.previousState);
    return { success: true, message: `Reverted ${entry.action}.` };
  }
  return { success: true, message: "Undo completed." };
}

export async function handleUserPreferences(
  userId: Types.ObjectId,
  input: CalendarUserPreferencesInput,
): Promise<{ success: boolean; preferences: CalendarUserPreferencesBlob }> {
  if (input.action === "get") {
    const docs = await SchedulingPreferenceModel.find({
      userId,
      type: { $in: [...ADAPTER_PREFERENCE_TYPES] },
    }).lean<SchedulingPreference[]>();
    return { success: true, preferences: blobFromDocs(docs) };
  }

  const blob = input.preferences ?? {};
  const timezone = await getAdapterTimezone(userId);
  const present = new Set<string>();
  const upserts: {
    type: (typeof ADAPTER_PREFERENCE_TYPES)[number];
    value: SchedulingPreference["value"];
  }[] = [];

  if (blob.quietHours) {
    present.add("quiet_hours");
    upserts.push({
      type: "quiet_hours",
      value: {
        start: hourToHm(blob.quietHours.startHour),
        end: hourToHm(blob.quietHours.endHour),
      },
    });
  }
  if (blob.bestLearningWindow) {
    present.add("learning_window");
    upserts.push({
      type: "learning_window",
      value: {
        start: hourToHm(blob.bestLearningWindow.startHour),
        end: hourToHm(blob.bestLearningWindow.endHour),
      },
    });
  }
  if (blob.focusDurationMin !== undefined) {
    present.add("focus_duration");
    upserts.push({ type: "focus_duration", value: { durationMin: blob.focusDurationMin } });
  }
  if (blob.maxDailyHighPriorityTasks !== undefined) {
    present.add("workload_limit");
    upserts.push({ type: "workload_limit", value: { maxImportant: blob.maxDailyHighPriorityTasks } });
  }

  const absent = ADAPTER_PREFERENCE_TYPES.filter((type) => !present.has(type));
  if (absent.length > 0) {
    await SchedulingPreferenceModel.deleteMany({
      userId,
      type: { $in: [...absent] },
    });
  }
  for (const row of upserts) {
    await SchedulingPreferenceModel.findOneAndUpdate(
      { userId, type: row.type },
      { userId, type: row.type, value: row.value, timezone },
      { upsert: true, new: true, runValidators: true },
    );
  }

  const docs = await SchedulingPreferenceModel.find({
    userId,
    type: { $in: [...ADAPTER_PREFERENCE_TYPES] },
  }).lean<SchedulingPreference[]>();
  return { success: true, preferences: blobFromDocs(docs) };
}

export async function splitTask(
  userId: Types.ObjectId,
  input: CalendarSplitTaskInput,
): Promise<{
  title: string;
  totalDurationMin: number;
  chunkMin: number;
  chunks: { date: string; startAt: string; endAt: string }[];
}> {
  const prefs = await loadSchedulingPrefs(userId);
  const focus = prefs.get("focus_duration");
  const storedFocus =
    focus && "durationMin" in focus.value ? focus.value.durationMin : undefined;
  const chunkMin = input.maxChunkMin ?? storedFocus ?? DEFAULT_FOCUS_DURATION_MIN;
  const numChunks = Math.ceil(input.totalDurationMin / chunkMin);
  const startDate = input.date ?? zonedYmd(new Date(), input.timezone);
  const chunks: { date: string; startAt: string; endAt: string }[] = [];
  let currentDate = startDate;

  for (let i = 0; i < numChunks; i += 1) {
    const remainingMin = Math.min(chunkMin, input.totalDurationMin - i * chunkMin);
    const suggested = await suggestSlot(userId, {
      date: currentDate,
      durationMin: remainingMin,
      timezone: input.timezone,
    });

    if (suggested.suggestedStart && suggested.suggestedEnd) {
      chunks.push({
        date: currentDate,
        startAt: `${currentDate}T${suggested.suggestedStart}:00`,
        endAt: `${currentDate}T${suggested.suggestedEnd}:00`,
      });
    }
    currentDate = addCalendarDays(currentDate, 1);
  }

  return { title: input.title, totalDurationMin: input.totalDurationMin, chunkMin, chunks };
}

export async function rescueMissed(
  userId: Types.ObjectId,
  input: CalendarRescueMissedInput,
): Promise<{
  rescuedCount: number;
  rescued: { activityId: string; title: string; newStartAt?: string }[];
}> {
  const date = input.date ?? zonedYmd(new Date(), input.timezone);
  const bounds = dayBounds(date, input.timezone);
  const missedDocs = await ActivityModel.find({
    userId,
    status: "pending",
    "schedule.startAt": { $ne: null, $lt: bounds.start },
  }).lean<Activity[]>();

  const rescued: { activityId: string; title: string; newStartAt?: string }[] = [];
  for (const doc of missedDocs) {
    if (doc.behavior.flexibility === "fixed") continue;
    if (input.autoReschedule) {
      const slot = await suggestSlot(userId, {
        date,
        durationMin: doc.schedule.durationMin ?? 60,
        timezone: input.timezone,
      });
      if (slot.suggestedStart) {
        const newStartAt = zonedLocal(date, `${slot.suggestedStart}:00`, input.timezone);
        await applyReschedule(userId, {
          activityId: String(doc._id),
          newStartAt,
          reason: "Missed task auto-rescue",
        });
        rescued.push({
          activityId: String(doc._id),
          title: doc.title,
          newStartAt: newStartAt.toISOString(),
        });
        continue;
      }
    }
    rescued.push({ activityId: String(doc._id), title: doc.title });
  }

  return { rescuedCount: rescued.length, rescued };
}

export async function rollover(
  userId: Types.ObjectId,
  input: CalendarRolloverInput,
): Promise<{
  movedCount: number;
  activities: { activityId: string; title: string }[];
}> {
  const todayYmd = zonedYmd(new Date(), input.timezone);
  const targetDate = input.targetDate ?? addCalendarDays(todayYmd, 1);
  const bounds = dayBounds(todayYmd, input.timezone);

  const pendingPast = await ActivityModel.find({
    userId,
    status: "pending",
    $or: [
      { "schedule.startAt": { $ne: null, $lt: bounds.start } },
      { "behavior.flexibility": "floating", "schedule.startAt": null },
    ],
  }).lean<Activity[]>();

  const moved: { activityId: string; title: string }[] = [];
  for (const doc of pendingPast) {
    if (doc.behavior.flexibility === "fixed") continue;
    const slot = await suggestSlot(userId, {
      date: targetDate,
      durationMin: doc.schedule.durationMin ?? 30,
      timezone: input.timezone,
    });
    if (slot.suggestedStart) {
      const newStartAt = zonedLocal(targetDate, `${slot.suggestedStart}:00`, input.timezone);
      await applyReschedule(userId, {
        activityId: String(doc._id),
        newStartAt,
        reason: "End-of-day rollover",
      });
      moved.push({ activityId: String(doc._id), title: doc.title });
    }
  }

  return { movedCount: moved.length, activities: moved };
}
