import { Schema, model, type Model } from "mongoose";
import type { Activity } from "./activity.types";
import {
  ACTIVITY_STATUS,
  COLLECTION_ACTIVITIES,
  CREATED_BY,
  DEFAULT_CATEGORY,
  DEFAULT_METADATA,
  DEFAULT_NOTE,
  DEFAULT_RECURRENCE,
  DEFAULT_REMINDERS,
  DEFAULT_STATUS,
  DEFAULT_TAGS,
  FLEXIBILITY,
  INDEXES,
  PRIORITY,
  RECURRENCE_RULE,
} from "./constants";

const ReminderSchema = new Schema(
  {
    beforeMin: { type: Number, required: true, min: 0 },
  },
  { _id: false },
);

const RecurrenceSchema = new Schema(
  {
    rule: {
      type: String,
      required: true,
      enum: RECURRENCE_RULE,
      default: DEFAULT_RECURRENCE.rule,
    },
    interval: {
      type: Number,
      required: true,
      default: DEFAULT_RECURRENCE.interval,
      min: 1,
    },
    days: {
      type: [Number],
      required: true,
      default: () => [...DEFAULT_RECURRENCE.days],
      validate: {
        validator: (days: number[]) => days.every((d) => d >= 1 && d <= 7),
        message: "days must be ISO weekdays 1–7",
      },
    },
    until: { type: Date, default: null },
  },
  { _id: false },
);

const ScheduleSchema = new Schema(
  {
    startAt: { type: Date, default: null },
    endAt: { type: Date, default: null },
    durationMin: { type: Number, default: null, min: 0 },
    bufferBeforeMin: { type: Number, default: null, min: 0 },
    bufferAfterMin: { type: Number, default: null, min: 0 },
    timezone: { type: String, required: true },
  },
  { _id: false },
);

const BehaviorSchema = new Schema(
  {
    flexibility: {
      type: String,
      required: true,
      enum: FLEXIBILITY,
    },
    recurrence: {
      type: RecurrenceSchema,
      required: true,
      default: () => ({
        rule: DEFAULT_RECURRENCE.rule,
        interval: DEFAULT_RECURRENCE.interval,
        days: [...DEFAULT_RECURRENCE.days],
        until: DEFAULT_RECURRENCE.until,
      }),
    },
  },
  { _id: false },
);

export const ActivitySchema = new Schema<Activity>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    title: { type: String, required: true },
    note: { type: String, required: false, default: DEFAULT_NOTE },
    category: { type: String, required: false, default: DEFAULT_CATEGORY },
    schedule: { type: ScheduleSchema, required: true },
    behavior: { type: BehaviorSchema, required: true },
    priority: {
      type: Number,
      required: true,
      enum: PRIORITY,
    },
    reminders: {
      type: [ReminderSchema],
      default: () => [...DEFAULT_REMINDERS],
    },
    status: {
      type: String,
      required: true,
      enum: ACTIVITY_STATUS,
      default: DEFAULT_STATUS,
    },
    tags: { type: [String], default: () => [...DEFAULT_TAGS] },
    metadata: {
      type: Schema.Types.Mixed,
      default: () => ({ ...DEFAULT_METADATA }),
    },
    createdBy: {
      type: String,
      required: true,
      enum: CREATED_BY,
    },
  },
  {
    collection: COLLECTION_ACTIVITIES,
    timestamps: true,
    strict: true,
    versionKey: false,
    minimize: false,
  },
);

for (const index of INDEXES) {
  ActivitySchema.index({ ...index });
}

export const ActivityModel: Model<Activity> = model<Activity>(
  "Activity",
  ActivitySchema,
);
