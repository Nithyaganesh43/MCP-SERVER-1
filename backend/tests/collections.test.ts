import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { OTHER_USER_ID, TEST_TIMEZONE, TEST_USER_ID } from "./helpers/seed";
import {
  ConversationStateModel,
  MemoryModel,
  SchedulingPreferenceModel,
} from "../model/index";

describe("Module 5 collections", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  describe("scheduling_preferences", () => {
    it("accepts a valid focus_duration value and timestamps", async () => {
      const created = await SchedulingPreferenceModel.create({
        userId: TEST_USER_ID,
        type: "focus_duration",
        value: { durationMin: 45 },
        timezone: TEST_TIMEZONE,
      });
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
      expect(String(created._id)).toMatch(/^[a-fA-F0-9]{24}$/);
    });

    it("rejects a value that does not match type", async () => {
      await expect(
        SchedulingPreferenceModel.create({
          userId: TEST_USER_ID,
          type: "focus_duration",
          value: { start: "06:00", end: "07:00" },
          timezone: TEST_TIMEZONE,
        }),
      ).rejects.toThrow();
    });

    it("enforces unique { userId, type }", async () => {
      await SchedulingPreferenceModel.create({
        userId: TEST_USER_ID,
        type: "quiet_hours",
        value: { start: "22:00", end: "06:00" },
        timezone: TEST_TIMEZONE,
      });
      await expect(
        SchedulingPreferenceModel.create({
          userId: TEST_USER_ID,
          type: "quiet_hours",
          value: { start: "21:00", end: "05:00" },
          timezone: TEST_TIMEZONE,
        }),
      ).rejects.toMatchObject({ code: 11000 });
    });

    it("does not return another user's preferences", async () => {
      await SchedulingPreferenceModel.create({
        userId: OTHER_USER_ID,
        type: "sleep_window",
        value: { start: "22:00", end: "05:00" },
        timezone: TEST_TIMEZONE,
      });
      const mine = await SchedulingPreferenceModel.find({
        userId: TEST_USER_ID,
      });
      expect(mine).toHaveLength(0);
    });
  });

  describe("memories", () => {
    it("defaults confidence and expiresAt", async () => {
      const created = await MemoryModel.create({
        userId: TEST_USER_ID,
        category: "goal",
        content: "Building Rytham",
      });
      expect(created.confidence).toBe(0.9);
      expect(created.expiresAt).toBeNull();
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
    });

    it("rejects an unknown category", async () => {
      await expect(
        MemoryModel.create({
          userId: TEST_USER_ID,
          category: "scheduling",
          content: "not a memory category",
        }),
      ).rejects.toThrow();
    });

    it("rejects confidence outside 0–1", async () => {
      await expect(
        MemoryModel.create({
          userId: TEST_USER_ID,
          category: "habit",
          content: "Runs daily",
          confidence: 1.1,
        }),
      ).rejects.toThrow();
    });

    it("requires expiresAt for temporary_preference", async () => {
      await expect(
        MemoryModel.create({
          userId: TEST_USER_ID,
          category: "temporary_preference",
          content: "Skip gym this week",
        }),
      ).rejects.toThrow(/expiresAt/);
      const created = await MemoryModel.create({
        userId: TEST_USER_ID,
        category: "temporary_preference",
        content: "Skip gym this week",
        expiresAt: new Date("2026-09-18T00:00:00.000Z"),
      });
      expect(created.expiresAt).toBeInstanceOf(Date);
    });

    it("does not return another user's memories", async () => {
      await MemoryModel.create({
        userId: OTHER_USER_ID,
        category: "relationship",
        content: "Friend likes coffee",
      });
      const mine = await MemoryModel.find({ userId: TEST_USER_ID });
      expect(mine).toHaveLength(0);
    });
  });

  describe("conversation_states", () => {
    it("stores defaults, updatedAt, and no createdAt", async () => {
      const created = await ConversationStateModel.create({
        userId: TEST_USER_ID,
      });
      expect(created.mission).toBe("");
      expect(created.context).toBe("");
      expect(created.entities).toEqual({});
      expect(created.updatedAt).toBeInstanceOf(Date);
      expect(
        (created.toObject() as { createdAt?: Date }).createdAt,
      ).toBeUndefined();
    });

    it("enforces one document per user", async () => {
      await ConversationStateModel.create({
        userId: TEST_USER_ID,
        mission: "Schedule gym",
        context: "User asked to move dinner",
        entities: { it: "dinner" },
      });
      await expect(
        ConversationStateModel.create({
          userId: TEST_USER_ID,
          mission: "other",
          context: "duplicate",
        }),
      ).rejects.toMatchObject({ code: 11000 });
    });

    it("does not return another user's conversation state", async () => {
      await ConversationStateModel.create({
        userId: OTHER_USER_ID,
        mission: "secret",
        context: "private",
        entities: { it: "meeting" },
      });
      const mine = await ConversationStateModel.find({
        userId: TEST_USER_ID,
      });
      expect(mine).toHaveLength(0);
    });
  });
});
