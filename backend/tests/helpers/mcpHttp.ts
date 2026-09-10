import express from "express";
import request from "supertest";
import { createMcpHttpApp } from "../../mcp/httpTransport";

export const TEST_MCP_API_KEY = "rk_test_abc123def456";

/**
 * Create a minimal Express app with MCP HTTP mounted for testing.
 * Sets MCP_API_KEY env var for the auth middleware.
 */
export function getMcpTestApp(): express.Express {
  const app = express();

  // Health endpoint (no auth)
  app.get("/health", (_req, res) => {
    res.json({ ok: true });
  });

  // MCP endpoint (with API key auth)
  app.use("/mcp", createMcpHttpApp());

  return app;
}

/**
 * Create headers with a valid MCP API key.
 */
export function mcpHeaders(
  apiKey: string = TEST_MCP_API_KEY,
  jwt?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json, text/event-stream",
    "X-MCP-API-Key": apiKey,
  };
  if (jwt) {
    headers.Authorization = `Bearer ${jwt}`;
  }
  return headers;
}

export function mcpCallHeaders(
  sessionId: string,
  jwt?: string,
  apiKey: string = TEST_MCP_API_KEY,
): Record<string, string> {
  return {
    ...mcpHeaders(apiKey, jwt),
    "Mcp-Session-Id": sessionId,
  };
}

export async function mcpInitializeSession(
  app: express.Express,
  jwt?: string,
): Promise<string> {
  const init = await request(app)
    .post("/mcp")
    .set(mcpHeaders(TEST_MCP_API_KEY, jwt))
    .send({
      jsonrpc: "2.0",
      id: 1,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });
  const sessionId = init.headers["mcp-session-id"];
  if (typeof sessionId !== "string" || sessionId.length === 0) {
    throw new Error(
      `initialize did not return Mcp-Session-Id: ${init.status} ${init.text}`,
    );
  }
  await request(app)
    .post("/mcp")
    .set(mcpCallHeaders(sessionId, jwt))
    .send({ jsonrpc: "2.0", method: "notifications/initialized" });
  return sessionId;
}

export function parseMcpJsonRpc(res: {
  body: unknown;
  text: string;
}): Record<string, unknown> {
  return extractJsonRpc(res);
}

export function parseMcpToolEnvelope(res: {
  body: unknown;
  text: string;
}): {
  success: boolean;
  data?: unknown;
  error?: { code: string; message: string };
  isError?: boolean;
} {
  const rpc = extractJsonRpc(res);
  const result = rpc.result as
    | { content?: { text?: string }[]; isError?: boolean }
    | undefined;
  const text = result?.content?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error(
      `MCP tool result text is missing: ${JSON.stringify(rpc)}`,
    );
  }
  const envelope = JSON.parse(text) as {
    success: boolean;
    data?: unknown;
    error?: { code: string; message: string };
  };
  return { ...envelope, isError: result?.isError === true };
}

function extractJsonRpc(res: { body: unknown; text: string }): Record<string, unknown> {
  if (res.body && typeof res.body === "object" && !Array.isArray(res.body) && Object.keys(res.body as object).length > 0) {
    return res.body as Record<string, unknown>;
  }
  const raw = res.text;
  const dataLine = raw.split(/\r?\n/).find((line) => line.startsWith("data:"));
  if (dataLine) {
    return JSON.parse(dataLine.slice("data:".length).trim()) as Record<string, unknown>;
  }
  if (raw.trim().startsWith("{")) {
    return JSON.parse(raw) as Record<string, unknown>;
  }
  throw new Error(`MCP tool result text is missing: ${raw}`);
}
