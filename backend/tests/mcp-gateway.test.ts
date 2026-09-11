import {
  McpClient,
  McpGateway,
  MCPConnectionError,
  MCPExecutionError,
  MCPParsingError,
  MCPTimeoutError,
  mcpGateway,
} from "../orchestrator/mcp";

describe("MCP Gateway", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    jest.resetAllMocks();
    process.env.MCP_URL = "https://rytham-mcp.onrender.com/mcp";
    process.env.MCP_API_KEY = "test-secret-key";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  describe("McpClient", () => {
    it("attaches API key headers and POSTs to MCP_URL", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          result: { content: [{ type: "text", text: JSON.stringify({ success: true, eventId: "123" }) }] },
          id: "req-1",
        }),
      });
      global.fetch = mockFetch as any;

      const client = new McpClient({
        mcpUrl: "https://rytham-mcp.onrender.com/mcp",
        apiKey: "my-test-key",
      });

      const response = await client.sendToolCall("calendar.create", { title: "Gym" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toBe("https://rytham-mcp.onrender.com/mcp");
      expect(options.method).toBe("POST");
      expect(options.headers["x-mcp-api-key"]).toBe("my-test-key");
      expect(options.headers["x-api-key"]).toBe("my-test-key");
      expect(JSON.parse(options.body)).toEqual({
        jsonrpc: "2.0",
        method: "tools/call",
        params: {
          name: "calendar.create",
          arguments: { title: "Gym" },
        },
        id: expect.any(String),
      });
      expect(response.result).toBeDefined();
    });

    it("throws MCPTimeoutError when request aborts due to timeout", async () => {
      const mockFetch = jest.fn().mockImplementation((_url, options) => {
        return new Promise((_resolve, reject) => {
          options.signal.addEventListener("abort", () => {
            const err = new Error("The operation was aborted");
            err.name = "AbortError";
            reject(err);
          });
        });
      });
      global.fetch = mockFetch as any;

      const client = new McpClient({ timeoutMs: 50 });
      await expect(client.sendToolCall("calendar.create", {}, 50)).rejects.toThrow(MCPTimeoutError);
    });

    it("throws MCPConnectionError on HTTP status >= 400", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 502,
        statusText: "Bad Gateway",
        text: async () => "Bad Gateway Error",
      }) as any;

      const client = new McpClient();
      await expect(client.sendToolCall("calendar.create")).rejects.toThrow(MCPConnectionError);
    });

    it("throws MCPParsingError on invalid JSON response", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => {
          throw new Error("Unexpected token < in JSON");
        },
      }) as any;

      const client = new McpClient();
      await expect(client.sendToolCall("calendar.create")).rejects.toThrow(MCPParsingError);
    });
  });

  describe("McpGateway", () => {
    it("successfully executes tool calls and normalizes response", async () => {
      const mockFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          result: {
            content: [
              {
                type: "text",
                text: JSON.stringify({ success: true, data: { id: "evt_100" } }),
              },
            ],
          },
          id: "req-1",
        }),
      });
      global.fetch = mockFetch as any;

      const gateway = new McpGateway();
      const result = await gateway.execute<{ id: string }>("calendar.create", {
        summary: "Workout",
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ id: "evt_100" });
    });

    it("retries once on connection failure and succeeds on 2nd attempt", async () => {
      const mockFetch = jest
        .fn()
        .mockRejectedValueOnce(new Error("Network error"))
        .mockResolvedValueOnce({
          ok: true,
          json: async () => ({
            jsonrpc: "2.0",
            result: {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({ success: true, eventId: "evt_200" }),
                },
              ],
            },
            id: "req-2",
          }),
        });
      global.fetch = mockFetch as any;

      const gateway = new McpGateway({ maxRetries: 1 });
      const result = await gateway.execute("calendar.create", { summary: "Run" });

      expect(mockFetch).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
    });

    it("fails after 1 retry when temporary errors persist", async () => {
      const mockFetch = jest.fn().mockRejectedValue(new Error("Persistent Network failure"));
      global.fetch = mockFetch as any;

      const gateway = new McpGateway({ maxRetries: 1 });
      await expect(gateway.execute("calendar.create")).rejects.toThrow(MCPConnectionError);
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it("throws MCPExecutionError when MCP response contains server error", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          error: { code: -32601, message: "Method not found" },
          id: "req-3",
        }),
      }) as any;

      const gateway = new McpGateway();
      await expect(gateway.execute("unknown.tool")).rejects.toThrow(MCPExecutionError);
    });

    it("works with default mcpGateway exported instance", async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          jsonrpc: "2.0",
          result: {
            content: [{ type: "text", text: JSON.stringify({ success: true, status: "scheduled" }) }],
          },
          id: "req-4",
        }),
      }) as any;

      const result = await mcpGateway.execute("calendar.create", { event: "Meeting" });
      expect(result.success).toBe(true);
    });
  });
});
