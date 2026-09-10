import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import path from "node:path";
import dotenv from "dotenv";
import { connectDb } from "../db";
import { createUserContext, CreateContextOptions } from "./context";
import { handleMcpError } from "./errors";
import { registerCalendarModule } from "./modules/calendar";
import { ToolRegistry } from "./registry";
import { executeToolCall } from "./transport";
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
      capabilities: {
        tools: {},
      },
    },
  );

  sdkServer.setRequestHandler(ListToolsRequestSchema, async () => {
    const { tools } = mcpServer.discoverTools();
    return {
      tools: tools.map((t) => ({
        name: t.name,
        description: t.description,
        inputSchema: t.inputSchema as any,
      })),
    };
  });

  sdkServer.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    try {
      const ctx = createUserContext({ jwt: process.env.RYTHAM_JWT });
      const result = await mcpServer.executeTool(name, args, ctx);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
      };
    } catch (err) {
      const result = handleMcpError(err);
      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  const transport = new StdioServerTransport();
  await sdkServer.connect(transport);
}

if (require.main === module) {
  runStdioServer().catch((err) => {
    console.error("[MCP] Fatal Stdio Server error:", err);
    process.exit(1);
  });
}
