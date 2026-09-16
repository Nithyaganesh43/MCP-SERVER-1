/**
 * Rytham V1 closed values. Do not add, remove, or rename without a spec version change.
 */

export const COLLECTION_ACTIVITIES = "activities" as const;
export const COLLECTION_USERS = "users" as const;
export const COLLECTION_ACTIVITY_HISTORIES = "activity_histories" as const;
export const COLLECTION_SCHEDULING_PREFERENCES = "scheduling_preferences" as const;
export const COLLECTION_MEMORIES = "memories" as const;
export const COLLECTION_CONVERSATION_STATES = "conversation_states" as const;
export const COLLECTION_MESSAGES = "messages" as const;
export const COLLECTION_USAGE = "usage" as const;

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

export const PREFERENCE_TYPE = [
  "sleep_window",
  "learning_window",
  "quiet_hours",
  "commute",
  "workload_limit",
  "focus_duration",
  "exam_planning",
] as const;
export type PreferenceType = (typeof PREFERENCE_TYPE)[number];

export const MEMORY_CATEGORY = [
  "preference",
  "habit",
  "goal",
  "relationship",
  "health",
  "temporary_preference",
] as const;
export type MemoryCategory = (typeof MEMORY_CATEGORY)[number];

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

export const PREFERENCE_TYPE_MEANING = {
  sleep_window: "Bedtime to wake time",
  learning_window: "Preferred study time",
  quiet_hours: "No meetings/calls",
  commute: "Travel buffer",
  workload_limit: "Max important tasks per day",
  focus_duration: "Default session length in minutes",
  exam_planning: "Revise before exams",
} as const satisfies Record<PreferenceType, string>;

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

export const DEFAULT_MEMORY_CONFIDENCE = 0.9;
export const DEFAULT_MEMORY_EXPIRES_AT: Date | null = null;
export const DEFAULT_CONVERSATION_MISSION = "";
export const DEFAULT_CONVERSATION_CONTEXT = "";
export const DEFAULT_CONVERSATION_ENTITIES: Record<string, never> = {};

export const MESSAGE_ROLE = ["user", "assistant"] as const;
export type MessageRole = (typeof MESSAGE_ROLE)[number];

export const DEFAULT_USAGE_REQUEST_COUNT = 0;
export const DEFAULT_USAGE_PROMPT_TOKENS = 0;
export const DEFAULT_USAGE_COMPLETION_TOKENS = 0;
export const DEFAULT_USAGE_TOTAL_TOKENS = 0;
export const DEFAULT_DEEPSEEK_URL = "https://api.deepseek.com/chat/completions";
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-chat";
export const DEFAULT_DEEPSEEK_TOKEN_BUDGET = 100_000;
export const DEEPSEEK_MAX_TOKENS = 256;

export const INDEXES = [
  { userId: 1, "schedule.startAt": 1 },
  { userId: 1, status: 1 },
  { userId: 1, priority: -1 },
  { userId: 1, status: 1, "schedule.startAt": 1 },
] as const;

export const INDEXES_SCHEDULING_PREFERENCES = [{ userId: 1, type: 1 }] as const;

export const INDEXES_MEMORIES = [{ userId: 1, category: 1 }] as const;

export const INDEXES_CONVERSATION_STATES = [{ userId: 1 }] as const;

export const INDEXES_MESSAGES = [{ userId: 1, createdAt: 1 }] as const;

export const INDEXES_USAGE = [{ userId: 1 }] as const;
