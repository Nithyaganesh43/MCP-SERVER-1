import { Types } from "mongoose";
import { Tool, UserContext } from "../../mcp/manifest";
import { ToolRegistry } from "../../mcp/registry";
import { CalendarIntelligenceService } from "../../calendar-intelligence/service";
import {
  parsePreferencesSaveInput,
  parsePreferencesGetInput,
  parsePreferencesUpdateInput,
  parsePreferencesDeleteInput,
  parseCapacityCheckInput,
  parseMissedReviewInput,
  parsePreviewInput,
} from "../../calendar-intelligence/contract";

function getService(ctx: UserContext): CalendarIntelligenceService {
  return new CalendarIntelligenceService(new Types.ObjectId(ctx.userId));
}

export const preferencesSaveTool: Tool = {
  name: "calendar.preferences.save",
  version: "1.0.0",
  description: "Save or update a scheduling preference",
  permissions: ["calendar:preferences:write"],
  inputSchema: {
    type: "object",
    required: ["type", "value"],
    properties: {
      type: {
        type: "string",
        enum: [
          "sleep_window",
          "learning_window",
          "quiet_hours",
          "commute",
          "workload_limit",
          "focus_duration",
          "exam_planning",
        ],
      },
      value: { type: "object" },
      timezone: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      preferenceId: { type: "string" },
      message: { type: "string" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parsePreferencesSaveInput(input, ctx.timezone ?? "Asia/Kolkata");
    const service = getService(ctx);
    return service.savePreference(parsed);
  },
};

export const preferencesGetTool: Tool = {
  name: "calendar.preferences.get",
  version: "1.0.0",
  description: "Retrieve scheduling preferences",
  permissions: ["calendar:preferences:read"],
  inputSchema: {
    type: "object",
    properties: {
      types: {
        type: "array",
        items: {
          type: "string",
          enum: [
            "sleep_window",
            "learning_window",
            "quiet_hours",
            "commute",
            "workload_limit",
            "focus_duration",
            "exam_planning",
          ],
        },
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      preferences: {
        type: "array",
        items: {
          type: "object",
          properties: {
            preferenceId: { type: "string" },
            type: { type: "string" },
            value: { type: "object" },
            timezone: { type: "string" },
            updatedAt: { type: "string" },
          },
        },
      },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parsePreferencesGetInput(input);
    const service = getService(ctx);
    return service.getPreferences(parsed);
  },
};

export const preferencesUpdateTool: Tool = {
  name: "calendar.preferences.update",
  version: "1.0.0",
  description: "Update an existing scheduling preference",
  permissions: ["calendar:preferences:write"],
  inputSchema: {
    type: "object",
    required: ["preferenceId", "value"],
    properties: {
      preferenceId: { type: "string" },
      value: { type: "object" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      preferenceId: { type: "string" },
      message: { type: "string" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parsePreferencesUpdateInput(input);
    const service = getService(ctx);
    return service.updatePreference(parsed);
  },
};

export const preferencesDeleteTool: Tool = {
  name: "calendar.preferences.delete",
  version: "1.0.0",
  description: "Delete a scheduling preference",
  permissions: ["calendar:preferences:delete"],
  inputSchema: {
    type: "object",
    required: ["preferenceId"],
    properties: {
      preferenceId: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parsePreferencesDeleteInput(input);
    const service = getService(ctx);
    return service.deletePreference(parsed);
  },
};

export const capacityCheckTool: Tool = {
  name: "calendar.capacity.check",
  version: "1.0.0",
  description: "Check if a day's workload exceeds the preferred limit",
  permissions: ["calendar:preferences:read"],
  inputSchema: {
    type: "object",
    required: ["date"],
    properties: {
      date: { type: "string" },
      timezone: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      exceedsLimit: { type: "boolean" },
      count: { type: "number" },
      limit: { type: ["number", "null"] },
      date: { type: "string" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseCapacityCheckInput(input, ctx.timezone ?? "Asia/Kolkata");
    const service = getService(ctx);
    return service.checkCapacity(parsed);
  },
};

export const missedReviewTool: Tool = {
  name: "calendar.missed.review",
  version: "1.0.0",
  description: "Find missed activities and suggest recovery",
  permissions: ["calendar:preferences:read"],
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
      missed: { type: "array" },
      suggestions: { type: "array" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseMissedReviewInput(input, ctx.timezone ?? "Asia/Kolkata");
    const service = getService(ctx);
    return service.reviewMissed(parsed);
  },
};

export const previewTool: Tool = {
  name: "calendar.preview",
  version: "1.0.0",
  description: "Generate a preview summary for a given day",
  permissions: ["calendar:preferences:read"],
  inputSchema: {
    type: "object",
    required: ["date"],
    properties: {
      date: { type: "string" },
      timezone: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      activities: { type: "array" },
      workload: { type: "object" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parsePreviewInput(input, ctx.timezone ?? "Asia/Kolkata");
    const service = getService(ctx);
    return service.preview(parsed);
  },
};

export const calendarIntelligenceTools: Tool[] = [
  preferencesSaveTool,
  preferencesGetTool,
  preferencesUpdateTool,
  preferencesDeleteTool,
  capacityCheckTool,
  missedReviewTool,
  previewTool,
];

export function registerCalendarIntelligenceModule(registry: ToolRegistry): void {
  calendarIntelligenceTools.forEach((t) => registry.registerTool(t));
}
