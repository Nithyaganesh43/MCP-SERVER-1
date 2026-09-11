import { McpClient } from "./client";
import {
  GatewayError,
  MCPConnectionError,
  MCPExecutionError,
  MCPParsingError,
  MCPTimeoutError,
} from "./errors";
import { MCPResponse, McpGatewayOptions, ToolResult } from "./types";

export class McpGateway {
  private client: McpClient;
  private maxRetries: number;

  constructor(options: McpGatewayOptions = {}) {
    this.client = new McpClient(options);
    this.maxRetries = options.maxRetries ?? 1;
  }

  public async execute<T = unknown>(
    tool: string,
    payload: Record<string, unknown> = {},
  ): Promise<ToolResult<T>> {
    console.log(`[MCP] ${tool}`);
    const startTime = Date.now();

    let attempts = 0;
    let lastError: unknown;

    while (attempts <= this.maxRetries) {
      if (attempts > 0) {
        console.log(`[MCP] Retry ${tool}`);
      }

      try {
        const response = await this.client.sendToolCall<T>(tool, payload);
        const result = this.normalizeResponse<T>(response, tool);
        const duration = Date.now() - startTime;
        console.log(`[MCP] Success (${duration}ms)`);
        return result;
      } catch (err: any) {
        lastError = err;

        // Retry only on temporary failures (ConnectionError or TimeoutError)
        const isTemporaryError =
          err instanceof MCPConnectionError || err instanceof MCPTimeoutError;

        if (isTemporaryError && attempts < this.maxRetries) {
          attempts++;
          continue;
        }

        // Non-temporary or retries exhausted
        console.log("[MCP] Failed");
        if (err instanceof GatewayError) {
          throw err;
        }
        throw new MCPExecutionError(
          `MCP tool execution failed: ${err?.message || String(err)}`,
          tool,
        );
      }
    }

    console.log("[MCP] Failed");
    if (lastError instanceof GatewayError) {
      throw lastError;
    }
    throw new MCPExecutionError(
      `MCP tool execution failed after retries: ${
        (lastError as any)?.message || String(lastError)
      }`,
      tool,
    );
  }

  private normalizeResponse<T>(
    response: MCPResponse<T>,
    tool: string,
  ): ToolResult<T> {
    if (response.error) {
      throw new MCPExecutionError(
        response.error.message || "MCP server returned execution error",
        tool,
      );
    }

    if (!response.result) {
      throw new MCPParsingError("MCP response missing result field", tool);
    }

    const result = response.result;

    if (result.isError) {
      let errMsg = "MCP tool call indicated error";
      if (Array.isArray(result.content) && result.content.length > 0) {
        errMsg = result.content.map((c) => c.text).join("; ");
      }
      throw new MCPExecutionError(errMsg, tool);
    }

    // Process standard MCP tool content envelope
    if (Array.isArray(result.content) && result.content.length > 0) {
      const textItem = result.content.find((item) => item.type === "text");
      if (textItem && textItem.text) {
        try {
          const parsed = JSON.parse(textItem.text);
          if (parsed && typeof parsed === "object") {
            if ("success" in parsed && parsed.success === false) {
              return {
                success: false,
                error: parsed.error?.message || parsed.error || "Tool execution failed",
                data: parsed.data as T,
                metadata: parsed.metadata,
              };
            }
            return {
              success: parsed.success ?? true,
              data: (parsed.data ?? parsed) as T,
              error: parsed.error,
              metadata: parsed.metadata,
            };
          }
        } catch (_) {
          // If not JSON, treat raw text as data
          return {
            success: true,
            data: textItem.text as unknown as T,
          };
        }
      }
    }

    return {
      success: true,
      data: result as unknown as T,
    };
  }
}

export const mcpGateway = new McpGateway();
