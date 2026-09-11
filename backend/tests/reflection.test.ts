import { connectTestDb, clearTestDb, closeTestDb } from "./helpers/db";
import { seedDatabase, seedTestUser, TEST_USER_ID_HEX, TEST_TIMEZONE } from "./helpers/seed";
import { createMcpServer, McpServer } from "../mcp/server";
import { ToolRegistry } from "../mcp/registry";
import { createUserContext } from "../mcp/context";
import { TEST_JWT_SECRET, validJwt, otherUserJwt } from "./helpers/auth";
import { UserContext } from "../mcp/manifest";
import { ActivityModel } from "../model/index";
import { Types } from "mongoose";

describe("Reflection Module (v1.0)", () => {
  let server: McpServer;
  let ctx: UserContext;

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
    await seedDatabase();
    ctx = createUserContext({ jwt: validJwt() });
  });

  describe("Tool Discovery", () => {
    it("should discover all 3 reflection tools", () => {
      const { tools } = server.discoverTools();
      const reflectionTools = tools.filter((t) => t.name.startsWith("reflection."));

      expect(reflectionTools.length).toBe(3);
      
      const toolNames = reflectionTools.map((t) => t.name).sort();
      expect(toolNames).toEqual([
        "reflection.daily",
        "reflection.monthly",
        "reflection.weekly",
      ]);

      reflectionTools.forEach((manifest) => {
        expect(manifest.version).toBe("1.0.0");
        expect(manifest.description).toBeDefined();
        expect(manifest.permissions).toEqual(["reflection:read"]);
        expect(manifest.inputSchema).toBeDefined();
        expect(manifest.outputSchema).toBeDefined();
      });
    });
  });

  describe("reflection.daily", () => {
    it("should generate daily summary for seeded date", async () => {
      const response = await server.executeTool(
        "reflection.daily",
        {
          date: "2026-09-09",
          timezone: TEST_TIMEZONE,
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          completed: number;
          missed: number;
          upcoming: number;
        };

        expect(data.summary).toBeDefined();
        expect(typeof data.summary).toBe("string");
        expect(data.completed).toBe(0);
        expect(data.missed).toBe(0);
        expect(data.upcoming).toBe(5); // All 5 seeded activities are pending
      }
    });

    it("should handle day with no activities", async () => {
      await clearTestDb();
      await seedTestUser();
      const response = await server.executeTool(
        "reflection.daily",
        {
          date: "2026-09-10",
          timezone: TEST_TIMEZONE,
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          completed: number;
          missed: number;
          upcoming: number;
        };

        expect(data.summary).toContain("no activities");
        expect(data.completed).toBe(0);
        expect(data.missed).toBe(0);
        expect(data.upcoming).toBe(0);
      }
    });

    it("should count completed activities correctly", async () => {
      // Mark some activities as done
      const seeded = await ActivityModel.find({ userId: new Types.ObjectId(TEST_USER_ID_HEX) });
      await ActivityModel.updateOne(
        { _id: seeded[0]._id },
        { status: "done" }
      );
      await ActivityModel.updateOne(
        { _id: seeded[1]._id },
        { status: "done" }
      );

      const response = await server.executeTool(
        "reflection.daily",
        {
          date: "2026-09-09",
          timezone: TEST_TIMEZONE,
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          completed: number;
          missed: number;
          upcoming: number;
        };

        expect(data.completed).toBe(2);
        expect(data.upcoming).toBe(3);
        expect(data.summary).toContain("Completed 2");
      }
    });

    it("should count missed activities correctly", async () => {
      // Mark one activity as missed
      const seeded = await ActivityModel.find({ userId: new Types.ObjectId(TEST_USER_ID_HEX) });
      await ActivityModel.updateOne(
        { _id: seeded[0]._id },
        { status: "missed" }
      );

      const response = await server.executeTool(
        "reflection.daily",
        {
          date: "2026-09-09",
          timezone: TEST_TIMEZONE,
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          completed: number;
          missed: number;
          upcoming: number;
        };

        expect(data.missed).toBe(1);
        expect(data.summary).toContain("missed 1");
      }
    });

    it("should default to today when no date provided", async () => {
      const response = await server.executeTool(
        "reflection.daily",
        {},
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          completed: number;
          missed: number;
          upcoming: number;
        };

        expect(data.summary).toBeDefined();
        expect(typeof data.completed).toBe("number");
        expect(typeof data.missed).toBe("number");
        expect(typeof data.upcoming).toBe("number");
      }
    });

    it("should isolate data by user", async () => {
      const otherCtx = createUserContext({ jwt: otherUserJwt() });
      
      const response = await server.executeTool(
        "reflection.daily",
        {
          date: "2026-09-09",
          timezone: TEST_TIMEZONE,
        },
        otherCtx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          completed: number;
          missed: number;
          upcoming: number;
        };

        // Other user should see no activities
        expect(data.completed).toBe(0);
        expect(data.missed).toBe(0);
        expect(data.upcoming).toBe(0);
      }
    });

    it("should reject invalid date format", async () => {
      const response = await server.executeTool(
        "reflection.daily",
        {
          date: "2026/09/09", // Wrong format
          timezone: TEST_TIMEZONE,
        },
        ctx,
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("VALIDATION_ERROR");
      }
    });

    it("should reject extra keys", async () => {
      const response = await server.executeTool(
        "reflection.daily",
        {
          date: "2026-09-09",
          timezone: TEST_TIMEZONE,
          extraKey: "should be rejected",
        },
        ctx,
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("VALIDATION_ERROR");
        expect(response.error.message).toContain("Unknown field");
      }
    });
  });

  describe("reflection.weekly", () => {
    it("should generate weekly summary for seeded week", async () => {
      const response = await server.executeTool(
        "reflection.weekly",
        {
          date: "2026-09-09",
          timezone: TEST_TIMEZONE,
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          insights: string[];
        };

        expect(data.summary).toBeDefined();
        expect(typeof data.summary).toBe("string");
        expect(Array.isArray(data.insights)).toBe(true);
        expect(data.insights.length).toBeGreaterThan(0);
        expect(data.summary).toContain("week");
      }
    });

    it("should provide insights about completion rate", async () => {
      // Mark 4 out of 5 activities as done (80% completion)
      const seeded = await ActivityModel.find({ userId: new Types.ObjectId(TEST_USER_ID_HEX) });
      await ActivityModel.updateMany(
        { _id: { $in: [seeded[0]._id, seeded[1]._id, seeded[2]._id, seeded[3]._id] } },
        { status: "done" }
      );

      const response = await server.executeTool(
        "reflection.weekly",
        {
          date: "2026-09-09",
          timezone: TEST_TIMEZONE,
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          insights: string[];
        };

        expect(data.summary).toMatch(/\d+%/);
        expect(data.insights.some(i => i.toLowerCase().includes("strong") || i.toLowerCase().includes("completion"))).toBe(true);
      }
    });

    it("should identify recurring activities", async () => {
      const response = await server.executeTool(
        "reflection.weekly",
        {
          date: "2026-09-09",
          timezone: TEST_TIMEZONE,
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          insights: string[];
        };

        // Should mention recurring activities (dinner is daily, vitamin D is weekly)
        expect(data.insights.some(i => i.toLowerCase().includes("recurring") || i.toLowerCase().includes("habit"))).toBe(true);
      }
    });

    it("should handle week with no activities", async () => {
      await clearTestDb();
      await seedTestUser();
      const response = await server.executeTool(
        "reflection.weekly",
        {
          date: "2026-10-01",
          timezone: TEST_TIMEZONE,
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          insights: string[];
        };

        expect(data.summary).toContain("no activities");
      }
    });

    it("should default to current week when no date provided", async () => {
      const response = await server.executeTool(
        "reflection.weekly",
        {},
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          insights: string[];
        };

        expect(data.summary).toBeDefined();
        expect(Array.isArray(data.insights)).toBe(true);
      }
    });
  });

  describe("reflection.monthly", () => {
    it("should generate monthly summary for seeded month", async () => {
      const response = await server.executeTool(
        "reflection.monthly",
        {
          date: "2026-09-09",
          timezone: TEST_TIMEZONE,
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          trends: string[];
        };

        expect(data.summary).toBeDefined();
        expect(typeof data.summary).toBe("string");
        expect(Array.isArray(data.trends)).toBe(true);
        expect(data.trends.length).toBeGreaterThan(0);
        expect(data.summary).toContain("September 2026");
      }
    });

    it("should analyze category distribution", async () => {
      const response = await server.executeTool(
        "reflection.monthly",
        {
          date: "2026-09-09",
          timezone: TEST_TIMEZONE,
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          trends: string[];
        };

        // Should mention top categories (work, personal, health)
        expect(data.trends.some(t => t.toLowerCase().includes("categor"))).toBe(true);
      }
    });

    it("should analyze priority vs completion correlation", async () => {
      // Mark high priority tasks as done
      const highPriorityActivities = await ActivityModel.find({
        userId: new Types.ObjectId(TEST_USER_ID_HEX),
        priority: { $gte: 4 }
      });
      await ActivityModel.updateMany(
        { _id: { $in: highPriorityActivities.map(a => a._id) } },
        { status: "done" }
      );

      const response = await server.executeTool(
        "reflection.monthly",
        {
          date: "2026-09-09",
          timezone: TEST_TIMEZONE,
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          trends: string[];
        };

        // Should mention high priority completion
        expect(data.trends.some(t => t.toLowerCase().includes("priority"))).toBe(true);
      }
    });

    it("should handle month with no activities", async () => {
      await clearTestDb();
      await seedTestUser();
      const response = await server.executeTool(
        "reflection.monthly",
        {
          date: "2026-10-01",
          timezone: TEST_TIMEZONE,
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          trends: string[];
        };

        expect(data.summary).toContain("no activities");
      }
    });

    it("should identify high cancellation rate", async () => {
      await ActivityModel.updateMany(
        { userId: new Types.ObjectId(TEST_USER_ID_HEX) },
        { status: "cancelled" },
      );

      const response = await server.executeTool(
        "reflection.monthly",
        {
          date: "2026-09-09",
          timezone: TEST_TIMEZONE,
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          trends: string[];
        };

        expect(data.trends.some(t => t.toLowerCase().includes("cancel"))).toBe(true);
      }
    });

    it("should default to current month when no date provided", async () => {
      const response = await server.executeTool(
        "reflection.monthly",
        {},
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          trends: string[];
        };

        expect(data.summary).toBeDefined();
        expect(Array.isArray(data.trends)).toBe(true);
      }
    });
  });

  describe("Timezone Handling", () => {
    it("should preserve timezone in daily reflection", async () => {
      const response = await server.executeTool(
        "reflection.daily",
        {
          date: "2026-09-09",
          timezone: "America/New_York",
        },
        ctx,
      );

      expect(response.success).toBe(true);
    });

    it("should reject invalid timezone", async () => {
      const response = await server.executeTool(
        "reflection.daily",
        {
          date: "2026-09-09",
          timezone: "Invalid/Timezone",
        },
        ctx,
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });
});
