import {
  type ActivityStatus,
  type CreatedBy,
  type Flexibility,
  type Priority,
  type RecurrenceRule,
} from "../model/index";

export const CALENDAR_TOOLS = [
  "calendar.create",
  "calendar.update",
  "calendar.delete",
  "calendar.list",
  "calendar.complete",
  "calendar.reschedule",
  "calendar.conflicts",
  "calendar.suggest_slot",
  "calendar.undo",
  "calendar.user_preferences",
  "calendar.split_task",
  "calendar.rescue_missed",
  "calendar.rollover",
  "calendar.weekly_summary",
] as const;

export type CalendarTool = (typeof CALENDAR_TOOLS)[number];

export const LIST_RANGE = ["day", "week", "month", "custom"] as const;
export type ListRange = (typeof LIST_RANGE)[number];

export const REST_TO_TOOL = {
  "POST /activities": "calendar.create",
  "PATCH /activities/:id": "calendar.update",
  "DELETE /activities/:id": "calendar.delete",
  "GET /activities": "calendar.list",
  "POST /activities/:id/complete": "calendar.complete",
  "POST /activities/:id/reschedule": "calendar.reschedule",
  "POST /calendar/conflicts": "calendar.conflicts",
  "POST /calendar/suggest-slot": "calendar.suggest_slot",
  "POST /calendar/undo": "calendar.undo",
  "POST /calendar/user-preferences": "calendar.user_preferences",
  "POST /calendar/split-task": "calendar.split_task",
  "POST /calendar/rescue-missed": "calendar.rescue_missed",
  "POST /calendar/rollover": "calendar.rollover",
  "POST /calendar/weekly-summary": "calendar.weekly_summary",
} as const;

export const ALLOWED_UPDATE_PATHS = [
  "title",
  "note",
  "category",
  "schedule.startAt",
  "schedule.endAt",
  "schedule.durationMin",
  "schedule.bufferBeforeMin",
  "schedule.bufferAfterMin",
  "schedule.timezone",
  "behavior.flexibility",
  "behavior.recurrence.rule",
  "behavior.recurrence.interval",
  "behavior.recurrence.days",
  "behavior.recurrence.until",
  "priority",
  "reminders",
  "status",
  "tags",
  "metadata",
] as const;

export type CalendarCreateInput = {
  title: string;
  note?: string;
  category?: string;
  schedule: {
    startAt?: Date | null;
    endAt?: Date | null;
    durationMin?: number | null;
    bufferBeforeMin?: number | null;
    bufferAfterMin?: number | null;
    timezone: string;
  };
  behavior: {
    flexibility: Flexibility;
    recurrence?: {
      rule?: RecurrenceRule;
      interval?: number;
      days?: number[];
      until?: Date | null;
    };
  };
  priority: Priority;
  reminders?: { beforeMin: number }[];
  tags?: string[];
  metadata?: Record<string, unknown>;
  createdBy?: CreatedBy;
};

export type CalendarUpdateInput = {
  activityId: string;
  changes: Record<string, unknown>;
};

export type CalendarRescheduleInput = {
  activityId: string;
  newStartAt: Date;
  reason?: string;
};

export type CalendarListInput = {
  range: ListRange;
  date?: string;
  startAt?: Date;
  endAt?: Date;
  timezone: string;
};

export type CalendarCompleteInput = { activityId: string };
export type CalendarDeleteInput = { activityId: string; deleteFutureRecurrences?: boolean };
export type CalendarConflictsInput = { startAt: Date; endAt: Date };

export type CalendarSuggestInput = {
  date: string;
  durationMin: number;
  timezone: string;
};

export type CalendarUndoInput = Record<string, never>;

export type CalendarUserPreferencesBlob = {
  quietHours?: { startHour: number; endHour: number };
  bestLearningWindow?: { startHour: number; endHour: number };
  focusDurationMin?: number;
  maxDailyHighPriorityTasks?: number;
};

export type CalendarUserPreferencesInput = {
  action: "get" | "update";
  preferences?: CalendarUserPreferencesBlob;
};

export type CalendarSplitTaskInput = {
  title: string;
  totalDurationMin: number;
  maxChunkMin?: number;
  date?: string;
  timezone: string;
};

export type CalendarRescueMissedInput = {
  autoReschedule?: boolean;
  date?: string;
  timezone: string;
};

export type CalendarRolloverInput = {
  targetDate?: string;
  timezone: string;
};

export type CalendarWeeklySummaryInput = {
  date?: string;
  timezone: string;
};

export type CalendarActivityView = {
  activityId: string;
  title: string;
  note: string;
  category: string;
  startAt: string | null;
  endAt: string | null;
  durationMin: number | null;
  bufferBeforeMin: number | null;
  bufferAfterMin: number | null;
  timezone: string;
  flexibility: Flexibility;
  recurrence: {
    rule: RecurrenceRule;
    interval: number;
    days: number[];
    until: string | null;
  };
  priority: Priority;
  reminders: { beforeMin: number }[];
  status: string;
  tags: string[];
  metadata: Record<string, unknown>;
  createdBy: CreatedBy;
  createdAt: string;
  updatedAt: string;
};

export type CalendarConflictView = {
  activityId: string;
  title: string;
  priority: Priority;
  flexibility: Flexibility;
};
