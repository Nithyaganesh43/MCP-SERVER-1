import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { seedDatabase, TEST_TIMEZONE } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("GET /activities - Read Tests", () => {
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

  it("should retrieve only today's activities in Day View", async () => {
    const res = await request
      .get("/activities")
      .query({ range: "day", date: "2026-09-09", timezone: TEST_TIMEZONE });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.activities)).toBe(true);
    expect(res.body.activities.length).toBe(5);
    const titles = res.body.activities.map((a: { title: string }) => a.title);
    expect(titles).toContain("Dell Meeting");
    expect(titles).toContain("Lunch");
    expect(titles).toContain("Gym");
    expect(titles).toContain("Dinner");
    expect(titles).toContain("Vitamin D");
  });

  it("should retrieve week activities in Week View", async () => {
    const res = await request
      .get("/activities")
      .query({ range: "week", date: "2026-09-09", timezone: TEST_TIMEZONE });

    expect(res.status).toBe(200);
    expect(res.body.activities.length).toBeGreaterThanOrEqual(5);
  });

  it("should retrieve month activities in Month View", async () => {
    const res = await request
      .get("/activities")
      .query({ range: "month", date: "2026-09-09", timezone: TEST_TIMEZONE });

    expect(res.status).toBe(200);
    expect(res.body.activities.length).toBeGreaterThanOrEqual(5);
  });

  it("should return an empty array for an Empty Day", async () => {
    const res = await request
      .get("/activities")
      .query({ range: "day", date: "2026-09-08", timezone: TEST_TIMEZONE });

    expect(res.status).toBe(200);
    expect(res.body.activities).toEqual([]);
  });

  it("should include the expanded daily Dinner on the next day", async () => {
    const res = await request
      .get("/activities")
      .query({ range: "day", date: "2026-09-10", timezone: TEST_TIMEZONE });

    expect(res.status).toBe(200);
    const dinners = res.body.activities.filter((a: { title: string }) => a.title === "Dinner");
    expect(dinners).toHaveLength(1);
    expect(dinners[0].startAt).toBe("2026-09-10T15:00:00.000Z");
    expect(dinners[0].endAt).toBe("2026-09-10T16:00:00.000Z");
  });

  it("should fail validation on invalid date format", async () => {
    const res = await request
      .get("/activities")
      .query({ range: "day", date: "09-09-2026", timezone: TEST_TIMEZONE });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
