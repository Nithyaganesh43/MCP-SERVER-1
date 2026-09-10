import express, { type Request, type Response } from "express";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  createMcpServer,
  MCP_CAPABILITIES,
  wireMcpSdkHandlers,
} from "./server";
import {
  createUserContextFromRequestAuthorization,
  runWithRequestAuthorization,
} from "./context";
import { requireMcpApiKey } from "./apiKeyAuth";
import { generateRequestId, logMcpRequest, startTimer } from "./logger";
import {
  generateSessionId,
  isInitializeRequest,
  McpSessionManager,
  readSessionId,
} from "./sessionManager";

/**
 * Create an Express sub-app that serves MCP over Streamable HTTP.
 *
 * Mount this at `/mcp` on the main Express app:
 *   app.use("/mcp", createMcpHttpApp());
 *
 * Sessions are stateful: initialize issues `Mcp-Session-Id`; later POST/GET/DELETE
 * reuse that transport. API Key auth is enforced via requireMcpApiKey.
 */
export function createMcpHttpApp(): express.Express {
  const app = express();
  app.use(express.json());
  app.use(requireMcpApiKey());

  const mcpServer = createMcpServer();
  const sessions = new McpSessionManager();

  const handleMcp = async (req: Request, res: Response) => {
    const requestId = generateRequestId();
    const timer = startTimer();
    const authorization =
      typeof req.headers.authorization === "string"
        ? req.headers.authorization
        : undefined;

    await runWithRequestAuthorization(authorization, async () => {
      try {
      const sessionId = readSessionId(req);
      const existing = sessionId ? sessions.get(sessionId) : undefined;

      if (existing) {
        await existing.transport.handleRequest(req, res, req.body);
        logMcpRequest({
          requestId,
          tool: extractToolName(req.body),
          status: "success",
          durationMs: timer.stop(),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (!sessionId && isInitializeRequest(req.body)) {
        const sdkServer = createSdkServer(mcpServer);
        const transport = new StreamableHTTPServerTransport({
          sessionIdGenerator: generateSessionId,
          onsessioninitialized: (id) => {
            sessions.set(id, { transport, sdkServer });
          },
        });

        transport.onclose = () => {
          const id = transport.sessionId;
          if (!id) {
            return;
          }
          const session = sessions.drop(id);
          void session?.sdkServer.close();
        };

        await sdkServer.connect(transport);
        await transport.handleRequest(req, res, req.body);
        logMcpRequest({
          requestId,
          tool: extractToolName(req.body),
          status: "success",
          durationMs: timer.stop(),
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (sessionId) {
        res.status(404).json({
          jsonrpc: "2.0",
          error: { code: -32001, message: "Session not found" },
          id: null,
        });
        return;
      }

      res.status(400).json({
        jsonrpc: "2.0",
        error: { code: -32000, message: "Bad Request: Session ID required" },
        id: null,
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

      if (!res.headersSent) {
        res.status(500).json({
          jsonrpc: "2.0",
          error: { code: -32603, message: "Internal server error" },
          id: null,
        });
      }
      }
    });
  };

  app.post("/", handleMcp);
  app.get("/", handleMcp);
  app.delete("/", handleMcp);

  return app;
}

/**
 * Create an MCP SDK Server wired to our tool registry and context.
 * One instance is kept for the life of a Streamable HTTP session.
 */
function createSdkServer(
  mcpServer: ReturnType<typeof createMcpServer>,
): Server {
  const sdkServer = new Server(
    {
      name: "rytham-mcp-server",
      version: "1.0.0",
    },
    {
      capabilities: MCP_CAPABILITIES,
    },
  );

  wireMcpSdkHandlers(
    sdkServer,
    mcpServer,
    () => createUserContextFromRequestAuthorization(),
    (name, result, durationMs) => {
      logMcpRequest({
        requestId: generateRequestId(),
        tool: name,
        status: result.success ? "success" : "error",
        durationMs,
        timestamp: new Date().toISOString(),
        ...(result.success ? {} : { error: result.error.message }),
      });
    },
  );

  return sdkServer;
}

/**
 * Extract tool name from JSON-RPC request body for logging.
 * Returns null if not a tool call or body is malformed.
 */
function extractToolName(body: unknown): string | null {
  if (!body || typeof body !== "object") return null;

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
