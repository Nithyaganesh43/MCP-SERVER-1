import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  GetPromptRequestSchema,
  ListPromptsRequestSchema,
  ListResourceTemplatesRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import path from "node:path";
import dotenv from "dotenv";
import { connectDb } from "../db";
import { createUserContext, CreateContextOptions } from "./context";
import { handleMcpError } from "./errors";
import { registerCalendarModule } from "./modules/calendar";
import { ToolRegistry } from "./registry";
import { executeToolCall } from "./transport";
import { startTimer } from "./logger";
import { ToolManifest, ToolResponseEnvelope, UserContext } from "./manifest";

dotenv.config({ path: path.resolve(__dirname, "../.env") });

export class McpServer {
  private readonly registry: ToolRegistry;

  constructor(registry: ToolRegistry = ToolRegistry.getInstance()) {
    this.registry = registry;
  }

  public registerModule(
    registerFn: (registry: ToolRegistry) => void,
  ): void {
    registerFn(this.registry);
  }

  public discoverTools(): { tools: ToolManifest[] } {
    return this.registry.discoverTools();
  }

  public async executeTool(
    toolName: string,
    input: unknown,
    contextOptionsOrCtx?: CreateContextOptions | UserContext,
  ): Promise<ToolResponseEnvelope> {
    let ctx: UserContext;
    if (
      contextOptionsOrCtx &&
      "userId" in contextOptionsOrCtx &&
      "permissions" in contextOptionsOrCtx &&
      "timezone" in contextOptionsOrCtx
    ) {
      ctx = contextOptionsOrCtx as UserContext;
    } else {
      ctx = createUserContext(contextOptionsOrCtx as CreateContextOptions);
    }

    return executeToolCall(toolName, input, ctx, this.registry);
  }
}

export function createMcpServer(): McpServer {
  const server = new McpServer();
  server.registerModule(registerCalendarModule);
  return server;
}

export const MCP_CAPABILITIES = {
  tools: {},
  resources: {},
  prompts: {},
};

function toolCallPayload(result: ToolResponseEnvelope): {
  content: { type: "text"; text: string }[];
  isError?: true;
} {
  const payload: {
    content: { type: "text"; text: string }[];
    isError?: true;
  } = {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
  if (!result.success) {
    payload.isError = true;
  }
  return payload;
}

export function wireMcpSdkHandlers(
  sdkServer: Server,
  mcpServer: McpServer,
  getContext: () => UserContext,
  afterTool?: (
    name: string,
    result: ToolResponseEnvelope,
    durationMs: number,
  ) => void,
): void {
  sdkServer.setRequestHandler(ListToolsRequestSchema, async () => {
    const { tools } = mcpServer.discoverTools();
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as Record<string, unknown>,
      })),
    };
  });

  sdkServer.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [],
  }));

  sdkServer.setRequestHandler(ListResourceTemplatesRequestSchema, async () => ({
    resourceTemplates: [],
  }));

  sdkServer.setRequestHandler(ReadResourceRequestSchema, async () => ({
    contents: [],
  }));

  sdkServer.setRequestHandler(ListPromptsRequestSchema, async () => ({
    prompts: [],
  }));

  sdkServer.setRequestHandler(GetPromptRequestSchema, async () => ({
    messages: [],
  }));

  sdkServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    const timer = startTimer();
    try {
      const ctx = getContext();
      const result = await mcpServer.executeTool(name, args, ctx);
      afterTool?.(name, result, timer.stop());
      return toolCallPayload(result);
    } catch (err) {
      const result = handleMcpError(err);
      afterTool?.(name, result, timer.stop());
      return toolCallPayload(result);
    }
  });
}

export async function runStdioServer(): Promise<void> {
  if (process.env.MONGODB_URI) {
    try {
      await connectDb(process.env.MONGODB_URI);
    } catch (err) {
      // Allow inspector to load manifests even if DB is offline
      console.error("[MCP] Notice: DB connection deferred or failed", err);
    }
  }

  const mcpServer = createMcpServer();
  const sdkServer = new Server(
    {
      name: "rytham-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: MCP_CAPABILITIES,
    },
  );

  wireMcpSdkHandlers(sdkServer, mcpServer, () =>
    createUserContext({ jwt: process.env.RYTHAM_JWT }),
  );

  const transport = new StdioServerTransport();
  await sdkServer.connect(transport);
}

if (require.main === module) {
  runStdioServer().catch((err) => {
    console.error("[MCP] Fatal Stdio Server error:", err);
    process.exit(1);
  });
}
