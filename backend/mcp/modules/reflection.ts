import { Types } from "mongoose";
import { ToolRegistry } from "../registry";
import { Tool, UserContext } from "../manifest";
import { ReflectionService } from "../../reflection/service";
import {
  parseReflectionDailyInput,
  parseReflectionWeeklyInput,
  parseReflectionMonthlyInput,
} from "../../reflection/contract";

function getService(ctx: UserContext): ReflectionService {
  return new ReflectionService(new Types.ObjectId(ctx.userId));
}

export const dailyReflectionTool: Tool = {
  name: "reflection.daily",
  version: "1.0.0",
  description: "Generate a daily summary",
  permissions: ["reflection:read"],
  inputSchema: {
    type: "object",
    properties: {
      date: { 
        type: "string",
        description: "Date in YYYY-MM-DD format (defaults to today)"
      },
      timezone: { 
        type: "string",
        description: "IANA timezone (defaults to user's timezone)"
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      completed: { type: "number" },
      missed: { type: "number" },
      upcoming: { type: "number" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseReflectionDailyInput(input);
    const service = getService(ctx);
    return service.daily(parsed);
  },
};

export const weeklyReflectionTool: Tool = {
  name: "reflection.weekly",
  version: "1.0.0",
  description: "Generate weekly insights",
  permissions: ["reflection:read"],
  inputSchema: {
    type: "object",
    properties: {
      date: { 
        type: "string",
        description: "Date in YYYY-MM-DD format (defaults to current week)"
      },
      timezone: { 
        type: "string",
        description: "IANA timezone (defaults to user's timezone)"
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      insights: { 
        type: "array",
        items: { type: "string" }
      },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseReflectionWeeklyInput(input);
    const service = getService(ctx);
    return service.weekly(parsed);
  },
};

export const monthlyReflectionTool: Tool = {
  name: "reflection.monthly",
  version: "1.0.0",
  description: "Generate monthly progress and trends",
  permissions: ["reflection:read"],
  inputSchema: {
    type: "object",
    properties: {
      date: { 
        type: "string",
        description: "Date in YYYY-MM-DD format (defaults to current month)"
      },
      timezone: { 
        type: "string",
        description: "IANA timezone (defaults to user's timezone)"
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      trends: { 
        type: "array",
        items: { type: "string" }
      },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseReflectionMonthlyInput(input);
    const service = getService(ctx);
    return service.monthly(parsed);
  },
};

export function registerReflectionModule(registry: ToolRegistry): void {
  registry.registerTool(dailyReflectionTool);
  registry.registerTool(weeklyReflectionTool);
  registry.registerTool(monthlyReflectionTool);
}
