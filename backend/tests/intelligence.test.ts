import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { seedDatabase, TEST_TIMEZONE } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("Personal Assistant Intelligence Tests", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    await seedDatabase();
  });

  it("should issue daily capacity limit warning when exceeding 3 priority-5 tasks", async () => {
    // Priority 5 tasks are already present in seed database (Dell Meeting priority 5, Dinner priority 5)
    // Add two more priority 5 tasks
    await request.post("/activities").send({
      title: "High Priority 1",
      schedule: {
        startAt: "2026-09-09T03:00:00.000Z",
        timezone: TEST_TIMEZONE,
      },
      behavior: { flexibility: "fixed" },
      priority: 5,
    });

    const fourthTaskRes = await request.post("/activities").send({
      title: "High Priority 2",
      schedule: {
        startAt: "2026-09-09T04:00:00.000Z",
        timezone: TEST_TIMEZONE,
      },
      behavior: { flexibility: "fixed" },
      priority: 5,
    });

    expect(fourthTaskRes.status).toBe(201);
    expect(fourthTaskRes.body.message).toMatch(/Today already has \d+ important tasks/);
  });

  it("should issue duplicate warning when creating same title at same time", async () => {
    const dupRes = await request.post("/activities").send({
      title: "Dell Meeting",
      schedule: {
        startAt: "2026-09-09T04:30:00.000Z", // 10:00 AM IST in UTC
        timezone: TEST_TIMEZONE,
      },
      behavior: { flexibility: "fixed" },
      priority: 5,
    });

    expect(dupRes.status).toBe(201);
    expect(dupRes.body.message).toMatch(/duplicate activity already exists/);
  });

  it("should split long duration tasks into chunks across days", async () => {
    const splitRes = await request.post("/calendar/split-task").send({
      title: "Learn System Design",
      totalDurationMin: 180,
      maxChunkMin: 60,
      date: "2026-09-12",
      timezone: TEST_TIMEZONE,
    });

    expect(splitRes.status).toBe(200);
    expect(splitRes.body.chunks.length).toBe(3);
  });

  it("should analyze weekly summary and detect workload", async () => {
    const summaryRes = await request.post("/calendar/weekly-summary").send({
      date: "2026-09-09",
      timezone: TEST_TIMEZONE,
    });

    expect(summaryRes.status).toBe(200);
    expect(summaryRes.body.days.length).toBe(7);
    expect(summaryRes.body.freeDay).toBeDefined();
  });
});
