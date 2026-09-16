import {
  MCPConnectionError,
  MCPParsingError,
  MCPTimeoutError,
} from "./errors";
import { MCPRequest, MCPResponse, McpClientOptions } from "./types";

const DEFAULT_MCP_URL = "https://rytham-mcp.onrender.com/mcp";
const DEFAULT_TIMEOUT_MS = 10000;

export class McpClient {
  private mcpUrl: string;
  private apiKey?: string;
  private timeoutMs: number;
  private jwt?: string;
  private sessionId?: string;

  constructor(options: McpClientOptions = {}) {
    this.mcpUrl = options.mcpUrl || process.env.MCP_URL || DEFAULT_MCP_URL;
    this.apiKey = options.apiKey !== undefined ? options.apiKey : process.env.MCP_API_KEY;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.jwt = options.jwt;
  }

  public getApiKey(): string | undefined {
    return this.apiKey || process.env.MCP_API_KEY;
  }

  public getMcpUrl(): string {
    return this.mcpUrl || process.env.MCP_URL || DEFAULT_MCP_URL;
  }

  public getSessionId(): string | undefined {
    return this.sessionId;
  }

  public clearSession(): void {
    this.sessionId = undefined;
  }

  public async initializeSession(): Promise<string> {
    const requestId = `mcp-init-${Date.now()}`;
    const { response, json } = await this.postJson({
      jsonrpc: "2.0",
      id: requestId,
      method: "initialize",
      params: {
        protocolVersion: "2025-03-26",
        capabilities: {},
        clientInfo: { name: "rytham-orchestrator", version: "1.0.0" },
      },
    });

    const sessionId =
      response.headers?.get?.("mcp-session-id") ??
      response.headers?.get?.("Mcp-Session-Id") ??
      undefined;

    if (!sessionId) {
      throw new MCPConnectionError("MCP initialize did not return Mcp-Session-Id");
    }

    this.sessionId = sessionId;

    try {
      await this.postJson(
        {
          jsonrpc: "2.0",
          method: "notifications/initialized",
          params: {},
        },
        sessionId,
      );
    } catch {
      // notifications/initialized is best-effort
    }

    if (json && typeof json === "object" && "error" in json && json.error) {
      throw new MCPConnectionError(
        `MCP initialize failed: ${String((json.error as { message?: string }).message ?? "unknown")}`,
      );
    }

    return sessionId;
  }

  public async sendToolCall<T = unknown>(
    tool: string,
    payload: Record<string, unknown> = {},
    overrideTimeoutMs?: number,
  ): Promise<MCPResponse<T>> {
    const requestId = `mcp-req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const requestBody: MCPRequest = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name: tool,
        arguments: payload,
      },
      id: requestId,
    };

    const { json } = await this.postJson<MCPResponse<T>>(
      requestBody,
      this.sessionId,
      overrideTimeoutMs,
      tool,
    );

    if (!json || typeof json !== "object") {
      throw new MCPParsingError("Empty or malformed MCP response object", tool);
    }

    return json;
  }

  private headers(sessionId?: string): Record<string, string> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json, text/event-stream",
    };

    const currentApiKey = this.getApiKey();
    if (currentApiKey) {
      headers["x-mcp-api-key"] = currentApiKey;
      headers["x-api-key"] = currentApiKey;
      headers["X-MCP-API-Key"] = currentApiKey;
    }

    if (this.jwt) {
      headers.Authorization = `Bearer ${this.jwt}`;
    }

    if (sessionId) {
      headers["Mcp-Session-Id"] = sessionId;
    }

    return headers;
  }

  private async postJson<T = unknown>(
    body: Record<string, unknown> | MCPRequest,
    sessionId?: string,
    overrideTimeoutMs?: number,
    tool?: string,
  ): Promise<{ response: Response; json: T }> {
    const timeout = overrideTimeoutMs ?? this.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);
    const currentUrl = this.getMcpUrl();

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: "POST",
        headers: this.headers(sessionId),
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err: unknown) {
      clearTimeout(timer);
      const error = err as { name?: string; message?: string };
      if (error.name === "AbortError" || controller.signal.aborted) {
        throw new MCPTimeoutError(`Request to MCP server timed out after ${timeout}ms`, tool);
      }
      throw new MCPConnectionError(
        `Failed to connect to MCP server: ${error.message || String(err)}`,
        tool,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch {
        // ignore text parsing error
      }
      throw new MCPConnectionError(
        `MCP server returned HTTP status ${response.status} ${response.statusText}${
          errorText ? `: ${errorText}` : ""
        }`,
        tool,
      );
    }

    let json: T;
    try {
      json = await readMcpJson<T>(response, tool);
    } catch (err: unknown) {
      if (err instanceof MCPParsingError) {
        throw err;
      }
      const error = err as { message?: string };
      throw new MCPParsingError(
        `Invalid JSON response from MCP server: ${error.message || String(err)}`,
        tool,
      );
    }

    return { response, json };
  }
}

async function readMcpJson<T>(response: Response, tool?: string): Promise<T> {
  const contentType = response.headers?.get?.("content-type") ?? "";
  if (contentType.includes("event-stream")) {
    const text = await response.text();
    const dataLine = text.split(/\r?\n/).find((line) => line.startsWith("data:"));
    if (!dataLine) {
      throw new MCPParsingError("MCP SSE response missing data line", tool);
    }
    return JSON.parse(dataLine.slice("data:".length).trim()) as T;
  }

  return (await response.json()) as T;
}

export function isMcpSessionError(err: unknown): boolean {
  if (!(err instanceof MCPConnectionError)) {
    return false;
  }
  return /session id required/i.test(err.message) || /session not found/i.test(err.message);
}
