import { Tool, ToolManifest } from "./manifest";
import { McpError, ERROR_CODES } from "./errors";

export class ToolRegistry {
  private static instance: ToolRegistry;
  private readonly tools = new Map<string, Tool>();

  public static getInstance(): ToolRegistry {
    if (!ToolRegistry.instance) {
      ToolRegistry.instance = new ToolRegistry();
    }
    return ToolRegistry.instance;
  }

  public registerTool(tool: Tool): void {
    if (!tool.name || !tool.name.includes(".")) {
      throw new McpError(
        ERROR_CODES.VALIDATION_ERROR,
        `Invalid tool name '${tool.name}'. Must follow '<module>.<action>' format.`,
      );
    }
    if (this.tools.has(tool.name)) {
      throw new McpError(
        ERROR_CODES.VALIDATION_ERROR,
        `Tool collision: tool '${tool.name}' is already registered.`,
      );
    }
    this.tools.set(tool.name, tool);
  }

  public getTool(name: string): Tool | undefined {
    return this.tools.get(name);
  }

  public discoverTools(): { tools: ToolManifest[] } {
    const manifests: ToolManifest[] = Array.from(this.tools.values()).map(
      (tool) => ({
        name: tool.name,
        version: tool.version,
        description: tool.description,
        permissions: tool.permissions,
        inputSchema: tool.inputSchema,
        outputSchema: tool.outputSchema,
      }),
    );
    return { tools: manifests };
  }

  public clearRegistry(): void {
    this.tools.clear();
  }
}
