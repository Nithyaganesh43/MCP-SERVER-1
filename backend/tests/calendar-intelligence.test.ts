import { connectTestDb, clearTestDb, closeTestDb } from "./helpers/db";
import { seedDatabase, TEST_USER_ID_HEX, SeededActivities } from "./helpers/seed";
import { createMcpServer, McpServer } from "../mcp/server";
import { ToolRegistry } from "../mcp/registry";
import { createUserContext } from "../mcp/context";
import { TEST_JWT_SECRET, otherUserJwt, validJwt } from "./helpers/auth";
import { UserContext } from "../mcp/manifest";
import { SchedulingPreferenceModel } from "../model/index";
import { Types } from "mongoose";

describe("Calendar Intelligence Module (v1.0)", () => {
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
    it("should discover 7 calendar intelligence tools", () => {
      const { tools } = server.discoverTools();
      const intelligenceTools = tools
        .filter((t) => t.name.startsWith("calendar.preferences.") || t.name.startsWith("calendar.capacity.") || t.name.startsWith("calendar.missed.") || t.name === "calendar.preview")
        .map((t) => t.name)
        .sort();

      expect(intelligenceTools).toEqual([
        "calendar.capacity.check",
        "calendar.missed.review",
        "calendar.preferences.delete",
        "calendar.preferences.get",
        "calendar.preferences.save",
        "calendar.preferences.update",
        "calendar.preview",
      ]);
      
      // Note: calendar.split_task exists in calendar module, not intelligence module
      const splitTask = tools.find((t) => t.name === "calendar.split_task");
      expect(splitTask).toBeDefined();
    });
  });

  describe("calendar.preferences.save", () => {
    it("should save a sleep_window preference", async () => {
      const response = await server.executeTool(
        "calendar.preferences.save",
        {
          type: "sleep_window",
          value: { start: "22:00", end: "05:00" },
          timezone: "Asia/Kolkata",
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          success: true;
          preferenceId: string;
          message: string;
        };
        expect(data.preferenceId).toMatch(/^[a-f0-9]{24}$/);
        expect(data.message).toContain("sleep_window");
      }
    });

    it("should save a workload_limit preference", async () => {
      const response = await server.executeTool(
        "calendar.preferences.save",
        {
          type: "workload_limit",
          value: { maxImportant: 3 },
          timezone: "Asia/Kolkata",
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          success: true;
          preferenceId: string;
          message: string;
        };
        expect(data.message).toContain("workload_limit");
      }
    });

    it("should upsert when saving the same type twice", async () => {
      // First save
      const response1 = await server.executeTool(
        "calendar.preferences.save",
        {
          type: "focus_duration",
          value: { durationMin: 45 },
          timezone: "Asia/Kolkata",
        },
        ctx,
      );
      expect(response1.success).toBe(true);

      // Second save (upsert)
      const response2 = await server.executeTool(
        "calendar.preferences.save",
        {
          type: "focus_duration",
          value: { durationMin: 60 },
          timezone: "Asia/Kolkata",
        },
        ctx,
      );
      expect(response2.success).toBe(true);

      // Check that only one preference exists
      const getResponse = await server.executeTool(
        "calendar.preferences.get",
        { types: ["focus_duration"] },
        ctx,
      );
      expect(getResponse.success).toBe(true);
      if (getResponse.success) {
        const data = getResponse.data as { preferences: any[] };
        expect(data.preferences.length).toBe(1);
        expect(data.preferences[0].value.durationMin).toBe(60);
      }
    });

    it("should reject invalid preference type", async () => {
      const response = await server.executeTool(
        "calendar.preferences.save",
        {
          type: "invalid_type",
          value: { test: 123 },
          timezone: "Asia/Kolkata",
        },
        ctx,
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.message).toContain("Invalid preference type");
      }
    });
  });

  describe("calendar.preferences.get", () => {
    beforeEach(async () => {
      // Seed some preferences
      await server.executeTool(
        "calendar.preferences.save",
        {
          type: "sleep_window",
          value: { start: "22:00", end: "05:00" },
          timezone: "Asia/Kolkata",
        },
        ctx,
      );
      await server.executeTool(
        "calendar.preferences.save",
        {
          type: "learning_window",
          value: { start: "06:00", end: "07:00" },
          timezone: "Asia/Kolkata",
        },
        ctx,
      );
    });

    it("should get all preferences when types not specified", async () => {
      const response = await server.executeTool("calendar.preferences.get", {}, ctx);

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { preferences: any[] };
        expect(data.preferences.length).toBe(2);
      }
    });

    it("should filter preferences by types", async () => {
      const response = await server.executeTool(
        "calendar.preferences.get",
        { types: ["sleep_window"] },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { preferences: any[] };
        expect(data.preferences.length).toBe(1);
        expect(data.preferences[0].type).toBe("sleep_window");
        expect(data.preferences[0].value.start).toBe("22:00");
      }
    });

    it("should return empty array when no preferences exist", async () => {
      const otherCtx = createUserContext({ jwt: otherUserJwt() });
      const response = await server.executeTool("calendar.preferences.get", {}, otherCtx);

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { preferences: any[] };
        expect(data.preferences.length).toBe(0);
      }
    });
  });

  describe("calendar.preferences.update", () => {
    it("should update an existing preference", async () => {
      const saveResponse = await server.executeTool(
        "calendar.preferences.save",
        {
          type: "commute",
          value: { durationMin: 30 },
          timezone: "Asia/Kolkata",
        },
        ctx,
      );
      expect(saveResponse.success).toBe(true);
      if (!saveResponse.success) return;
      const preferenceId = (saveResponse.data as { preferenceId: string }).preferenceId;

      const updateResponse = await server.executeTool(
        "calendar.preferences.update",
        {
          preferenceId,
          value: { durationMin: 45 },
        },
        ctx,
      );

      expect(updateResponse.success).toBe(true);

      // Verify update
      const getResponse = await server.executeTool(
        "calendar.preferences.get",
        { types: ["commute"] },
        ctx,
      );
      expect(getResponse.success).toBe(true);
      if (getResponse.success) {
        const data = getResponse.data as { preferences: any[] };
        expect(data.preferences[0].value.durationMin).toBe(45);
      }
    });

    it("should return 404 for non-existent preference", async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await server.executeTool(
        "calendar.preferences.update",
        {
          preferenceId: fakeId,
          value: { durationMin: 45 },
        },
        ctx,
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("calendar.preferences.delete", () => {
    it("should delete an existing preference", async () => {
      const saveResponse = await server.executeTool(
        "calendar.preferences.save",
        {
          type: "quiet_hours",
          value: { start: "21:00", end: "22:00" },
          timezone: "Asia/Kolkata",
        },
        ctx,
      );
      expect(saveResponse.success).toBe(true);
      if (!saveResponse.success) return;
      const preferenceId = (saveResponse.data as { preferenceId: string }).preferenceId;

      const deleteResponse = await server.executeTool(
        "calendar.preferences.delete",
        { preferenceId },
        ctx,
      );

      expect(deleteResponse.success).toBe(true);

      // Verify deletion
      const getResponse = await server.executeTool(
        "calendar.preferences.get",
        { types: ["quiet_hours"] },
        ctx,
      );
      expect(getResponse.success).toBe(true);
      if (getResponse.success) {
        const data = getResponse.data as { preferences: any[] };
        expect(data.preferences.length).toBe(0);
      }
    });

    it("should return 404 for non-existent preference", async () => {
      const fakeId = new Types.ObjectId().toString();
      const response = await server.executeTool(
        "calendar.preferences.delete",
        { preferenceId: fakeId },
        ctx,
      );

      expect(response.success).toBe(false);
      if (!response.success) {
        expect(response.error.code).toBe("NOT_FOUND");
      }
    });
  });

  describe("calendar.capacity.check", () => {
    it("should check capacity without limit preference", async () => {
      const response = await server.executeTool(
        "calendar.capacity.check",
        {
          date: "2026-09-09",
          timezone: "Asia/Kolkata",
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          exceedsLimit: boolean;
          count: number;
          limit: number | null;
          date: string;
        };
        expect(data.count).toBeGreaterThanOrEqual(0); // May have priority >= 4 activities
        expect(data.limit).toBeNull();
        expect(data.exceedsLimit).toBe(false);
        expect(data.date).toBe("2026-09-09");
      }
    });

    it("should check capacity with limit preference", async () => {
      // Set workload limit
      await server.executeTool(
        "calendar.preferences.save",
        {
          type: "workload_limit",
          value: { maxImportant: 1 },
          timezone: "Asia/Kolkata",
        },
        ctx,
      );

      const response = await server.executeTool(
        "calendar.capacity.check",
        {
          date: "2026-09-09",
          timezone: "Asia/Kolkata",
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          exceedsLimit: boolean;
          count: number;
          limit: number | null;
          date: string;
        };
        expect(data.limit).toBe(1);
        // Seeded data has Dell Meeting (priority 5), Lunch (priority 4), and Dinner (priority 5) on 2026-09-09
        // So count should be 3, and exceedsLimit should be true
        expect(data.count).toBe(3);
        expect(data.exceedsLimit).toBe(true);
      }
    });
  });

  describe("calendar.missed.review", () => {
    it("should find missed activities", async () => {
      // Mark an activity as missed (update existing seeded activity)
      const listResponse = await server.executeTool(
        "calendar.list",
        {
          range: "day",
          date: "2026-09-09",
        },
        ctx,
      );
      expect(listResponse.success).toBe(true);
      if (!listResponse.success) return;
      const activities = (listResponse.data as { activities: { activityId: string }[] }).activities;
      const activityId = activities[0].activityId;

      // Update status to missed
      await server.executeTool(
        "calendar.update",
        {
          activityId,
          changes: { status: "missed" },
        },
        ctx,
      );

      const response = await server.executeTool(
        "calendar.missed.review",
        {
          date: "2026-09-10",
          timezone: "Asia/Kolkata",
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          missed: any[];
          suggestions: any[];
        };
        expect(data.missed.length).toBeGreaterThanOrEqual(1);
        expect(data.suggestions.length).toBeGreaterThanOrEqual(0);
      }
    });

    it("should return empty arrays when no missed activities", async () => {
      const response = await server.executeTool(
        "calendar.missed.review",
        {
          date: "2026-09-09",
          timezone: "Asia/Kolkata",
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          missed: any[];
          suggestions: any[];
        };
        expect(data.missed.length).toBe(0);
        expect(data.suggestions.length).toBe(0);
      }
    });
  });

  // Note: calendar.split_task tests are in the calendar module tests, not here

  describe("calendar.preview", () => {
    it("should generate a day preview", async () => {
      const response = await server.executeTool(
        "calendar.preview",
        {
          date: "2026-09-09",
          timezone: "Asia/Kolkata",
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          activities: any[];
          workload: { count: number; limit: number | null };
        };
        expect(data.summary).toContain("2026-09-09");
        expect(data.activities).toBeDefined();
        expect(data.workload.count).toBeGreaterThanOrEqual(0);
        expect(data.workload.limit).toBeNull();
      }
    });

    it("should include workload limit in preview", async () => {
      await server.executeTool(
        "calendar.preferences.save",
        {
          type: "workload_limit",
          value: { maxImportant: 2 },
          timezone: "Asia/Kolkata",
        },
        ctx,
      );

      const response = await server.executeTool(
        "calendar.preview",
        {
          date: "2026-09-09",
          timezone: "Asia/Kolkata",
        },
        ctx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as {
          summary: string;
          activities: any[];
          workload: { count: number; limit: number | null };
        };
        expect(data.workload.limit).toBe(2);
      }
    });
  });

  describe("User Isolation", () => {
    it("should not access other user's preferences", async () => {
      // Save preference for user A
      await server.executeTool(
        "calendar.preferences.save",
        {
          type: "sleep_window",
          value: { start: "22:00", end: "05:00" },
          timezone: "Asia/Kolkata",
        },
        ctx,
      );

      // Query as user B
      const otherCtx = createUserContext({ jwt: otherUserJwt() });
      const response = await server.executeTool(
        "calendar.preferences.get",
        { types: ["sleep_window"] },
        otherCtx,
      );

      expect(response.success).toBe(true);
      if (response.success) {
        const data = response.data as { preferences: any[] };
        expect(data.preferences.length).toBe(0);
      }
    });
  });

  describe("Unique Constraint", () => {
    it("should enforce unique (userId, type) constraint via upsert", async () => {
      // First save
      const response1 = await server.executeTool(
        "calendar.preferences.save",
        {
          type: "exam_planning",
          value: { enabled: true, daysBeforeExam: 7 },
          timezone: "Asia/Kolkata",
        },
        ctx,
      );
      expect(response1.success).toBe(true);
      if (!response1.success) return;
      const preferenceId1 = (response1.data as { preferenceId: string }).preferenceId;

      // Second save (should upsert, not create duplicate)
      const response2 = await server.executeTool(
        "calendar.preferences.save",
        {
          type: "exam_planning",
          value: { enabled: true, daysBeforeExam: 10 },
          timezone: "Asia/Kolkata",
        },
        ctx,
      );
      expect(response2.success).toBe(true);
      if (!response2.success) return;
      const preferenceId2 = (response2.data as { preferenceId: string }).preferenceId;

      // Verify same ID (upsert)
      expect(preferenceId1).toBe(preferenceId2);

      // Verify only one exists
      const prefs = await SchedulingPreferenceModel.find({
        userId: new Types.ObjectId(TEST_USER_ID_HEX),
        type: "exam_planning",
      });
      expect(prefs.length).toBe(1);
      expect((prefs[0].value as any).daysBeforeExam).toBe(10);
    });
  });
});
