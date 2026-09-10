import express, { type Request, type Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { createMcpServer } from "./server";
import { createUserContext } from "./context";
import { requireMcpApiKey } from "./apiKeyAuth";
import { generateRequestId, logMcpRequest, startTimer } from "./logger";

/**
 * Create an Express sub-app that serves MCP over Streamable HTTP.
 *
 * Mount this at `/mcp` on the main Express app:
 *   app.use("/mcp", createMcpHttpApp());
 *
 * The transport is stateless — each POST creates a new session.
 * API Key auth is enforced via the requireMcpApiKey middleware.
 */
export function createMcpHttpApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(requireMcpApiKey());

  const mcpServer = createMcpServer();

  // Handle MCP POST requests (JSON-RPC over HTTP)
  app.post("/", async (req: Request, res: Response) => {
    const requestId = generateRequestId();
    const timer = startTimer();

    try {
      const sdkServer = createSdkServer(mcpServer, requestId);
      const transport = new StreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });

      await sdkServer.connect(transport);
      await transport.handleRequest(req, res, req.body);
      await sdkServer.close();

      logMcpRequest({
        requestId,
        tool: extractToolName(req.body),
        status: "success",
        durationMs: timer.stop(),
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      logMcpRequest({
        requestId,
        tool: extractToolName(req.body),
        status: "error",
        durationMs: timer.stop(),
        timestamp: new Date().toISOString(),
        error: err instanceof Error ? err.message : "Unknown error",
      });

      // Only send error response if headers haven't been sent
      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
    }
  });

  // Handle SSE GET requests for server-to-client notifications
  app.get("/", async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    const sdkServer = createSdkServer(mcpServer, generateRequestId());
    await sdkServer.connect(transport);
    await transport.handleRequest(req, res);
  });

  // Handle DELETE for session teardown (stateless, but still accept gracefully)
  app.delete("/", async (req: Request, res: Response) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
    });
    await transport.handleRequest(req, res);
  });

  return app;
}

/**
 * Create an MCP SDK Server wired to our tool registry and context.
 */
function createSdkServer(
  mcpServer: ReturnType<typeof createMcpServer>,
  requestId: string,
): Server {
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
    const timer = startTimer();

    // Resolve user context from MCP_USER_ID or RYTHAM_JWT
    const ctx = createUserContext({
      userId: process.env.MCP_USER_ID,
      jwt: process.env.RYTHAM_JWT,
    });

    const result = await mcpServer.executeTool(name, args, ctx);

    logMcpRequest({
      requestId,
      tool: name,
      status: result.success ? "success" : "error",
      durationMs: timer.stop(),
      timestamp: new Date().toISOString(),
      ...(result.success ? {} : { error: result.error.message }),
    });

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  });

  return sdkServer;
}

/**
 * Extract tool name from JSON-RPC request body for logging.
 * Returns null if not a tool call or body is malformed.
 */
function extractToolName(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;

  // Handle batched requests
  if (Array.isArray(body)) {
    const toolCall = body.find(
      (msg: any) => msg.method === "tools/call",
    );
    return toolCall?.params?.name ?? null;
  }

  const msg = body as Record<string, unknown>;
  if (msg.method === "tools/call") {
    const params = msg.params as Record<string, unknown> | undefined;
    return (params?.name as string) ?? null;
  }
  return null;
}
