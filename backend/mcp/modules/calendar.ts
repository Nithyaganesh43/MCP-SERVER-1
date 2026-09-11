import { Types } from "mongoose";
import { ToolRegistry } from "../registry";
import { Tool, UserContext } from "../manifest";
import { CalendarService } from "../../calendar/service";
import {
  parseCompleteInput,
  parseConflictsInput,
  parseCreateInput,
  parseDeleteInput,
  parseListInput,
  parseRescheduleInput,
  parseRescueMissedInput,
  parseRolloverInput,
  parseSplitTaskInput,
  parseSuggestInput,
  parseUndoInput,
  parseUpdateInput,
  parseUserPreferencesInput,
  parseWeeklySummaryInput,
} from "../../calendar/contract";

function getService(ctx: UserContext): CalendarService {
  return new CalendarService(new Types.ObjectId(ctx.userId));
}

export const createActivityTool: Tool = {
  name: "calendar.create",
  version: "1.0.0",
  description: "Create a calendar activity",
  permissions: ["calendar:write"],
  inputSchema: {
    type: "object",
    required: ["title", "schedule", "behavior", "priority"],
    properties: {
      title: { type: "string" },
      note: { type: "string" },
      category: { type: "string" },
      schedule: {
        type: "object",
        required: ["timezone"],
        properties: {
          startAt: { type: ["string", "null"] },
          endAt: { type: ["string", "null"] },
          durationMin: { type: ["number", "null"] },
          bufferBeforeMin: { type: ["number", "null"] },
          bufferAfterMin: { type: ["number", "null"] },
          timezone: { type: "string" },
        },
      },
      behavior: {
        type: "object",
        required: ["flexibility"],
        properties: {
          flexibility: { type: "string", enum: ["fixed", "moveable", "floating"] },
          recurrence: { type: "object" },
        },
      },
      priority: { type: "number", minimum: 1, maximum: 5 },
      reminders: { type: "array" },
      tags: { type: "array" },
      metadata: { type: "object" },
      createdBy: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      activityId: { type: "string" },
      message: { type: "string" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseCreateInput(input);
    const service = getService(ctx);
    return service.create(parsed);
  },
};

export const updateActivityTool: Tool = {
  name: "calendar.update",
  version: "1.0.0",
  description: "Update an existing calendar activity",
  permissions: ["calendar:write"],
  inputSchema: {
    type: "object",
    required: ["activityId", "changes"],
    properties: {
      activityId: { type: "string" },
      changes: { type: "object" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      activityId: { type: "string" },
      message: { type: "string" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseUpdateInput(input);
    const service = getService(ctx);
    return service.update(parsed);
  },
};

export const deleteActivityTool: Tool = {
  name: "calendar.delete",
  version: "1.0.0",
  description: "Delete a calendar activity",
  permissions: ["calendar:delete"],
  inputSchema: {
    type: "object",
    required: ["activityId"],
    properties: {
      activityId: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseDeleteInput(input);
    const service = getService(ctx);
    return service.delete(parsed);
  },
};

export const listActivitiesTool: Tool = {
  name: "calendar.list",
  version: "1.0.0",
  description: "Query activities by day, week, month, or custom date range",
  permissions: ["calendar:read"],
  inputSchema: {
    type: "object",
    required: ["range"],
    properties: {
      range: { type: "string", enum: ["day", "week", "month", "custom"] },
      date: { type: "string" },
      startAt: { type: "string" },
      endAt: { type: "string" },
      timezone: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      activities: { type: "array" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const raw = (input && typeof input === "object" ? input : {}) as Record<
      string,
      unknown
    >;
    const parsed = parseListInput(raw, ctx.timezone);
    const service = getService(ctx);
    return service.list(parsed);
  },
};

export const completeActivityTool: Tool = {
  name: "calendar.complete",
  version: "1.0.0",
  description: "Mark a calendar activity as complete",
  permissions: ["calendar:write"],
  inputSchema: {
    type: "object",
    required: ["activityId"],
    properties: {
      activityId: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      status: { type: "string", enum: ["done"] },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseCompleteInput(input);
    const service = getService(ctx);
    return service.complete(parsed);
  },
};

export const rescheduleActivityTool: Tool = {
  name: "calendar.reschedule",
  version: "1.0.0",
  description: "Move activity to a new start time",
  permissions: ["calendar:write"],
  inputSchema: {
    type: "object",
    required: ["activityId", "newStartAt"],
    properties: {
      activityId: { type: "string" },
      newStartAt: { type: "string" },
      reason: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      newEndAt: { type: ["string", "null"] },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseRescheduleInput(input);
    const service = getService(ctx);
    return service.reschedule(parsed);
  },
};

export const detectConflictsTool: Tool = {
  name: "calendar.conflicts",
  version: "1.0.0",
  description: "Detect activity overlaps within a startAt and endAt range",
  permissions: ["calendar:read"],
  inputSchema: {
    type: "object",
    required: ["startAt", "endAt"],
    properties: {
      startAt: { type: "string" },
      endAt: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      conflicts: { type: "array" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseConflictsInput(input);
    const service = getService(ctx);
    return service.conflicts(parsed);
  },
};

export const suggestSlotTool: Tool = {
  name: "calendar.suggest_slot",
  version: "1.0.0",
  description: "Find free time on a given date for a required duration",
  permissions: ["calendar:read"],
  inputSchema: {
    type: "object",
    required: ["date", "durationMin"],
    properties: {
      date: { type: "string" },
      durationMin: { type: "number" },
      timezone: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      suggestedStart: { type: ["string", "null"] },
      suggestedEnd: { type: ["string", "null"] },
      reason: { type: "string" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseSuggestInput(input, ctx.timezone);
    const service = getService(ctx);
    return service.suggestSlot(parsed);
  },
};

export const undoTool: Tool = {
  name: "calendar.undo",
  version: "1.0.0",
  description: "Undo the last calendar operation (create, update, delete, complete, reschedule)",
  permissions: ["calendar:write"],
  inputSchema: {
    type: "object",
    properties: {},
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      message: { type: "string" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseUndoInput(input);
    const service = getService(ctx);
    return service.undo(parsed);
  },
};

export const userPreferencesTool: Tool = {
  name: "calendar.user_preferences",
  version: "1.0.0",
  description: "Get or update user personal preferences (learning window, focus duration, quiet hours, etc.)",
  permissions: ["calendar:write"],
  inputSchema: {
    type: "object",
    required: ["action"],
    properties: {
      action: { type: "string", enum: ["get", "update"] },
      preferences: { type: "object" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      preferences: { type: "object" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseUserPreferencesInput(input);
    const service = getService(ctx);
    return service.userPreferences(parsed);
  },
};

export const splitTaskTool: Tool = {
  name: "calendar.split_task",
  version: "1.0.0",
  description: "Split long duration tasks into manageable focus chunks across days",
  permissions: ["calendar:read"],
  inputSchema: {
    type: "object",
    required: ["title", "totalDurationMin"],
    properties: {
      title: { type: "string" },
      totalDurationMin: { type: "number" },
      maxChunkMin: { type: "number" },
      date: { type: "string" },
      timezone: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      title: { type: "string" },
      totalDurationMin: { type: "number" },
      chunkMin: { type: "number" },
      chunks: { type: "array" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseSplitTaskInput(input, ctx.timezone);
    const service = getService(ctx);
    return service.splitTask(parsed);
  },
};

export const rescueMissedTool: Tool = {
  name: "calendar.rescue_missed",
  version: "1.0.0",
  description: "Find overdue pending tasks and optionally reschedule them",
  permissions: ["calendar:write"],
  inputSchema: {
    type: "object",
    properties: {
      autoReschedule: { type: "boolean" },
      date: { type: "string" },
      timezone: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      rescuedCount: { type: "number" },
      rescued: { type: "array" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseRescueMissedInput(input, ctx.timezone);
    const service = getService(ctx);
    return service.rescueMissed(parsed);
  },
};

export const rolloverTool: Tool = {
  name: "calendar.rollover",
  version: "1.0.0",
  description: "Rollover uncompleted floating or past pending tasks to tomorrow morning",
  permissions: ["calendar:write"],
  inputSchema: {
    type: "object",
    properties: {
      targetDate: { type: "string" },
      timezone: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      movedCount: { type: "number" },
      activities: { type: "array" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseRolloverInput(input, ctx.timezone);
    const service = getService(ctx);
    return service.rollover(parsed);
  },
};

export const weeklySummaryTool: Tool = {
  name: "calendar.weekly_summary",
  version: "1.0.0",
  description: "Analyze weekly workload capacity, detect overloaded days, and recommend free days",
  permissions: ["calendar:read"],
  inputSchema: {
    type: "object",
    properties: {
      date: { type: "string" },
      timezone: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      days: { type: "array" },
      overloadedDays: { type: "array" },
      freeDay: { type: ["string", "null"] },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseWeeklySummaryInput(input, ctx.timezone);
    const service = getService(ctx);
    return service.weeklySummary(parsed);
  },
};

export function registerCalendarModule(registry: ToolRegistry): void {
  registry.registerTool(createActivityTool);
  registry.registerTool(updateActivityTool);
  registry.registerTool(deleteActivityTool);
  registry.registerTool(listActivitiesTool);
  registry.registerTool(completeActivityTool);
  registry.registerTool(rescheduleActivityTool);
  registry.registerTool(detectConflictsTool);
  registry.registerTool(suggestSlotTool);
  registry.registerTool(undoTool);
  registry.registerTool(userPreferencesTool);
  registry.registerTool(splitTaskTool);
  registry.registerTool(rescueMissedTool);
  registry.registerTool(rolloverTool);
  registry.registerTool(weeklySummaryTool);
}
