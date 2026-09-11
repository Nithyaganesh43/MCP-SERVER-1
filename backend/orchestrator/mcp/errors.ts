export class GatewayError extends Error {
  public readonly code: string;
  public readonly tool?: string;

  constructor(message: string, code = "GATEWAY_ERROR", tool?: string) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.tool = tool;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class MCPConnectionError extends GatewayError {
  constructor(message: string, tool?: string) {
    super(message, "MCP_CONNECTION_ERROR", tool);
  }
}

export class MCPTimeoutError extends GatewayError {
  constructor(message: string = "MCP tool execution timed out", tool?: string) {
    super(message, "MCP_TIMEOUT_ERROR", tool);
  }
}

export class MCPExecutionError extends GatewayError {
  constructor(message: string, tool?: string) {
    super(message, "MCP_EXECUTION_ERROR", tool);
  }
}

export class MCPParsingError extends GatewayError {
  constructor(message: string = "Failed to parse MCP server response", tool?: string) {
    super(message, "MCP_PARSING_ERROR", tool);
  }
}
