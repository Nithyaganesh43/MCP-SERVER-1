import { Types } from "mongoose";
import { HttpError } from "../errors";
import {
  ActivityModel,
  DEFAULT_CATEGORY,
  DEFAULT_METADATA,
  DEFAULT_NOTE,
  DEFAULT_RECURRENCE,
  DEFAULT_REMINDERS,
  DEFAULT_TAGS,
  type Activity,
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
  CalendarSuggestInput,
  CalendarUpdateInput,
} from "./contract";
import { toIso } from "./contract";
import {
  MS_PER_MIN,
  dayBounds,
  largestSlot,
  monthBounds,
  occupancy,
  overlaps,
  weekBounds,
  formatHm,
  type Occupied,
} from "./time";

function iso(value: Date | null | undefined): string | null {
  return toIso(value ?? null);
}

export function toView(activity: Activity): CalendarActivityView {
  return {
    activityId: String(activity._id),
    title: activity.title,
    note: activity.note,
    category: activity.category,
    startAt: iso(activity.schedule.startAt),
    endAt: iso(activity.schedule.endAt),
    durationMin: activity.schedule.durationMin,
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

export class CalendarService {
  constructor(private readonly userId: Types.ObjectId) {}

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
    return {
      success: true,
      activityId: String(created._id),
      message: `${created.title} added.`,
    };
  }

  async update(input: CalendarUpdateInput): Promise<{
    success: true;
    activityId: string;
    message: string;
  }> {
    const updated = await ActivityModel.findOneAndUpdate(
      { _id: objectId(input.activityId), userId: this.userId },
      { $set: input.changes },
      { new: true, runValidators: true },
    );
    if (!updated) {
      throw new HttpError(404, "Activity not found");
    }
    return {
      success: true,
      activityId: String(updated._id),
      message: `${updated.title} updated.`,
    };
  }

  async delete(input: CalendarDeleteInput): Promise<{ success: true }> {
    const result = await ActivityModel.deleteOne({
      _id: objectId(input.activityId),
      userId: this.userId,
    });
    if (result.deletedCount === 0) {
      throw new HttpError(404, "Activity not found");
    }
    return { success: true };
  }

  async list(input: CalendarListInput): Promise<{ activities: CalendarActivityView[] }> {
    const bounds = this.listBounds(input);
    const docs = await ActivityModel.find({
      userId: this.userId,
      "schedule.startAt": { $gte: bounds.start, $lt: bounds.end },
    })
      .sort({ "schedule.startAt": 1 })
      .lean<Activity[]>();
    return { activities: docs.map(toView) };
  }

  async complete(input: CalendarCompleteInput): Promise<{ status: "done" }> {
    const updated = await ActivityModel.findOneAndUpdate(
      { _id: objectId(input.activityId), userId: this.userId },
      { $set: { status: "done" } },
      { new: true },
    );
    if (!updated) {
      throw new HttpError(404, "Activity not found");
    }
    return { status: "done" };
  }

  async reschedule(input: CalendarRescheduleInput): Promise<{
    success: true;
    newEndAt: string | null;
  }> {
    const current = await ActivityModel.findOne({
      _id: objectId(input.activityId),
      userId: this.userId,
    });
    if (!current) {
      throw new HttpError(404, "Activity not found");
    }
    if (current.behavior.flexibility === "fixed") {
      throw new HttpError(400, "Fixed activities cannot be rescheduled");
    }
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
      newEndAt = previousEnd;
    }
    current.schedule.startAt = input.newStartAt;
    if (newEndAt) {
      current.schedule.endAt = newEndAt;
    }
    await current.save();
    return { success: true, newEndAt: iso(newEndAt) };
  }

  async conflicts(input: CalendarConflictsInput): Promise<{
    conflicts: CalendarConflictView[];
  }> {
    const window = { start: input.startAt, end: input.endAt };
    const docs = await ActivityModel.find({
      userId: this.userId,
      status: "pending",
      "schedule.startAt": { $ne: null, $lt: input.endAt },
    }).lean<Activity[]>();
    const conflicts: CalendarConflictView[] = [];
    for (const doc of docs) {
      const slot = occupancy(
        doc.schedule.startAt,
        doc.schedule.endAt,
        doc.schedule.durationMin,
      );
      if (!slot || !overlaps(slot, window)) {
        continue;
      }
      conflicts.push({
        activityId: String(doc._id),
        title: doc.title,
        priority: doc.priority,
        flexibility: doc.behavior.flexibility,
      });
    }
    return { conflicts };
  }

  async suggestSlot(input: CalendarSuggestInput): Promise<{
    suggestedStart: string | null;
    suggestedEnd: string | null;
    reason: string;
  }> {
    const bounds = dayBounds(input.date, input.timezone);
    const docs = await ActivityModel.find({
      userId: this.userId,
      status: "pending",
      "schedule.startAt": { $ne: null, $lt: bounds.end },
    }).lean<Activity[]>();
    const busy: Occupied[] = [];
    for (const doc of docs) {
      const slot = occupancy(
        doc.schedule.startAt,
        doc.schedule.endAt,
        doc.schedule.durationMin,
      );
      if (!slot || !overlaps(slot, bounds)) {
        continue;
      }
      busy.push({ start: slot.start, end: slot.end, title: doc.title });
    }
    const found = largestSlot(bounds.start, bounds.end, busy, input.durationMin);
    if (!found) {
      return {
        suggestedStart: null,
        suggestedEnd: null,
        reason: `No free slot of ${input.durationMin} minutes.`,
      };
    }
    const reason = found.nextTitle
      ? `Largest free slot before ${found.nextTitle}.`
      : "Largest free slot.";
    return {
      suggestedStart: formatHm(found.start, input.timezone),
      suggestedEnd: formatHm(found.end, input.timezone),
      reason,
    };
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
