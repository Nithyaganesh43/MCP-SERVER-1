import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { ActivityModel } from "../model/index";
import { TEST_TIMEZONE, TEST_USER_ID } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("Performance Smoke Tests", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();

    // Bulk seed 1,000 activities across September 2026
    const docs = [];
    const baseDate = new Date("2026-09-01T00:00:00+05:30").getTime();
    for (let i = 0; i < 1000; i++) {
      const offsetMs = (i % 30) * 24 * 3600 * 1000 + (i % 12) * 3600 * 1000;
      const startAt = new Date(baseDate + offsetMs);
      const endAt = new Date(startAt.getTime() + 1800000);
      docs.push({
        userId: TEST_USER_ID,
        title: `Bulk Activity ${i}`,
        note: "Performance test item",
        category: "perf",
        schedule: {
          startAt,
          endAt,
          durationMin: 30,
          timezone: TEST_TIMEZONE,
        },
        behavior: {
          flexibility: "moveable",
          recurrence: { rule: "none", interval: 1, days: [], until: null },
        },
        priority: (i % 5) + 1,
        reminders: [],
        status: "pending",
        tags: ["perf"],
        metadata: {},
        createdBy: "system",
      });
    }

    await ActivityModel.insertMany(docs);
  }, 30000);

  it("should respond quickly for Day View query with 1,000 seeded items", async () => {
    const start = Date.now();
    const res = await request
      .get("/activities")
      .query({ range: "day", date: "2026-09-15", timezone: TEST_TIMEZONE });
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(500);
  });

  it("should respond quickly for Week View query with 1,000 seeded items", async () => {
    const start = Date.now();
    const res = await request
      .get("/activities")
      .query({ range: "week", date: "2026-09-15", timezone: TEST_TIMEZONE });
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(500);
  });

  it("should respond quickly for Month View query with 1,000 seeded items", async () => {
    const start = Date.now();
    const res = await request
      .get("/activities")
      .query({ range: "month", date: "2026-09-15", timezone: TEST_TIMEZONE });
    const duration = Date.now() - start;

    expect(res.status).toBe(200);
    expect(duration).toBeLessThan(1000);
  });
});
