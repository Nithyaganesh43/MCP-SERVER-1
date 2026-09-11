import { connectTestDb, clearTestDb, closeTestDb } from "./helpers/db";
import { TEST_USER_ID_HEX } from "./helpers/seed";
import { createMcpServer, McpServer } from "../mcp/server";
import { ToolRegistry } from "../mcp/registry";
import { createUserContext } from "../mcp/context";
import { TEST_JWT_SECRET, otherUserJwt, validJwt } from "./helpers/auth";
import { UserContext } from "../mcp/manifest";
import { MemoryModel } from "../model/index";
import { Types } from "mongoose";

describe("Karen Memory Module (v1.0)", () => {
  let server: McpServer;
  let ctx: UserContext;
  let otherCtx: UserContext;
  const userId = new Types.ObjectId(TEST_USER_ID_HEX);
  const otherUserId = new Types.ObjectId("000000000000000000000002");

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
    it("should discover all 5 memory tools", () => {
      const { tools } = server.discoverTools();
      const memoryTools = tools
        .filter((t) => t.name.startsWith("memory."))
        .map((t) => t.name)
        .sort();

      expect(memoryTools.length).toBe(5);
      expect(memoryTools).toEqual([
        "memory.delete",
        "memory.list",
        "memory.save",
        "memory.search",
        "memory.update",
      ]);

      const memoryManifests = tools.filter((t) =>
        t.name.startsWith("memory.")
      );
      memoryManifests.forEach((manifest) => {
        expect(manifest.version).toBe("1.0.0");
        expect(manifest.description).toBeDefined();
        expect(manifest.permissions).toBeDefined();
        expect(manifest.inputSchema).toBeDefined();
        expect(manifest.outputSchema).toBeDefined();
      });
    });
  });

  describe("memory.save", () => {
    it("should save a memory with default confidence", async () => {
      const response = await server.executeTool(
        "memory.save",
        {
          category: "preference",
          content: "Prefers dark mode in all applications",
        },
        ctx
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          memoryId: string;
          message: string;
        };
        expect(data.memoryId).toBeDefined();
        expect(data.message).toContain("preference");

        const memory = await MemoryModel.findById(data.memoryId);
        expect(memory).toBeDefined();
        expect(memory?.userId.toString()).toBe(TEST_USER_ID_HEX);
        expect(memory?.category).toBe("preference");
        expect(memory?.content).toBe("Prefers dark mode in all applications");
        expect(memory?.confidence).toBe(0.9);
        expect(memory?.expiresAt).toBeNull();
      }
    });

    it("should save a memory with custom confidence", async () => {
      const response = await server.executeTool(
        "memory.save",
        {
          category: "habit",
          content: "Goes to gym every Monday morning",
          confidence: 0.75,
        },
        ctx
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { memoryId: string };
        const memory = await MemoryModel.findById(data.memoryId);
        expect(memory?.confidence).toBe(0.75);
      }
    });

    it("should save temporary_preference with expiresAt", async () => {
      const expiresAt = new Date("2026-12-31T23:59:59Z").toISOString();
      const response = await server.executeTool(
        "memory.save",
        {
          category: "temporary_preference",
          content: "Avoiding caffeine until exam season ends",
          expiresAt,
        },
        ctx
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { memoryId: string };
        const memory = await MemoryModel.findById(data.memoryId);
        expect(memory?.category).toBe("temporary_preference");
        expect(memory?.expiresAt).toBeDefined();
        expect(memory?.expiresAt?.toISOString()).toBe(expiresAt);
      }
    });

    it("should reject temporary_preference without expiresAt", async () => {
      const response = await server.executeTool(
        "memory.save",
        {
          category: "temporary_preference",
          content: "Avoiding caffeine",
        },
        ctx
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.message).toContain("expiresAt");
        expect(response.error.message).toContain("temporary_preference");
      }
    });

    it("should reject invalid category", async () => {
      const response = await server.executeTool(
        "memory.save",
        {
          category: "invalid_category",
          content: "Some content",
        },
        ctx
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.message).toContain("category");
      }
    });

    it("should reject confidence out of range", async () => {
      const response = await server.executeTool(
        "memory.save",
        {
          category: "preference",
          content: "Test",
          confidence: 1.5,
        },
        ctx
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.message).toContain("confidence");
      }
    });

    it("should reject extra keys", async () => {
      const response = await server.executeTool(
        "memory.save",
        {
          category: "preference",
          content: "Test",
          unknownField: "value",
        },
        ctx
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.message).toContain("Unknown field");
      }
    });
  });

  describe("memory.search", () => {
    beforeEach(async () => {
      await MemoryModel.create([
        {
          userId,
          category: "preference",
          content: "Prefers dark mode in all applications",
          confidence: 0.9,
          expiresAt: null,
        },
        {
          userId,
          category: "habit",
          content: "Goes to gym every Monday morning",
          confidence: 0.85,
          expiresAt: null,
        },
        {
          userId,
          category: "goal",
          content: "Learn TypeScript by end of year",
          confidence: 0.95,
          expiresAt: null,
        },
        {
          userId: otherUserId,
          category: "preference",
          content: "Prefers light mode",
          confidence: 0.9,
          expiresAt: null,
        },
      ]);
    });

    it("should search memories by content", async () => {
      const response = await server.executeTool(
        "memory.search",
        {
          query: "mode",
        },
        ctx
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { memories: any[] };
        expect(data.memories.length).toBe(1);
        expect(data.memories[0].content).toContain("dark mode");
        expect(data.memories[0].memoryId).toBeDefined();
        expect(data.memories[0].category).toBe("preference");
        expect(data.memories[0].confidence).toBe(0.9);
      }
    });

    it("should respect limit parameter", async () => {
      const response = await server.executeTool(
        "memory.search",
        {
          query: "e", // matches multiple
          limit: 2,
        },
        ctx
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { memories: any[] };
        expect(data.memories.length).toBeLessThanOrEqual(2);
      }
    });

    it("should default limit to 5", async () => {
      const response = await server.executeTool(
        "memory.search",
        {
          query: "a", // broad query
        },
        ctx
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { memories: any[] };
        expect(data.memories.length).toBeLessThanOrEqual(5);
      }
    });

    it("should return empty array for no matches", async () => {
      const response = await server.executeTool(
        "memory.search",
        {
          query: "nonexistent_content_xyz",
        },
        ctx
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { memories: any[] };
        expect(data.memories.length).toBe(0);
      }
    });

    it("should isolate memories by userId", async () => {
      const response = await server.executeTool(
        "memory.search",
        {
          query: "mode",
        },
        ctx
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { memories: any[] };
        expect(data.memories.every((m: any) => m.content.includes("dark"))).toBe(
          true
        );
      }
    });
  });

  describe("memory.update", () => {
    let memoryId: string;

    beforeEach(async () => {
      const memory = await MemoryModel.create({
        userId,
        category: "preference",
        content: "Original content",
        confidence: 0.8,
        expiresAt: null,
      });
      memoryId = memory._id.toString();
    });

    it("should update content only", async () => {
      const response = await server.executeTool(
        "memory.update",
        {
          memoryId,
          content: "Updated content",
        },
        ctx
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const memory = await MemoryModel.findById(memoryId);
        expect(memory?.content).toBe("Updated content");
        expect(memory?.confidence).toBe(0.8);
      }
    });

    it("should update confidence only", async () => {
      const response = await server.executeTool(
        "memory.update",
        {
          memoryId,
          confidence: 0.95,
        },
        ctx
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const memory = await MemoryModel.findById(memoryId);
        expect(memory?.content).toBe("Original content");
        expect(memory?.confidence).toBe(0.95);
      }
    });

    it("should update both content and confidence", async () => {
      const response = await server.executeTool(
        "memory.update",
        {
          memoryId,
          content: "New content",
          confidence: 0.7,
        },
        ctx
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const memory = await MemoryModel.findById(memoryId);
        expect(memory?.content).toBe("New content");
        expect(memory?.confidence).toBe(0.7);
      }
    });

    it("should reject if neither content nor confidence provided", async () => {
      const response = await server.executeTool(
        "memory.update",
        {
          memoryId,
        },
        ctx
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.message).toContain("At least one");
      }
    });

    it("should return 404 for non-existent memory", async () => {
      const response = await server.executeTool(
        "memory.update",
        {
          memoryId: "000000000000000000000099",
          content: "New",
        },
        ctx
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.message).toContain("not found");
      }
    });

    it("should reject confidence out of range", async () => {
      const response = await server.executeTool(
        "memory.update",
        {
          memoryId,
          confidence: -0.1,
        },
        ctx
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.message).toContain("confidence");
      }
    });
  });

  describe("memory.delete", () => {
    let memoryId: string;

    beforeEach(async () => {
      const memory = await MemoryModel.create({
        userId,
        category: "preference",
        content: "To be deleted",
        confidence: 0.9,
        expiresAt: null,
      });
      memoryId = memory._id.toString();
    });

    it("should delete an existing memory", async () => {
      const response = await server.executeTool(
        "memory.delete",
        {
          memoryId,
        },
        ctx
      );

      expect(response.success).toBe(true);

      const memory = await MemoryModel.findById(memoryId);
      expect(memory).toBeNull();
    });

    it("should return 404 for non-existent memory", async () => {
      const response = await server.executeTool(
        "memory.delete",
        {
          memoryId: "000000000000000000000099",
        },
        ctx
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.message).toContain("not found");
      }
    });

    it("should not delete another user's memory", async () => {
      const otherMemory = await MemoryModel.create({
        userId: otherUserId,
        category: "preference",
        content: "Other user's memory",
        confidence: 0.9,
        expiresAt: null,
      });

      const response = await server.executeTool(
        "memory.delete",
        {
          memoryId: otherMemory._id.toString(),
        },
        ctx
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.message).toContain("not found");
      }

      // Verify it still exists
      const memory = await MemoryModel.findById(otherMemory._id);
      expect(memory).toBeDefined();
    });
  });

  describe("memory.list", () => {
    beforeEach(async () => {
      await MemoryModel.create([
        {
          userId,
          category: "preference",
          content: "Preference 1",
          confidence: 0.9,
          expiresAt: null,
        },
        {
          userId,
          category: "preference",
          content: "Preference 2",
          confidence: 0.85,
          expiresAt: null,
        },
        {
          userId,
          category: "habit",
          content: "Habit 1",
          confidence: 0.95,
          expiresAt: null,
        },
        {
          userId: otherUserId,
          category: "preference",
          content: "Other user preference",
          confidence: 0.9,
          expiresAt: null,
        },
      ]);
    });

    it("should list all memories for user", async () => {
      const response = await server.executeTool("memory.list", {}, ctx);

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { memories: any[] };
        expect(data.memories.length).toBe(3);
        expect(
          data.memories.every(
            (m: any) => !m.content.includes("Other user")
          )
        ).toBe(true);
      }
    });

    it("should filter by category", async () => {
      const response = await server.executeTool(
        "memory.list",
        {
          category: "preference",
        },
        ctx
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { memories: any[] };
        expect(data.memories.length).toBe(2);
        expect(data.memories.every((m: any) => m.category === "preference")).toBe(
          true
        );
      }
    });

    it("should return empty array for category with no matches", async () => {
      const response = await server.executeTool(
        "memory.list",
        {
          category: "goal",
        },
        ctx
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { memories: any[] };
        expect(data.memories.length).toBe(0);
      }
    });

    it("should include expiresAt in response", async () => {
      const expiresAt = new Date("2026-12-31T23:59:59Z");
      await MemoryModel.create({
        userId,
        category: "temporary_preference",
        content: "Temporary",
        confidence: 0.9,
        expiresAt,
      });

      const response = await server.executeTool("memory.list", {}, ctx);

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { memories: any[] };
        const temp = data.memories.find(
          (m: any) => m.category === "temporary_preference"
        );
        expect(temp).toBeDefined();
        expect(temp.expiresAt).toBe(expiresAt.toISOString());
      }
    });
  });

  describe("Permissions", () => {
    it("memory.save should require memory:write", async () => {
      const tool = server
        .discoverTools()
        .tools.find((t) => t.name === "memory.save");
      expect(tool?.permissions).toContain("memory:write");
    });

    it("memory.search should require memory:read", async () => {
      const tool = server
        .discoverTools()
        .tools.find((t) => t.name === "memory.search");
      expect(tool?.permissions).toContain("memory:read");
    });

    it("memory.update should require memory:write", async () => {
      const tool = server
        .discoverTools()
        .tools.find((t) => t.name === "memory.update");
      expect(tool?.permissions).toContain("memory:write");
    });

    it("memory.delete should require memory:delete", async () => {
      const tool = server
        .discoverTools()
        .tools.find((t) => t.name === "memory.delete");
      expect(tool?.permissions).toContain("memory:delete");
    });

    it("memory.list should require memory:read", async () => {
      const tool = server
        .discoverTools()
        .tools.find((t) => t.name === "memory.list");
      expect(tool?.permissions).toContain("memory:read");
    });
  });

  describe("User Isolation", () => {
    it("should not allow user A to see user B's memories", async () => {
      await MemoryModel.create({
        userId: otherUserId,
        category: "preference",
        content: "User B secret",
        confidence: 0.9,
        expiresAt: null,
      });

      const response = await server.executeTool("memory.list", {}, ctx);

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { memories: any[] };
        expect(
          data.memories.every((m: any) => !m.content.includes("User B"))
        ).toBe(true);
      }
    });

    it("should not allow user A to update user B's memory", async () => {
      const otherMemory = await MemoryModel.create({
        userId: otherUserId,
        category: "preference",
        content: "User B memory",
        confidence: 0.9,
        expiresAt: null,
      });

      const response = await server.executeTool(
        "memory.update",
        {
          memoryId: otherMemory._id.toString(),
          content: "Hacked",
        },
        ctx
      );

      expect(response.success).toBe(false);
    });
  });

  describe("Confidence Range Validation", () => {
    it("should accept confidence = 0", async () => {
      const response = await server.executeTool(
        "memory.save",
        {
          category: "preference",
          content: "Test",
          confidence: 0,
        },
        ctx
      );

      expect(response.success).toBe(true);
    });

    it("should accept confidence = 1", async () => {
      const response = await server.executeTool(
        "memory.save",
        {
          category: "preference",
          content: "Test",
          confidence: 1,
        },
        ctx
      );

      expect(response.success).toBe(true);
    });

    it("should accept confidence = 0.5", async () => {
      const response = await server.executeTool(
        "memory.save",
        {
          category: "preference",
          content: "Test",
          confidence: 0.5,
        },
        ctx
      );

      expect(response.success).toBe(true);
    });

    it("should reject confidence < 0", async () => {
      const response = await server.executeTool(
        "memory.save",
        {
          category: "preference",
          content: "Test",
          confidence: -0.01,
        },
        ctx
      );

      expect(response.success).toBe(false);
    });

    it("should reject confidence > 1", async () => {
      const response = await server.executeTool(
        "memory.save",
        {
          category: "preference",
          content: "Test",
          confidence: 1.01,
        },
        ctx
      );

      expect(response.success).toBe(false);
    });
  });
});
