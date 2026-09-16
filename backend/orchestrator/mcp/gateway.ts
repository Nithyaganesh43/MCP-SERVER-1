import { isMcpSessionError, McpClient } from "./client";
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
    let recoveredSession = false;

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
      } catch (err: unknown) {
        lastError = err;

        if (!recoveredSession && isMcpSessionError(err)) {
          recoveredSession = true;
          this.client.clearSession();
          await this.client.initializeSession();
          continue;
        }

        const isTemporaryError =
          err instanceof MCPConnectionError || err instanceof MCPTimeoutError;

        if (isTemporaryError && attempts < this.maxRetries) {
          attempts++;
          continue;
        }

        console.log("[MCP] Failed");
        if (err instanceof GatewayError) {
          throw err;
        }
        const message = err instanceof Error ? err.message : String(err);
        throw new MCPExecutionError(`MCP tool execution failed: ${message}`, tool);
      }
    }

    console.log("[MCP] Failed");
    if (lastError instanceof GatewayError) {
      throw lastError;
    }
    const message =
      lastError instanceof Error ? lastError.message : String(lastError);
    throw new MCPExecutionError(
      `MCP tool execution failed after retries: ${message}`,
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

    if (Array.isArray(result.content) && result.content.length > 0) {
      const textItem = result.content.find((item) => item.type === "text");
      if (textItem && textItem.text) {
        try {
          const parsed = JSON.parse(textItem.text) as Record<string, unknown>;
          if (parsed && typeof parsed === "object") {
            if ("success" in parsed && parsed.success === false) {
              const errorValue = parsed.error;
              const errorText =
                typeof errorValue === "string"
                  ? errorValue
                  : errorValue &&
                      typeof errorValue === "object" &&
                      "message" in errorValue &&
                      typeof (errorValue as { message: unknown }).message === "string"
                    ? (errorValue as { message: string }).message
                    : "Tool execution failed";
              return {
                success: false,
                error: errorText,
                data: parsed.data as T,
                metadata: parsed.metadata as Record<string, unknown> | undefined,
              };
            }
            return {
              success: (parsed.success as boolean | undefined) ?? true,
              data: (parsed.data ?? parsed) as T,
              error: typeof parsed.error === "string" ? parsed.error : undefined,
              metadata: parsed.metadata as Record<string, unknown> | undefined,
            };
          }
        } catch {
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

export async function execute<T = unknown>(
  tool: string,
  payload: Record<string, unknown> = {},
): Promise<ToolResult<T>> {
  return mcpGateway.execute<T>(tool, payload);
}
