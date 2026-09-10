import { connectTestDb, clearTestDb, closeTestDb } from "./helpers/db";
import { seedDatabase, TEST_USER_ID_HEX, SeededActivities } from "./helpers/seed";
import { createMcpServer, McpServer } from "../mcp/server";
import { ToolRegistry } from "../mcp/registry";
import { createUserContext } from "../mcp/context";
import { TEST_JWT_SECRET, validJwt } from "./helpers/auth";
import { UserContext } from "../mcp/manifest";

describe("Rytham MCP Capability Layer (v1.0)", () => {
  let server: McpServer;
  let seeded: SeededActivities;
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
    seeded = await seedDatabase();
    ctx = createUserContext({ jwt: validJwt() });
  });

  describe("Tool Discovery", () => {
    it("should discover all 8 reference calendar tools", () => {
      const { tools } = server.discoverTools();
      const toolNames = tools.map((t) => t.name).sort();

      expect(tools.length).toBe(8);
      expect(toolNames).toEqual([
        "calendar.complete",
        "calendar.conflicts",
        "calendar.create",
        "calendar.delete",
        "calendar.list",
        "calendar.reschedule",
        "calendar.suggest_slot",
        "calendar.update",
      ]);

      tools.forEach((manifest) => {
        expect(manifest.version).toBe("1.0.0");
        expect(manifest.description).toBeDefined();
        expect(manifest.permissions).toBeDefined();
        expect(manifest.inputSchema).toBeDefined();
        expect(manifest.outputSchema).toBeDefined();
      });
    });
  });

  describe("Tool Execution (Calendar Module)", () => {
    it("should execute calendar.list with context timezone", async () => {
      const response = await server.executeTool(
        "calendar.list",
        {
          range: "day",
          date: "2026-09-09",
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { activities: any[] };
        expect(data.activities).toBeDefined();
        expect(data.activities.length).toBe(5);
      }
    });

    it("should execute calendar.create successfully", async () => {
      const response = await server.executeTool(
        "calendar.create",
        {
          title: "Focus Block",
          schedule: {
            startAt: "2026-09-09T15:00:00+05:30",
            endAt: "2026-09-09T16:00:00+05:30",
            durationMin: 60,
            timezone: "Asia/Kolkata",
          },
          behavior: {
            flexibility: "moveable",
          },
          priority: 4,
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { success: boolean; activityId: string; message: string };
        expect(data.success).toBe(true);
        expect(data.activityId).toBeDefined();
        expect(data.message).toContain("Focus Block");
      }
    });

    it("should execute calendar.update successfully", async () => {
      const activityId = String(seeded.dellMeeting._id);
      const response = await server.executeTool(
        "calendar.update",
        {
          activityId,
          changes: {
            title: "Dell Executive Briefing",
            priority: 5,
          },
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { success: boolean; activityId: string; message: string };
        expect(data.success).toBe(true);
        expect(data.activityId).toBe(activityId);
      }
    });

    it("should execute calendar.complete successfully", async () => {
      const activityId = String(seeded.lunch._id);
      const response = await server.executeTool(
        "calendar.complete",
        { activityId },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { status: string };
        expect(data.status).toBe("done");
      }
    });

    it("should execute calendar.reschedule successfully", async () => {
      const activityId = String(seeded.gym._id);
      const response = await server.executeTool(
        "calendar.reschedule",
        {
          activityId,
          newStartAt: "2026-09-09T19:30:00+05:30",
          reason: "Delayed at work",
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { success: boolean; newEndAt: string | null };
        expect(data.success).toBe(true);
        expect(data.newEndAt).toBe("2026-09-09T15:00:00.000Z");
      }
    });

    it("should execute calendar.conflicts successfully", async () => {
      const response = await server.executeTool(
        "calendar.conflicts",
        {
          startAt: "2026-09-09T10:30:00+05:30",
          endAt: "2026-09-09T11:30:00+05:30",
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { conflicts: any[] };
        expect(data.conflicts.length).toBe(1);
        expect(data.conflicts[0].title).toBe("Dell Meeting");
      }
    });

    it("should execute calendar.suggest_slot successfully", async () => {
      const response = await server.executeTool(
        "calendar.suggest_slot",
        {
          date: "2026-09-09",
          durationMin: 60,
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { suggestedStart: string | null; suggestedEnd: string | null };
        expect(data.suggestedStart).toBeDefined();
      }
    });

    it("should execute calendar.delete successfully", async () => {
      const activityId = String(seeded.vitaminD._id);
      const response = await server.executeTool(
        "calendar.delete",
        { activityId },
        ctx,
      );

      expect(response.success).toBe(true);
    });
  });

  describe("Security, User Context, & Error Code Handling", () => {
    it("should reject userId parameter inside AI tool input", async () => {
      const response = await server.executeTool(
        "calendar.list",
        {
          range: "day",
          date: "2026-09-09",
          userId: "malicious_user_id",
        },
        ctx,
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("VALIDATION_ERROR");
        expect(response.error.message).toContain("userId must not be provided in tool input");
      }
    });

    it("should return FORBIDDEN when user lacks required permission", async () => {
      const restrictedCtx = createUserContext({
        userId: TEST_USER_ID_HEX,
        permissions: ["calendar:read"],
      });

      const response = await server.executeTool(
        "calendar.delete",
        { activityId: String(seeded.gym._id) },
        restrictedCtx,
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("FORBIDDEN");
        expect(response.error.message).toContain("Permission denied");
      }
    });

    it("should return NOT_FOUND for unknown tools", async () => {
      const response = await server.executeTool("notes.create", { text: "hello" }, ctx);

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("NOT_FOUND");
        expect(response.error.message).toContain("Tool 'notes.create' not found");
      }
    });

    it("should return VALIDATION_ERROR for malformed input", async () => {
      const response = await server.executeTool(
        "calendar.create",
        {
          title: "Missing fields",
        },
        ctx,
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("VALIDATION_ERROR");
      }
    });
  });

  describe("Multi-Tool Execution Flow Scenario", () => {
    it("should allow chaining tools to resolve 'Move gym after dinner'", async () => {
      // Step 1: List activities to find Gym and Dinner times
      const listRes = await server.executeTool(
        "calendar.list",
        {
          range: "day",
          date: "2026-09-09",
        },
        ctx,
      );
      expect(listRes.success).toBe(true);

      // Step 2: Check conflicts after dinner (21:30)
      const conflictRes = await server.executeTool(
        "calendar.conflicts",
        {
          startAt: "2026-09-09T21:30:00+05:30",
          endAt: "2026-09-09T22:30:00+05:30",
        },
        ctx,
      );
      expect(conflictRes.success).toBe(true);

      // Step 3: Suggest slot for 60 min
      const suggestRes = await server.executeTool(
        "calendar.suggest_slot",
        {
          date: "2026-09-09",
          durationMin: 60,
        },
        ctx,
      );
      expect(suggestRes.success).toBe(true);

      // Step 4: Reschedule Gym to 21:30
      const rescheduleRes = await server.executeTool(
        "calendar.reschedule",
        {
          activityId: String(seeded.gym._id),
          newStartAt: "2026-09-09T21:30:00+05:30",
          reason: "Move gym after dinner",
        },
        ctx,
      );
      expect(rescheduleRes.success).toBe(true);
    });
  });
});
