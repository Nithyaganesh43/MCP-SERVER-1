import mongoose, { Types, type ClientSession } from "mongoose";
import { HttpError } from "../errors";
import {
  ActivityHistoryModel,
  ActivityModel,
  DEFAULT_CATEGORY,
  DEFAULT_METADATA,
  DEFAULT_NOTE,
  DEFAULT_RECURRENCE,
  DEFAULT_REMINDERS,
  DEFAULT_TAGS,
  SchedulingPreferenceModel,
  UserModel,
  type Activity,
  type PreferenceType,
  type SchedulingPreference,
  type TimeWindow,
} from "../model/index";
import type {
  CalendarActivityView,
  CalendarCompleteInput,
  CalendarConflictView,
  CalendarConflictsInput,
  CalendarCreateInput,
  CalendarDeleteInput,
  CalendarListInput,
  CalendarRescheduleInput,
  CalendarRescueMissedInput,
  CalendarRolloverInput,
  CalendarSplitTaskInput,
  CalendarSuggestInput,
  CalendarUndoInput,
  CalendarUpdateInput,
  CalendarUserPreferencesBlob,
  CalendarUserPreferencesInput,
  CalendarWeeklySummaryInput,
} from "./contract";
import { toIso } from "./contract";
import {
  instancesOverlappingWindow,
  instancesStartingInWindow,
  type RecurrenceInstance,
} from "./recurrence";
import {
  MS_PER_MIN,
  addCalendarDays,
  dayBounds,
  formatHm,
  largestSlot,
  monthBounds,
  occupancy,
  overlaps,
  quietHoursOccupied,
  reserveFloatingGaps,
  weekBounds,
  zonedLocal,
  zonedYmd,
  type Occupied,
} from "./time";

function iso(value: Date | null | undefined): string | null {
  return toIso(value ?? null);
}

const ADAPTER_PREFERENCE_TYPES = [
  "quiet_hours",
  "learning_window",
  "focus_duration",
  "workload_limit",
] as const;

const DEFAULT_WORKLOAD_LIMIT = 3;
const DEFAULT_FOCUS_DURATION_MIN = 60;

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

function blobFromDocs(docs: SchedulingPreference[]): CalendarUserPreferencesBlob {
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
    startAt: iso(startAt),
    endAt: iso(endAt),
    durationMin: activity.schedule.durationMin,
    bufferBeforeMin: activity.schedule.bufferBeforeMin ?? null,
    bufferAfterMin: activity.schedule.bufferAfterMin ?? null,
    timezone: activity.schedule.timezone,
    flexibility: activity.behavior.flexibility,
    recurrence: {
      rule: activity.behavior.recurrence.rule,
      interval: activity.behavior.recurrence.interval,
      days: activity.behavior.recurrence.days,
      until: iso(activity.behavior.recurrence.until),
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

function objectId(activityId: string): Types.ObjectId {
  return new Types.ObjectId(activityId);
}

function supportsTransactions(): boolean {
  const options = mongoose.connection.getClient().options;
  return Boolean(options.replicaSet || options.srvHost);
}

export class CalendarService {
  constructor(private readonly userId: Types.ObjectId) {}

  private async loadSchedulingPrefs(): Promise<
    Map<PreferenceType, SchedulingPreference>
  > {
    const docs = await SchedulingPreferenceModel.find({
      userId: this.userId,
    }).lean<SchedulingPreference[]>();
    return new Map(docs.map((doc) => [doc.type, doc]));
  }

  private async adapterTimezone(): Promise<string> {
    const user = await UserModel.findById(this.userId).lean();
    return user?.timezone ?? process.env.TIMEZONE ?? "Asia/Kolkata";
  }

  async create(input: CalendarCreateInput): Promise<{
    success: true;
    activityId: string;
    message: string;
  }> {
    const recurrence = {
      rule: input.behavior.recurrence?.rule ?? DEFAULT_RECURRENCE.rule,
      interval: input.behavior.recurrence?.interval ?? DEFAULT_RECURRENCE.interval,
      days: input.behavior.recurrence?.days ?? [...DEFAULT_RECURRENCE.days],
      until: input.behavior.recurrence?.until ?? DEFAULT_RECURRENCE.until,
    };
    const created = await ActivityModel.create({
      userId: this.userId,
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

    // Check duplicate detection warning
    if (input.schedule.startAt) {
      const existing = await ActivityModel.findOne({
        userId: this.userId,
        _id: { $ne: created._id },
        title: input.title,
        "schedule.startAt": input.schedule.startAt,
        status: { $ne: "cancelled" },
      });
      if (existing) {
        message += " Warning: duplicate activity already exists at this time.";
      }
    }

    // Check daily capacity warning
    if (input.priority >= 4 && input.schedule.startAt) {
      const prefs = await this.loadSchedulingPrefs();
      const workload = prefs.get("workload_limit");
      const maxLimit =
        workload && "maxImportant" in workload.value
          ? workload.value.maxImportant
          : DEFAULT_WORKLOAD_LIMIT;
      const ymd = zonedYmd(input.schedule.startAt, input.schedule.timezone);
      const bounds = dayBounds(ymd, input.schedule.timezone);
      const highPriorityCount = await ActivityModel.countDocuments({
        userId: this.userId,
        _id: { $ne: created._id },
        priority: { $gte: 4 },
        status: { $ne: "cancelled" },
        "schedule.startAt": { $gte: bounds.start, $lt: bounds.end },
      });
      if (highPriorityCount >= maxLimit) {
        message += ` Today already has ${highPriorityCount} important tasks.`;
      }
    }

    // Record action for undo
    await ActivityHistoryModel.create({
      userId: this.userId,
      activityId: created._id,
      action: "create",
      previousState: null,
      newState: created.toObject(),
    });

    return {
      success: true,
      activityId: String(created._id),
      message,
    };
  }

  async update(input: CalendarUpdateInput): Promise<{
    success: true;
    activityId: string;
    message: string;
  }> {
    const current = await ActivityModel.findOne({
      _id: objectId(input.activityId),
      userId: this.userId,
    });
    if (!current) {
      throw new HttpError(404, "Activity not found");
    }
    const previousState = current.toObject();

    const updated = await ActivityModel.findOneAndUpdate(
      { _id: objectId(input.activityId), userId: this.userId },
      { $set: input.changes },
      { new: true, runValidators: true },
    );
    if (!updated) {
      throw new HttpError(404, "Activity not found");
    }

    await ActivityHistoryModel.create({
      userId: this.userId,
      activityId: updated._id,
      action: "update",
      previousState,
      newState: updated.toObject(),
    });

    return {
      success: true,
      activityId: String(updated._id),
      message: `${updated.title} updated.`,
    };
  }

  async delete(input: CalendarDeleteInput): Promise<{ success: true }> {
    const current = await ActivityModel.findOne({
      _id: objectId(input.activityId),
      userId: this.userId,
    });
    if (!current) {
      throw new HttpError(404, "Activity not found");
    }
    const previousState = current.toObject();

    const result = await ActivityModel.deleteOne({
      _id: objectId(input.activityId),
      userId: this.userId,
    });
    if (result.deletedCount === 0) {
      throw new HttpError(404, "Activity not found");
    }

    await ActivityHistoryModel.create({
      userId: this.userId,
      activityId: current._id,
      action: "delete",
      previousState,
      newState: null,
    });

    return { success: true };
  }

  async list(input: CalendarListInput): Promise<{ activities: CalendarActivityView[] }> {
    const bounds = this.listBounds(input);
    const docs = await ActivityModel.find({
      userId: this.userId,
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
    activities.sort((a, b) => {
      const left = a.startAt ?? "";
      const right = b.startAt ?? "";
      return left.localeCompare(right);
    });
    return { activities };
  }

  async complete(input: CalendarCompleteInput): Promise<{ status: "done" }> {
    const current = await ActivityModel.findOne({
      _id: objectId(input.activityId),
      userId: this.userId,
    });
    if (!current) {
      throw new HttpError(404, "Activity not found");
    }
    const previousState = current.toObject();

    const updated = await ActivityModel.findOneAndUpdate(
      { _id: objectId(input.activityId), userId: this.userId },
      { $set: { status: "done" } },
      { new: true },
    );
    if (!updated) {
      throw new HttpError(404, "Activity not found");
    }

    await ActivityHistoryModel.create({
      userId: this.userId,
      activityId: current._id,
      action: "complete",
      previousState,
      newState: updated.toObject(),
    });

    return { status: "done" };
  }

  async reschedule(input: CalendarRescheduleInput): Promise<{
    success: true;
    newEndAt: string | null;
  }> {
    if (!supportsTransactions()) {
      return this.applyReschedule(input);
    }
    const session = await mongoose.startSession();
    try {
      const result = await session.withTransaction(() =>
        this.applyReschedule(input, session),
      );
      return result;
    } finally {
      await session.endSession();
    }
  }

  private async applyReschedule(
    input: CalendarRescheduleInput,
    session?: ClientSession,
  ): Promise<{
    success: true;
    newEndAt: string | null;
  }> {
    const current = await ActivityModel.findOne({
      _id: objectId(input.activityId),
      userId: this.userId,
    }).session(session ?? null);
    if (!current) {
      throw new HttpError(404, "Activity not found");
    }
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
    const $set: { "schedule.startAt": Date; "schedule.endAt": Date | null } = {
      "schedule.startAt": input.newStartAt,
      "schedule.endAt": newEndAt,
    };
    const updated = await ActivityModel.findOneAndUpdate(
      {
        _id: objectId(input.activityId),
        userId: this.userId,
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
          userId: this.userId,
          activityId: current._id,
          action: "reschedule",
          previousState,
          newState: updated.toObject(),
        },
      ],
      { session: session ?? null },
    );

    return { success: true, newEndAt: iso(newEndAt) };
  }

  async undo(_input?: CalendarUndoInput): Promise<{
    success: boolean;
    message: string;
  }> {
    const entry = await ActivityHistoryModel.findOneAndDelete(
      { userId: this.userId },
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

  async userPreferences(input: CalendarUserPreferencesInput): Promise<{
    success: boolean;
    preferences: CalendarUserPreferencesBlob;
  }> {
    if (input.action === "get") {
      const docs = await SchedulingPreferenceModel.find({
        userId: this.userId,
        type: { $in: [...ADAPTER_PREFERENCE_TYPES] },
      }).lean<SchedulingPreference[]>();
      return { success: true, preferences: blobFromDocs(docs) };
    }

    const blob = input.preferences ?? {};
    const timezone = await this.adapterTimezone();
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
      upserts.push({
        type: "focus_duration",
        value: { durationMin: blob.focusDurationMin },
      });
    }
    if (blob.maxDailyHighPriorityTasks !== undefined) {
      present.add("workload_limit");
      upserts.push({
        type: "workload_limit",
        value: { maxImportant: blob.maxDailyHighPriorityTasks },
      });
    }

    const absent = ADAPTER_PREFERENCE_TYPES.filter((type) => !present.has(type));
    if (absent.length > 0) {
      await SchedulingPreferenceModel.deleteMany({
        userId: this.userId,
        type: { $in: [...absent] },
      });
    }
    for (const row of upserts) {
      await SchedulingPreferenceModel.findOneAndUpdate(
        { userId: this.userId, type: row.type },
        {
          userId: this.userId,
          type: row.type,
          value: row.value,
          timezone,
        },
        { upsert: true, new: true, runValidators: true },
      );
    }

    const docs = await SchedulingPreferenceModel.find({
      userId: this.userId,
      type: { $in: [...ADAPTER_PREFERENCE_TYPES] },
    }).lean<SchedulingPreference[]>();
    return { success: true, preferences: blobFromDocs(docs) };
  }

  async conflicts(input: CalendarConflictsInput): Promise<{
    conflicts: CalendarConflictView[];
  }> {
    const window = { start: input.startAt, end: input.endAt };
    const searchStart = new Date(input.startAt.getTime() - 24 * 60 * MS_PER_MIN);
    const searchEnd = new Date(input.endAt.getTime() + 24 * 60 * MS_PER_MIN);
    const docs = await ActivityModel.find({
      userId: this.userId,
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

  async suggestSlot(input: CalendarSuggestInput): Promise<{
    suggestedStart: string | null;
    suggestedEnd: string | null;
    reason: string;
  }> {
    const prefs = await this.loadSchedulingPrefs();
    const bounds = dayBounds(input.date, input.timezone);
    const docs = await ActivityModel.find({
      userId: this.userId,
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
        if (!slot) {
          continue;
        }
        busy.push({ start: slot.start, end: slot.end, title: doc.title });
      }
    }

    const reserved = reserveFloatingGaps(bounds.start, bounds.end, busy, floaters);

    let preferredWindow: { start: Date; end: Date } | undefined;
    const learning = prefs.get("learning_window");
    const learningWindow = learning ? asTimeWindow(learning.value) : null;
    if (learningWindow) {
      const pStart = zonedLocal(
        input.date,
        `${learningWindow.start}:00`,
        input.timezone,
      );
      const pEnd = zonedLocal(
        input.date,
        `${learningWindow.end}:00`,
        input.timezone,
      );
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

  async splitTask(input: CalendarSplitTaskInput): Promise<{
    title: string;
    totalDurationMin: number;
    chunkMin: number;
    chunks: { date: string; startAt: string; endAt: string }[];
  }> {
    const prefs = await this.loadSchedulingPrefs();
    const focus = prefs.get("focus_duration");
    const storedFocus =
      focus && "durationMin" in focus.value ? focus.value.durationMin : undefined;
    const chunkMin = input.maxChunkMin ?? storedFocus ?? DEFAULT_FOCUS_DURATION_MIN;
    const numChunks = Math.ceil(input.totalDurationMin / chunkMin);
    const startDate = input.date ?? zonedYmd(new Date(), input.timezone);
    const chunks: { date: string; startAt: string; endAt: string }[] = [];
    let currentDate = startDate;

    for (let i = 0; i < numChunks; i += 1) {
      const remainingMin = Math.min(
        chunkMin,
        input.totalDurationMin - i * chunkMin,
      );
      const suggested = await this.suggestSlot({
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

    return {
      title: input.title,
      totalDurationMin: input.totalDurationMin,
      chunkMin,
      chunks,
    };
  }

  async rescueMissed(input: CalendarRescueMissedInput): Promise<{
    rescuedCount: number;
    rescued: { activityId: string; title: string; newStartAt?: string }[];
  }> {
    const date = input.date ?? zonedYmd(new Date(), input.timezone);
    const bounds = dayBounds(date, input.timezone);
    const missedDocs = await ActivityModel.find({
      userId: this.userId,
      status: "pending",
      "schedule.startAt": { $ne: null, $lt: bounds.start },
    }).lean<Activity[]>();

    const rescued: { activityId: string; title: string; newStartAt?: string }[] = [];
    for (const doc of missedDocs) {
      if (doc.behavior.flexibility === "fixed") {
        continue;
      }
      if (input.autoReschedule) {
        const slot = await this.suggestSlot({
          date,
          durationMin: doc.schedule.durationMin ?? 60,
          timezone: input.timezone,
        });
        if (slot.suggestedStart) {
          const newStartAt = zonedLocal(date, `${slot.suggestedStart}:00`, input.timezone);
          await this.applyReschedule({
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
      rescued.push({
        activityId: String(doc._id),
        title: doc.title,
      });
    }

    return { rescuedCount: rescued.length, rescued };
  }

  async rollover(input: CalendarRolloverInput): Promise<{
    movedCount: number;
    activities: { activityId: string; title: string }[];
  }> {
    const todayYmd = zonedYmd(new Date(), input.timezone);
    const targetDate = input.targetDate ?? addCalendarDays(todayYmd, 1);
    const bounds = dayBounds(todayYmd, input.timezone);

    const pendingPast = await ActivityModel.find({
      userId: this.userId,
      status: "pending",
      $or: [
        { "schedule.startAt": { $ne: null, $lt: bounds.start } },
        { "behavior.flexibility": "floating", "schedule.startAt": null },
      ],
    }).lean<Activity[]>();

    const moved: { activityId: string; title: string }[] = [];
    for (const doc of pendingPast) {
      if (doc.behavior.flexibility === "fixed") {
        continue;
      }
      const slot = await this.suggestSlot({
        date: targetDate,
        durationMin: doc.schedule.durationMin ?? 30,
        timezone: input.timezone,
      });
      if (slot.suggestedStart) {
        const newStartAt = zonedLocal(targetDate, `${slot.suggestedStart}:00`, input.timezone);
        await this.applyReschedule({
          activityId: String(doc._id),
          newStartAt,
          reason: "End-of-day rollover",
        });
        moved.push({ activityId: String(doc._id), title: doc.title });
      }
    }

    return { movedCount: moved.length, activities: moved };
  }

  async weeklySummary(input: CalendarWeeklySummaryInput): Promise<{
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
        userId: this.userId,
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

  private listBounds(input: CalendarListInput): { start: Date; end: Date } {
    if (input.range === "custom") {
      return { start: input.startAt as Date, end: input.endAt as Date };
    }
    const date = input.date as string;
    if (input.range === "day") {
      return dayBounds(date, input.timezone);
    }
    if (input.range === "week") {
      return weekBounds(date, input.timezone);
    }
    return monthBounds(date, input.timezone);
  }
}
