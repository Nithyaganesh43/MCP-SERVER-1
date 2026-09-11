import { Types } from "mongoose";
import { ToolRegistry } from "../registry";
import { Tool, UserContext } from "../manifest";
import { MemoryService } from "../../karen/memory/service";
import {
  parseMemorySaveInput,
  parseMemorySearchInput,
  parseMemoryUpdateInput,
  parseMemoryDeleteInput,
  parseMemoryListInput,
} from "../../karen/memory/contract";

function getService(ctx: UserContext): MemoryService {
  return new MemoryService(new Types.ObjectId(ctx.userId));
}

export const memorySaveTool: Tool = {
  name: "memory.save",
  version: "1.0.0",
  description: "Save a personal memory with category and confidence score",
  permissions: ["memory:write"],
  inputSchema: {
    type: "object",
    required: ["category", "content"],
    properties: {
      category: {
        type: "string",
        enum: [
          "preference",
          "habit",
          "goal",
          "relationship",
          "health",
          "temporary_preference",
        ],
      },
      content: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
      expiresAt: { type: ["string", "null"] },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      memoryId: { type: "string" },
      message: { type: "string" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseMemorySaveInput(input);
    const service = getService(ctx);
    return service.save(parsed);
  },
};

export const memorySearchTool: Tool = {
  name: "memory.search",
  version: "1.0.0",
  description: "Search memories by content query with limit",
  permissions: ["memory:read"],
  inputSchema: {
    type: "object",
    required: ["query"],
    properties: {
      query: { type: "string" },
      limit: { type: "number", minimum: 1 },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      memories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            memoryId: { type: "string" },
            category: { type: "string" },
            content: { type: "string" },
            confidence: { type: "number" },
            updatedAt: { type: "string" },
          },
        },
      },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseMemorySearchInput(input);
    const service = getService(ctx);
    return service.search(parsed);
  },
};

export const memoryUpdateTool: Tool = {
  name: "memory.update",
  version: "1.0.0",
  description: "Update memory content or confidence score",
  permissions: ["memory:write"],
  inputSchema: {
    type: "object",
    required: ["memoryId"],
    properties: {
      memoryId: { type: "string" },
      content: { type: "string" },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
      memoryId: { type: "string" },
      message: { type: "string" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseMemoryUpdateInput(input);
    const service = getService(ctx);
    return service.update(parsed);
  },
};

export const memoryDeleteTool: Tool = {
  name: "memory.delete",
  version: "1.0.0",
  description: "Delete a memory by ID",
  permissions: ["memory:delete"],
  inputSchema: {
    type: "object",
    required: ["memoryId"],
    properties: {
      memoryId: { type: "string" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseMemoryDeleteInput(input);
    const service = getService(ctx);
    return service.delete(parsed);
  },
};

export const memoryListTool: Tool = {
  name: "memory.list",
  version: "1.0.0",
  description: "List all memories, optionally filtered by category",
  permissions: ["memory:read"],
  inputSchema: {
    type: "object",
    properties: {
      category: {
        type: "string",
        enum: [
          "preference",
          "habit",
          "goal",
          "relationship",
          "health",
          "temporary_preference",
        ],
      },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      memories: {
        type: "array",
        items: {
          type: "object",
          properties: {
            memoryId: { type: "string" },
            category: { type: "string" },
            content: { type: "string" },
            confidence: { type: "number" },
            expiresAt: { type: ["string", "null"] },
            updatedAt: { type: "string" },
          },
        },
      },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseMemoryListInput(input);
    const service = getService(ctx);
    return service.list(parsed);
  },
};

export function registerMemoryModule(registry: ToolRegistry): void {
  registry.registerTool(memorySaveTool);
  registry.registerTool(memorySearchTool);
  registry.registerTool(memoryUpdateTool);
  registry.registerTool(memoryDeleteTool);
  registry.registerTool(memoryListTool);
}
