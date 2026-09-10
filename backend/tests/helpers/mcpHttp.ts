import express from "express";
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
): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "X-MCP-API-Key": apiKey,
  };
}
