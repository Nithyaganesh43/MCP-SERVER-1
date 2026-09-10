import crypto from "node:crypto";

export interface McpRequestLog {
  requestId: string;
  tool: string | null;
  status: "success" | "error" | "auth_failed";
  durationMs: number;
  timestamp: string;
  error?: string;
}

/**
 * Generate a unique request ID.
 */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Log a structured MCP request entry.
 * Never includes API keys, JWTs, or other sensitive data.
 */
export function logMcpRequest(entry: McpRequestLog): void {
  console.log(JSON.stringify(entry));
}

/**
 * Create a duration tracker — call `stop()` to get elapsed ms.
 */
export function startTimer(): { stop: () => number } {
  const start = performance.now();
  return {
    stop: () => Math.round(performance.now() - start),
  };
}
