import { randomUUID } from "node:crypto";
import type { Request } from "express";
import type { Server } from "@modelcontextprotocol/sdk/server/index.js";
import type { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

export const MCP_SESSION_HEADER = "mcp-session-id";

export interface McpSession {
  transport: StreamableHTTPServerTransport;
  sdkServer: Server;
}

export function generateSessionId(): string {
  return randomUUID();
}

export function readSessionId(req: Request): string | undefined {
  const value = req.headers[MCP_SESSION_HEADER];
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

export function isInitializeRequest(body: unknown): boolean {
  if (Array.isArray(body)) {
    return body.some((item) => isInitializeRequest(item));
  }
  if (!body || typeof body !== "object") {
    return false;
  }
  const msg = body as { jsonrpc?: unknown; method?: unknown };
  return msg.jsonrpc === "2.0" && msg.method === "initialize";
}

/**
 * In-memory Streamable HTTP sessions. One transport + SDK server per session ID.
 */
export class McpSessionManager {
  private readonly sessions = new Map<string, McpSession>();

  get(sessionId: string): McpSession | undefined {
    return this.sessions.get(sessionId);
  }

  set(sessionId: string, session: McpSession): void {
    this.sessions.set(sessionId, session);
  }

  /**
   * Remove the map entry without closing the transport.
   * Use from `transport.onclose` so the transport is not closed twice.
   */
  drop(sessionId: string): McpSession | undefined {
    const session = this.sessions.get(sessionId);
    this.sessions.delete(sessionId);
    return session;
  }

  size(): number {
    return this.sessions.size;
  }
}
