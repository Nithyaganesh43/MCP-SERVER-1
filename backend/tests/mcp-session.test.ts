import request from "supertest";
import { getMcpTestApp, TEST_MCP_API_KEY, mcpHeaders, parseMcpJsonRpc, parseMcpToolEnvelope } from "./helpers/mcpHttp";
import { ToolRegistry } from "../mcp/registry";
import { TEST_JWT_SECRET, validJwt } from "./helpers/auth";
import {
  generateSessionId,
  isInitializeRequest,
  McpSessionManager,
} from "../mcp/sessionManager";

describe("MCP session management", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    ToolRegistry.getInstance().clearRegistry();
    process.env.MCP_API_KEY = TEST_MCP_API_KEY;
    process.env.JWT_SECRET = TEST_JWT_SECRET;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  const initializePayload = {
    jsonrpc: "2.0",
    id: 1,
    method: "initialize",
    params: {
      protocolVersion: "2025-03-26",
      capabilities: {},
      clientInfo: { name: "test-client", version: "1.0.0" },
    },
  };

  const initializedNotification = {
    jsonrpc: "2.0",
    method: "notifications/initialized",
  };

  const listToolsPayload = {
    jsonrpc: "2.0",
    id: 2,
    method: "tools/list",
    params: {},
  };

  function sessionHeaders(sessionId: string, jwt?: string): Record<string, string> {
    return {
      ...mcpHeaders(TEST_MCP_API_KEY, jwt),
      Accept: "application/json, text/event-stream",
      "Mcp-Session-Id": sessionId,
    };
  }

  describe("McpSessionManager", () => {
    it("stores, reuses, and drops sessions by id", () => {
      const sessions = new McpSessionManager();
      const id = generateSessionId();
      const fake = {
        transport: { sessionId: id } as never,
        sdkServer: {} as never,
      };

      expect(sessions.get(id)).toBeUndefined();
      sessions.set(id, fake);
      expect(sessions.get(id)).toBe(fake);
      expect(sessions.size()).toBe(1);

      const dropped = sessions.drop(id);
      expect(dropped).toBe(fake);
      expect(sessions.get(id)).toBeUndefined();
      expect(sessions.size()).toBe(0);
      expect(sessions.drop(id)).toBeUndefined();
    });

    it("detects initialize JSON-RPC bodies", () => {
      expect(isInitializeRequest(initializePayload)).toBe(true);
      expect(isInitializeRequest([initializePayload])).toBe(true);
      expect(isInitializeRequest(listToolsPayload)).toBe(false);
      expect(isInitializeRequest(null)).toBe(false);
    });
  });

  describe("HTTP sessions", () => {
    it("issues a session id on initialize and reuses that transport", async () => {
      const app = getMcpTestApp();

      const init = await request(app)
        .post("/mcp")
        .set({
          ...mcpHeaders(),
          Accept: "application/json, text/event-stream",
        })
        .send(initializePayload);

      expect(init.status).not.toBe(401);
      expect(init.status).not.toBe(400);
      expect(init.status).not.toBe(404);

      const sessionId = init.headers["mcp-session-id"];
      expect(typeof sessionId).toBe("string");
      expect(sessionId.length).toBeGreaterThan(0);

      await request(app)
        .post("/mcp")
        .set(sessionHeaders(sessionId))
        .send(initializedNotification);

      const listed = await request(app)
        .post("/mcp")
        .set(sessionHeaders(sessionId))
        .send(listToolsPayload);

      expect(listed.status).not.toBe(400);
      expect(listed.status).not.toBe(404);
      expect(listed.status).not.toBe(401);

      const initRpc = parseMcpJsonRpc(init);
      const caps = (initRpc.result as { capabilities?: Record<string, unknown> })
        ?.capabilities;
      expect(caps).toEqual(
        expect.objectContaining({
          tools: expect.anything(),
          resources: expect.anything(),
          prompts: expect.anything(),
        }),
      );

      const resources = await request(app)
        .post("/mcp")
        .set(sessionHeaders(sessionId))
        .send({
          jsonrpc: "2.0",
          id: 3,
          method: "resources/list",
          params: {},
        });
      expect(parseMcpJsonRpc(resources).result).toEqual(
        expect.objectContaining({ resources: [] }),
      );

      const prompts = await request(app)
        .post("/mcp")
        .set(sessionHeaders(sessionId))
        .send({
          jsonrpc: "2.0",
          id: 4,
          method: "prompts/list",
          params: {},
        });
      expect(parseMcpJsonRpc(prompts).result).toEqual(
        expect.objectContaining({ prompts: [] }),
      );

      const unknownTool = await request(app)
        .post("/mcp")
        .set(sessionHeaders(sessionId, validJwt()))
        .send({
          jsonrpc: "2.0",
          id: 5,
          method: "tools/call",
          params: { name: "notes.create", arguments: { text: "hello" } },
        });
      const failed = parseMcpToolEnvelope(unknownTool);
      expect(failed.success).toBe(false);
      expect(failed.isError).toBe(true);
      expect(failed.error?.code).toBe("NOT_FOUND");

      await request(app).delete("/mcp").set(sessionHeaders(sessionId));
    });

    it("rejects non-initialize POST without a session id", async () => {
      const app = getMcpTestApp();
      const res = await request(app)
        .post("/mcp")
        .set({
          ...mcpHeaders(),
          Accept: "application/json, text/event-stream",
        })
        .send(listToolsPayload);

      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe(-32000);
    });

    it("rejects unknown session ids with 404", async () => {
      const app = getMcpTestApp();
      const res = await request(app)
        .post("/mcp")
        .set(sessionHeaders(generateSessionId()))
        .send(listToolsPayload);

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe(-32001);
    });

    it("removes the session on DELETE so the id cannot be reused", async () => {
      const app = getMcpTestApp();

      const init = await request(app)
        .post("/mcp")
        .set({
          ...mcpHeaders(),
          Accept: "application/json, text/event-stream",
        })
        .send(initializePayload);

      const sessionId = init.headers["mcp-session-id"] as string;
      expect(sessionId).toBeTruthy();

      const closed = await request(app)
        .delete("/mcp")
        .set(sessionHeaders(sessionId));

      expect(closed.status).not.toBe(401);
      expect(closed.status).not.toBe(404);

      const reused = await request(app)
        .post("/mcp")
        .set(sessionHeaders(sessionId))
        .send(listToolsPayload);

      expect(reused.status).toBe(404);
      expect(reused.body.error.code).toBe(-32001);
    });
  });
});
