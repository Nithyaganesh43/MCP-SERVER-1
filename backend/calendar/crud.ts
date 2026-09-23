import mongoose, { Types } from "mongoose";
import { HttpError } from "../shared/errors";
import {
  ActivityHistoryModel,
  ActivityModel,
  DEFAULT_CATEGORY,
  DEFAULT_METADATA,
  DEFAULT_NOTE,
  DEFAULT_RECURRENCE,
  DEFAULT_REMINDERS,
  DEFAULT_TAGS,
  type Activity,
} from "../model/index";
import {
  toIso,
  type CalendarActivityView,
  type CalendarCompleteInput,
  type CalendarCreateInput,
  type CalendarDeleteInput,
  type CalendarListInput,
  type CalendarUpdateInput,
} from "./contract";
import { loadSchedulingPrefs, DEFAULT_WORKLOAD_LIMIT } from "./preferences";
import { instancesStartingInWindow, type RecurrenceInstance } from "./recurrence";
import {
  addCalendarDays,
  dayBounds,
  monthBounds,
  weekBounds,
  zonedYmd,
} from "./time";

export function objectId(activityId: string): Types.ObjectId {
  return new Types.ObjectId(activityId);
}

export function supportsTransactions(): boolean {
  const options = mongoose.connection.getClient().options;
  return Boolean(options.replicaSet || options.srvHost);
}

export function toView(
  activity: Activity,
  instance?: RecurrenceInstance,
): CalendarActivityView {
  const startAt = instance ? instance.startAt : activity.schedule.startAt;
  const endAt = instance ? instance.endAt : activity.schedule.endAt;
  return {
    activityId: String(activity._id),
    title: activity.title,
    note: activity.note,
    category: activity.category,
    startAt: toIso(startAt ?? null),
    endAt: toIso(endAt ?? null),
    durationMin: activity.schedule.durationMin,
    bufferBeforeMin: activity.schedule.bufferBeforeMin ?? null,
    bufferAfterMin: activity.schedule.bufferAfterMin ?? null,
    timezone: activity.schedule.timezone,
    flexibility: activity.behavior.flexibility,
    recurrence: {
      rule: activity.behavior.recurrence.rule,
      interval: activity.behavior.recurrence.interval,
      days: activity.behavior.recurrence.days,
      until: toIso(activity.behavior.recurrence.until),
    },
    priority: activity.priority,
    reminders: activity.reminders,
    status: activity.status,
    tags: activity.tags,
    metadata: activity.metadata ?? {},
    createdBy: activity.createdBy,
    createdAt: activity.createdAt.toISOString(),
    updatedAt: activity.updatedAt.toISOString(),
  };
}

export function listBounds(input: CalendarListInput): { start: Date; end: Date } {
  if (input.range === "custom") {
    return { start: input.startAt!, end: input.endAt! };
  }
  const dateStr = input.date!;
  const tz = input.timezone;
  if (input.range === "day") {
    return dayBounds(dateStr, tz);
  }
  if (input.range === "week") {
    return weekBounds(dateStr, tz);
  }
  return monthBounds(dateStr, tz);
}

export async function createActivity(
  userId: Types.ObjectId,
  input: CalendarCreateInput,
): Promise<{ success: true; activityId: string; message: string }> {
  const recurrence = {
    rule: input.behavior.recurrence?.rule ?? DEFAULT_RECURRENCE.rule,
    interval: input.behavior.recurrence?.interval ?? DEFAULT_RECURRENCE.interval,
    days: input.behavior.recurrence?.days ?? [...DEFAULT_RECURRENCE.days],
    until: input.behavior.recurrence?.until ?? DEFAULT_RECURRENCE.until,
  };
  const created = await ActivityModel.create({
    userId,
    title: input.title,
    note: input.note ?? DEFAULT_NOTE,
    category: input.category ?? DEFAULT_CATEGORY,
    schedule: {
      startAt: input.schedule.startAt ?? null,
      endAt: input.schedule.endAt ?? null,
      durationMin: input.schedule.durationMin ?? null,
      bufferBeforeMin: input.schedule.bufferBeforeMin ?? null,
      bufferAfterMin: input.schedule.bufferAfterMin ?? null,
      timezone: input.schedule.timezone,
    },
    behavior: {
      flexibility: input.behavior.flexibility,
      recurrence,
    },
    priority: input.priority,
    reminders: input.reminders ?? [...DEFAULT_REMINDERS],
    tags: input.tags ?? [...DEFAULT_TAGS],
    metadata: input.metadata ?? { ...DEFAULT_METADATA },
    createdBy: input.createdBy ?? "ai",
  });

  let message = `${created.title} added.`;

  if (input.schedule.startAt) {
    const existing = await ActivityModel.findOne({
      userId,
      _id: { $ne: created._id },
      title: input.title,
      "schedule.startAt": input.schedule.startAt,
      status: { $ne: "cancelled" },
    });
    if (existing) {
      message += " Warning: duplicate activity already exists at this time.";
    }
  }

  if (input.priority >= 4 && input.schedule.startAt) {
    const prefs = await loadSchedulingPrefs(userId);
    const workload = prefs.get("workload_limit");
    const maxLimit =
      workload && "maxImportant" in workload.value
        ? workload.value.maxImportant
        : DEFAULT_WORKLOAD_LIMIT;
    const ymd = zonedYmd(input.schedule.startAt, input.schedule.timezone);
    const bounds = dayBounds(ymd, input.schedule.timezone);
    const highPriorityCount = await ActivityModel.countDocuments({
      userId,
      _id: { $ne: created._id },
      priority: { $gte: 4 },
      status: { $ne: "cancelled" },
      "schedule.startAt": { $gte: bounds.start, $lt: bounds.end },
    });
    if (highPriorityCount >= maxLimit) {
      message += ` Today already has ${highPriorityCount} important tasks.`;
    }
  }

  await ActivityHistoryModel.create({
    userId,
    activityId: created._id,
    action: "create",
    previousState: null,
    newState: created.toObject(),
  });

  return { success: true, activityId: String(created._id), message };
}

export async function updateActivity(
  userId: Types.ObjectId,
  input: CalendarUpdateInput,
): Promise<{ success: true; activityId: string; message: string }> {
  const current = await ActivityModel.findOne({
    _id: objectId(input.activityId),
    userId,
  });
  if (!current) throw new HttpError(404, "Activity not found");
  const previousState = current.toObject();

  const updated = await ActivityModel.findOneAndUpdate(
    { _id: objectId(input.activityId), userId },
    { $set: input.changes },
    { new: true, runValidators: true },
  );
  if (!updated) throw new HttpError(404, "Activity not found");

  await ActivityHistoryModel.create({
    userId,
    activityId: updated._id,
    action: "update",
    previousState,
    newState: updated.toObject(),
  });

  return { success: true, activityId: String(updated._id), message: `${updated.title} updated.` };
}

export async function deleteActivity(
  userId: Types.ObjectId,
  input: CalendarDeleteInput,
): Promise<{ success: true }> {
  const current = await ActivityModel.findOne({
    _id: objectId(input.activityId),
    userId,
  });
  if (!current) throw new HttpError(404, "Activity not found");
  const previousState = current.toObject();

  const result = await ActivityModel.deleteOne({
    _id: objectId(input.activityId),
    userId,
  });
  if (result.deletedCount === 0) throw new HttpError(404, "Activity not found");

  await ActivityHistoryModel.create({
    userId,
    activityId: current._id,
    action: "delete",
    previousState,
    newState: null,
  });

  return { success: true };
}

export async function listActivities(
  userId: Types.ObjectId,
  input: CalendarListInput,
): Promise<{ activities: CalendarActivityView[] }> {
  const bounds = listBounds(input);
  const docs = await ActivityModel.find({
    userId,
    $or: [
      { "schedule.startAt": { $gte: bounds.start, $lt: bounds.end } },
      {
        "behavior.recurrence.rule": { $in: ["daily", "weekly", "monthly", "yearly"] },
        "schedule.startAt": { $ne: null, $lt: bounds.end },
        $or: [
          { "behavior.recurrence.until": null },
          { "behavior.recurrence.until": { $gte: bounds.start } },
        ],
      },
    ],
  }).lean<Activity[]>();
  const activities: CalendarActivityView[] = [];
  for (const doc of docs) {
    for (const instance of instancesStartingInWindow(doc, bounds)) {
      activities.push(toView(doc, instance));
    }
  }
  activities.sort((a, b) => (a.startAt ?? "").localeCompare(b.startAt ?? ""));
  return { activities };
}

export async function completeActivity(
  userId: Types.ObjectId,
  input: CalendarCompleteInput,
): Promise<{ status: "done" }> {
  const current = await ActivityModel.findOne({
    _id: objectId(input.activityId),
    userId,
  });
  if (!current) throw new HttpError(404, "Activity not found");
  const previousState = current.toObject();

  const updated = await ActivityModel.findOneAndUpdate(
    { _id: objectId(input.activityId), userId },
    { $set: { status: "done" } },
    { new: true },
  );
  if (!updated) throw new HttpError(404, "Activity not found");

  await ActivityHistoryModel.create({
    userId,
    activityId: current._id,
    action: "complete",
    previousState,
    newState: updated.toObject(),
  });

  return { status: "done" };
}
