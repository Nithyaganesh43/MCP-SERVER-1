export interface MCPRequest {
  jsonrpc: "2.0";
  method: string;
  params: {
    name: string;
    arguments?: Record<string, unknown>;
  };
  id: string | number;
}

export interface MCPResponse<T = unknown> {
  jsonrpc: "2.0";
  result?: {
    content?: Array<{
      type: string;
      text: string;
    }>;
    isError?: boolean;
    [key: string]: unknown;
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  id: string | number | null;
}

export interface ToolResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  metadata?: Record<string, unknown>;
}

export interface McpClientOptions {
  mcpUrl?: string;
  apiKey?: string;
  timeoutMs?: number;
}

export interface McpGatewayOptions extends McpClientOptions {
  maxRetries?: number;
}
