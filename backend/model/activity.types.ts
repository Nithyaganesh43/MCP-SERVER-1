import type { Types } from "mongoose";
import type {
  ActivityStatus,
  CreatedBy,
  Flexibility,
  Priority,
  RecurrenceRule,
} from "./constants";

export type {
  ActivityStatus,
  CreatedBy,
  Flexibility,
  Priority,
  RecurrenceRule,
};

export interface ActivitySchedule {
  startAt: Date | null;
  endAt: Date | null;
  durationMin: number | null;
  bufferBeforeMin?: number | null;
  bufferAfterMin?: number | null;
  timezone: string;
}

export interface ActivityRecurrence {
  rule: RecurrenceRule;
  interval: number;
  days: number[];
  until: Date | null;
}

export interface ActivityBehavior {
  flexibility: Flexibility;
  recurrence: ActivityRecurrence;
}

export interface ActivityReminder {
  beforeMin: number;
}

/** V1 activities document. Field set is closed. */
export interface Activity {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  title: string;
  note: string;
  category: string;
  schedule: ActivitySchedule;
  behavior: ActivityBehavior;
  priority: Priority;
  reminders: ActivityReminder[];
  status: ActivityStatus;
  tags: string[];
  metadata: Record<string, unknown>;
  createdBy: CreatedBy;
  createdAt: Date;
  updatedAt: Date;
}

export type ActivityCreateInput = Omit<Activity, "_id" | "createdAt" | "updatedAt">;
