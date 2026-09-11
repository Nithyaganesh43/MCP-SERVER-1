import { Types } from "mongoose";
import { ToolRegistry } from "../registry";
import { Tool, UserContext } from "../manifest";
import { ConversationService } from "../../karen/conversation/service";
import {
  parseConversationStateInput,
  parseConversationContextInput,
  parseConversationClearInput,
} from "../../karen/conversation/contract";

function getService(ctx: UserContext): ConversationService {
  return new ConversationService(new Types.ObjectId(ctx.userId));
}

export const conversationStateTool: Tool = {
  name: "conversation.state",
  version: "1.0.0",
  description: "Store temporary conversation context until it expires (mission, context, entity references)",
  permissions: ["conversation:write"],
  inputSchema: {
    type: "object",
    properties: {
      mission: { type: "string", description: "Current conversation objective" },
      context: { type: "string", description: "Additional context information" },
      entities: { type: "object", description: "Resolved entity references (e.g., 'it': 'activityId')" },
    },
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    const parsed = parseConversationStateInput(input);
    const service = getService(ctx);
    return service.setState(parsed);
  },
};

export const conversationContextTool: Tool = {
  name: "conversation.context",
  version: "1.0.0",
  description: "Retrieve the current conversation mission, context, and entity references",
  permissions: ["conversation:read"],
  inputSchema: {
    type: "object",
    properties: {},
  },
  outputSchema: {
    type: "object",
    properties: {
      mission: { type: "string" },
      context: { type: "string" },
      entities: { type: "object" },
      updatedAt: { type: "string" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    parseConversationContextInput(input);
    const service = getService(ctx);
    return service.getContext();
  },
};

export const conversationClearTool: Tool = {
  name: "conversation.clear",
  version: "1.0.0",
  description: "Clear the temporary conversation state",
  permissions: ["conversation:write"],
  inputSchema: {
    type: "object",
    properties: {},
  },
  outputSchema: {
    type: "object",
    properties: {
      success: { type: "boolean" },
    },
  },
  execute: async (input: unknown, ctx: UserContext) => {
    parseConversationClearInput(input);
    const service = getService(ctx);
    return service.clearState();
  },
};

export function registerConversationModule(registry: ToolRegistry): void {
  registry.registerTool(conversationStateTool);
  registry.registerTool(conversationContextTool);
  registry.registerTool(conversationClearTool);
}
