import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { seedDatabase } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("POST /calendar/conflicts - Conflict Detection Tests", () => {
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

  it("should return existing Dinner conflict when checking 8 PM - 11 PM range", async () => {
    const res = await request.post("/calendar/conflicts").send({
      startAt: "2026-09-09T20:00:00+05:30",
      endAt: "2026-09-09T23:00:00+05:30",
    });

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.conflicts)).toBe(true);

    const titles = res.body.conflicts.map((c: { title: string }) => c.title);
    expect(titles).toContain("Dinner");
  });

  it("should not return a conflict when events touch exact boundaries", async () => {
    const res = await request.post("/calendar/conflicts").send({
      startAt: "2026-09-09T11:00:00+05:30",
      endAt: "2026-09-09T13:00:00+05:30",
    });

    expect(res.status).toBe(200);
    const titles = res.body.conflicts.map((c: { title: string }) => c.title);
    expect(titles).not.toContain("Dell Meeting");
    expect(titles).not.toContain("Lunch");
  });

  it("should detect conflict when new range fully contains an existing activity", async () => {
    const res = await request.post("/calendar/conflicts").send({
      startAt: "2026-09-09T20:00:00+05:30",
      endAt: "2026-09-09T22:00:00+05:30",
    });

    expect(res.status).toBe(200);
    const titles = res.body.conflicts.map((c: { title: string }) => c.title);
    expect(titles).toContain("Dinner");
  });

  it("should detect partial overlap conflict", async () => {
    const res = await request.post("/calendar/conflicts").send({
      startAt: "2026-09-09T10:30:00+05:30",
      endAt: "2026-09-09T11:30:00+05:30",
    });

    expect(res.status).toBe(200);
    const titles = res.body.conflicts.map((c: { title: string }) => c.title);
    expect(titles).toContain("Dell Meeting");
  });
});
