import request from "supertest";
import { getMcpTestApp, TEST_MCP_API_KEY, mcpHeaders } from "./helpers/mcpHttp";
import { timingSafeCompare } from "../mcp/apiKeyAuth";
import { ToolRegistry } from "../mcp/registry";

/**
 * MCP API Key Authentication & HTTP Endpoint Tests
 *
 * These tests validate:
 * - API Key authentication (valid, missing, invalid, wrong header)
 * - HTTP endpoint accessibility (/health, /mcp)
 * - Security properties (no key leakage in logs, timing-safe comparison)
 */
describe("MCP API Key Authentication & HTTP Endpoints", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    ToolRegistry.getInstance().clearRegistry();
    process.env.MCP_API_KEY = TEST_MCP_API_KEY;
    process.env.MCP_USER_ID = "68c0e0010000000000000001";
    process.env.JWT_SECRET = "test-jwt-secret";
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // --- MCP Initialize payload (JSON-RPC) ---
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

  // =========================================================================
  // Authentication Tests
  // =========================================================================
  describe("Authentication", () => {
    it("should accept requests with a valid API key", async () => {
      const app = getMcpTestApp();
      const res = await request(app)
        .post("/mcp")
        .set(mcpHeaders())
        .send(initializePayload);

      // Should not be 401 — the MCP SDK will process the request
      expect(res.status).not.toBe(401);
    });

    it("should reject requests with a missing API key", async () => {
      const app = getMcpTestApp();
      const res = await request(app)
        .post("/mcp")
        .set("Content-Type", "application/json")
        .send(initializePayload);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
      expect(res.body.message).toContain("Missing");
    });

    it("should reject requests with an invalid API key", async () => {
      const app = getMcpTestApp();
      const res = await request(app)
        .post("/mcp")
        .set(mcpHeaders("rk_live_wrongkey"))
        .send(initializePayload);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
      expect(res.body.message).toContain("Invalid");
    });

    it("should reject requests with wrong header name", async () => {
      const app = getMcpTestApp();
      const res = await request(app)
        .post("/mcp")
        .set("Content-Type", "application/json")
        .set("Authorization", `Bearer ${TEST_MCP_API_KEY}`)
        .send(initializePayload);

      expect(res.status).toBe(401);
      expect(res.body.error).toBe("Unauthorized");
    });
  });

  // =========================================================================
  // Endpoint Tests
  // =========================================================================
  describe("Endpoints", () => {
    it("should serve /health without API key", async () => {
      const app = getMcpTestApp();
      const res = await request(app).get("/health");

      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it("should accept authenticated POST /mcp requests", async () => {
      const app = getMcpTestApp();
      const res = await request(app)
        .post("/mcp")
        .set(mcpHeaders())
        .send(initializePayload);

      // Should process the MCP request (not 401)
      expect(res.status).not.toBe(401);
      // The response should be valid JSON-RPC
      expect(res.body).toBeDefined();
    });

    it("should reject unauthenticated POST /mcp requests", async () => {
      const app = getMcpTestApp();
      const res = await request(app)
        .post("/mcp")
        .set("Content-Type", "application/json")
        .send(initializePayload);

      expect(res.status).toBe(401);
    });
  });

  // =========================================================================
  // Security Tests
  // =========================================================================
  describe("Security", () => {
    it("should not expose API key in logs", async () => {
      const logs: string[] = [];
      const originalLog = console.log;
      const originalWarn = console.warn;
      console.log = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };
      console.warn = (...args: unknown[]) => {
        logs.push(args.map(String).join(" "));
      };

      try {
        const app = getMcpTestApp();

        // Make a request with an invalid key to trigger warning logs
        await request(app)
          .post("/mcp")
          .set(mcpHeaders("rk_live_supersecretkey123"))
          .send(initializePayload);

        // Check that no log entry contains the full API key
        const fullKey = "rk_live_supersecretkey123";
        for (const log of logs) {
          expect(log).not.toContain(fullKey);
        }
      } finally {
        console.log = originalLog;
        console.warn = originalWarn;
      }
    });

    it("should use timing-safe comparison", () => {
      // Same strings should match
      expect(timingSafeCompare("abc123", "abc123")).toBe(true);

      // Different strings should not match
      expect(timingSafeCompare("abc123", "abc124")).toBe(false);

      // Different lengths should not match
      expect(timingSafeCompare("short", "muchlongerstring")).toBe(false);

      // Empty strings should match
      expect(timingSafeCompare("", "")).toBe(true);
    });

    it("should skip auth when MCP_API_KEY is not set (dev mode)", async () => {
      delete process.env.MCP_API_KEY;
      delete process.env.NODE_ENV; // default is not "production"

      // Suppress the warning log
      const originalWarn = console.warn;
      console.warn = () => {};

      try {
        const app = getMcpTestApp();
        const res = await request(app)
          .post("/mcp")
          .set("Content-Type", "application/json")
          .send(initializePayload);

        // Should not be 401 when auth is disabled
        expect(res.status).not.toBe(401);
      } finally {
        console.warn = originalWarn;
      }
    });
  });
});
