import { Types } from "mongoose";
import { Tool, UserContext } from "../../mcp/manifest";
import { ToolRegistry } from "../../mcp/registry";
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
      date: { type: "string" },
      timezone: { type: "string" },
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
      date: { type: "string" },
      timezone: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      insights: { type: "array" },
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
      date: { type: "string" },
      timezone: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      summary: { type: "string" },
      trends: { type: "array" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseReflectionMonthlyInput(input);
    const service = getService(ctx);
    return service.monthly(parsed);
  },
};

export const reflectionTools: Tool[] = [
  dailyReflectionTool,
  weeklyReflectionTool,
  monthlyReflectionTool,
];

export function registerReflectionModule(registry: ToolRegistry): void {
  reflectionTools.forEach((t) => registry.registerTool(t));
}
