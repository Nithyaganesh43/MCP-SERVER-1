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

  constructor(options: McpClientOptions = {}) {
    this.mcpUrl = options.mcpUrl || process.env.MCP_URL || DEFAULT_MCP_URL;
    this.apiKey = options.apiKey !== undefined ? options.apiKey : process.env.MCP_API_KEY;
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  public getApiKey(): string | undefined {
    return this.apiKey || process.env.MCP_API_KEY;
  }

  public getMcpUrl(): string {
    return this.mcpUrl || process.env.MCP_URL || DEFAULT_MCP_URL;
  }

  public async sendToolCall<T = unknown>(
    tool: string,
    payload: Record<string, unknown> = {},
    overrideTimeoutMs?: number,
  ): Promise<MCPResponse<T>> {
    const timeout = overrideTimeoutMs ?? this.timeoutMs;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeout);

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

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Accept: "application/json",
    };

    const currentApiKey = this.getApiKey();
    if (currentApiKey) {
      headers["x-mcp-api-key"] = currentApiKey;
      headers["x-api-key"] = currentApiKey;
    }

    const currentUrl = this.getMcpUrl();

    let response: Response;
    try {
      response = await fetch(currentUrl, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });
    } catch (err: any) {
      clearTimeout(timer);
      if (err.name === "AbortError" || controller.signal.aborted) {
        throw new MCPTimeoutError(`Request to MCP server timed out after ${timeout}ms`, tool);
      }
      throw new MCPConnectionError(
        `Failed to connect to MCP server: ${err?.message || String(err)}`,
        tool,
      );
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      let errorText = "";
      try {
        errorText = await response.text();
      } catch (_) {
        // ignore text parsing error
      }
      throw new MCPConnectionError(
        `MCP server returned HTTP status ${response.status} ${response.statusText}${
          errorText ? `: ${errorText}` : ""
        }`,
        tool,
      );
    }

    let jsonResponse: MCPResponse<T>;
    try {
      jsonResponse = (await response.json()) as MCPResponse<T>;
    } catch (err: any) {
      throw new MCPParsingError(
        `Invalid JSON response from MCP server: ${err?.message || String(err)}`,
        tool,
      );
    }

    if (!jsonResponse || typeof jsonResponse !== "object") {
      throw new MCPParsingError("Empty or malformed MCP response object", tool);
    }

    return jsonResponse;
  }
}
