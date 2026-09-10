import { ToolResponseEnvelope, UserContext } from "./manifest";
import { ToolRegistry } from "./registry";
import { hasPermissions } from "./auth";
import { ERROR_CODES, createErrorEnvelope, handleMcpError } from "./errors";

export async function executeToolCall(
  toolName: string,
  input: unknown,
  ctx: UserContext,
  registry: ToolRegistry = ToolRegistry.getInstance(),
): Promise<ToolResponseEnvelope> {
  try {
    const tool = registry.getTool(toolName);
    if (!tool) {
      return createErrorEnvelope(
        ERROR_CODES.NOT_FOUND,
        `Tool '${toolName}' not found`,
      );
    }

    if (!hasPermissions(ctx, tool.permissions)) {
      return createErrorEnvelope(
        ERROR_CODES.FORBIDDEN,
        `Permission denied for tool '${toolName}'`,
      );
    }

    // AI input must never override userId
    if (typeof input === "object" && input !== null && "userId" in input) {
      return createErrorEnvelope(
        ERROR_CODES.VALIDATION_ERROR,
        "userId must not be provided in tool input",
      );
    }

    const result = await tool.execute(input, ctx);
    return {
      success: true,
      data: result,
    };
  } catch (err) {
    return handleMcpError(err);
  }
}
