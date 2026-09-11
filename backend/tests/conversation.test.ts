import { connectTestDb, clearTestDb, closeTestDb } from "./helpers/db";
import { createMcpServer, McpServer } from "../mcp/server";
import { ToolRegistry } from "../mcp/registry";
import { createUserContext } from "../mcp/context";
import { TEST_JWT_SECRET, validJwt, otherUserJwt } from "./helpers/auth";
import { UserContext } from "../mcp/manifest";
import { TEST_USER_ID_HEX } from "./helpers/seed";

describe("Conversation Context Module (Module 4)", () => {
  let server: McpServer;
  let ctx: UserContext;
  let otherCtx: UserContext;

  beforeAll(async () => {
    process.env.JWT_SECRET = TEST_JWT_SECRET;
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    ToolRegistry.getInstance().clearRegistry();
    server = createMcpServer();
    ctx = createUserContext({ jwt: validJwt() });
    otherCtx = createUserContext({ jwt: otherUserJwt() });
  });

  describe("Tool Discovery", () => {
    it("should discover all conversation.* tools", () => {
      const { tools } = server.discoverTools();
      const conversationTools = tools.filter((t) => t.name.startsWith("conversation."));
      const names = conversationTools.map((t) => t.name).sort();

      expect(conversationTools.length).toBe(3);
      expect(names).toEqual([
        "conversation.clear",
        "conversation.context",
        "conversation.state",
      ]);
    });
  });

  describe("conversation.context (Initial State)", () => {
    it("should return empty defaults if no state exists", async () => {
      const res = await server.executeTool("conversation.context", {}, ctx);
      expect(res.success).toBe(true);
      if (res.success) {
        const data = res.data as { mission: string; context: string; entities: Record<string, unknown>; updatedAt: string };
        expect(data.mission).toBe("");
        expect(data.context).toBe("");
        expect(data.entities).toEqual({});
        expect(data.updatedAt).toBeDefined();
      }
    });
  });

  describe("conversation.state", () => {
    it("should set mission, context, and entities", async () => {
      const stateRes = await server.executeTool(
        "conversation.state",
        {
          mission: "Schedule weekly team sync",
          context: "User mentioned wanting it after lunch",
          entities: {
            it: "activity_64a1b2c3d4e5f67890123456",
            "that meeting": "activity_64a1b2c3d4e5f67890654321",
          },
        },
        ctx
      );

      expect(stateRes.success).toBe(true);

      const ctxRes = await server.executeTool("conversation.context", {}, ctx);
      expect(ctxRes.success).toBe(true);
      if (ctxRes.success) {
        const data = ctxRes.data as { mission: string; context: string; entities: Record<string, unknown> };
        expect(data.mission).toBe("Schedule weekly team sync");
        expect(data.context).toBe("User mentioned wanting it after lunch");
        expect(data.entities).toEqual({
          it: "activity_64a1b2c3d4e5f67890123456",
          "that meeting": "activity_64a1b2c3d4e5f67890654321",
        });
      }
    });

    it("should perform partial updates without overwriting unmentioned fields", async () => {
      // First set initial state
      await server.executeTool(
        "conversation.state",
        {
          mission: "Initial Mission",
          context: "Initial Context",
          entities: { target: "123" },
        },
        ctx
      );

      // Update only mission
      const updateRes = await server.executeTool(
        "conversation.state",
        { mission: "Updated Mission" },
        ctx
      );
      expect(updateRes.success).toBe(true);

      const getRes = await server.executeTool("conversation.context", {}, ctx);
      expect(getRes.success).toBe(true);
      if (getRes.success) {
        const data = getRes.data as { mission: string; context: string; entities: Record<string, unknown> };
        expect(data.mission).toBe("Updated Mission");
        expect(data.context).toBe("Initial Context");
        expect(data.entities).toEqual({ target: "123" });
      }
    });

    it("should reject input when no fields are provided", async () => {
      const res = await server.executeTool("conversation.state", {}, ctx);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("VALIDATION_ERROR");
        expect(res.error.message).toContain("At least one field");
      }
    });

    it("should reject unknown fields in conversation.state input", async () => {
      const res = await server.executeTool(
        "conversation.state",
        { mission: "Test", unknownField: 123 },
        ctx
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("VALIDATION_ERROR");
        expect(res.error.message).toContain("Unknown field: unknownField");
      }
    });
  });

  describe("conversation.clear", () => {
    it("should clear conversation state for the user", async () => {
      await server.executeTool(
        "conversation.state",
        { mission: "To be cleared", context: "Temp info" },
        ctx
      );

      const clearRes = await server.executeTool("conversation.clear", {}, ctx);
      expect(clearRes.success).toBe(true);

      const getRes = await server.executeTool("conversation.context", {}, ctx);
      expect(getRes.success).toBe(true);
      if (getRes.success) {
        const data = getRes.data as { mission: string; context: string };
        expect(data.mission).toBe("");
        expect(data.context).toBe("");
      }
    });
  });

  describe("User Isolation", () => {
    it("should isolate conversation state between users", async () => {
      await server.executeTool(
        "conversation.state",
        { mission: "User A Mission" },
        ctx
      );

      await server.executeTool(
        "conversation.state",
        { mission: "User B Mission" },
        otherCtx
      );

      const resA = await server.executeTool("conversation.context", {}, ctx);
      const resB = await server.executeTool("conversation.context", {}, otherCtx);

      expect(resA.success).toBe(true);
      expect(resB.success).toBe(true);

      if (resA.success && resB.success) {
        expect((resA.data as { mission: string }).mission).toBe("User A Mission");
        expect((resB.data as { mission: string }).mission).toBe("User B Mission");
      }
    });
  });

  describe("Permissions", () => {
    it("should reject conversation.context without conversation:read permission", async () => {
      const restrictedCtx = createUserContext({
        userId: TEST_USER_ID_HEX,
        permissions: ["calendar:read"],
      });

      const res = await server.executeTool("conversation.context", {}, restrictedCtx);
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("FORBIDDEN");
      }
    });

    it("should reject conversation.state without conversation:write permission", async () => {
      const restrictedCtx = createUserContext({
        userId: TEST_USER_ID_HEX,
        permissions: ["conversation:read"],
      });

      const res = await server.executeTool(
        "conversation.state",
        { mission: "Test" },
        restrictedCtx
      );
      expect(res.success).toBe(false);
      if (!res.success) {
        expect(res.error.code).toBe("FORBIDDEN");
      }
    });
  });
});
