/**
 * Rytham V1 closed values. Do not add, remove, or rename without a spec version change.
 */

export const COLLECTION_ACTIVITIES = "activities" as const;
export const COLLECTION_USERS = "users" as const;

export const FLEXIBILITY = ["fixed", "moveable", "floating"] as const;
export type Flexibility = (typeof FLEXIBILITY)[number];

export const RECURRENCE_RULE = [
  "none",
  "daily",
  "weekly",
  "monthly",
  "yearly",
] as const;
export type RecurrenceRule = (typeof RECURRENCE_RULE)[number];

export const ACTIVITY_STATUS = [
  "pending",
  "done",
  "missed",
  "cancelled",
] as const;
export type ActivityStatus = (typeof ACTIVITY_STATUS)[number];

export const CREATED_BY = ["ai", "user", "system"] as const;
export type CreatedBy = (typeof CREATED_BY)[number];

export const PRIORITY = [1, 2, 3, 4, 5] as const;
export type Priority = (typeof PRIORITY)[number];

/** ISO-8601 weekday. 1 = Monday … 7 = Sunday. Spec example [1,3,5] = Mon/Wed/Fri. */
export const WEEKDAY = [1, 2, 3, 4, 5, 6, 7] as const;
export type Weekday = (typeof WEEKDAY)[number];

export const PRIORITY_MEANING = {
  5: "Critical",
  4: "Important",
  3: "Normal",
  2: "Optional",
  1: "Someday",
} as const satisfies Record<Priority, string>;

export const FLEXIBILITY_MEANING = {
  fixed: "Cannot move automatically",
  moveable: "AI may reschedule",
  floating: "AI chooses the best time",
} as const satisfies Record<Flexibility, string>;

export const STATUS_MEANING = {
  pending: "Not completed",
  done: "Completed",
  missed: "Time passed",
  cancelled: "Intentionally removed",
} as const satisfies Record<ActivityStatus, string>;

export const DEFAULT_NOTE = "";
export const DEFAULT_CATEGORY = "";
export const DEFAULT_STATUS: ActivityStatus = "pending";
export const DEFAULT_REMINDERS: [] = [];
export const DEFAULT_TAGS: [] = [];
export const DEFAULT_METADATA: Record<string, never> = {};
export const DEFAULT_RECURRENCE = {
  rule: "none" as RecurrenceRule,
  interval: 1,
  days: [] as number[],
  until: null as Date | null,
};

export const INDEXES = [
  { userId: 1, "schedule.startAt": 1 },
  { userId: 1, status: 1 },
  { userId: 1, priority: -1 },
  { userId: 1, status: 1, "schedule.startAt": 1 },
] as const;
