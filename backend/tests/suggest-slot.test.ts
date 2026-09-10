import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { seedDatabase, TEST_TIMEZONE } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("POST /calendar/suggest-slot - Suggest Slot Tests", () => {
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

  it("should suggest the best available slot for 60 minutes request", async () => {
    const res = await request.post("/calendar/suggest-slot").send({
      date: "2026-09-09",
      durationMin: 60,
      timezone: TEST_TIMEZONE,
    });

    expect(res.status).toBe(200);
    expect(res.body.suggestedStart).toBeDefined();
    expect(res.body.suggestedEnd).toBeDefined();
  });

  it("should reserve unscheduled floating tasks when suggesting a slot", async () => {
    await request.post("/activities").send({
      title: "Deep work",
      schedule: {
        timezone: TEST_TIMEZONE,
        durationMin: 540,
        startAt: null,
        endAt: null,
      },
      behavior: { flexibility: "floating" },
      priority: 5,
    });

    const res = await request.post("/calendar/suggest-slot").send({
      date: "2026-09-09",
      durationMin: 300,
      timezone: TEST_TIMEZONE,
    });

    expect(res.status).toBe(200);
    expect(res.body.suggestedStart).toBeNull();
    expect(res.body.suggestedEnd).toBeNull();
    expect(res.body.reason).toMatch(/No free slot/);
  });

  it("should handle impossible duration when no free slot fits", async () => {
    const res = await request.post("/calendar/suggest-slot").send({
      date: "2026-09-09",
      durationMin: 1440, // 24 hours
      timezone: TEST_TIMEZONE,
    });

    expect(res.status).toBe(200);
    expect(res.body.suggestedStart).toBeNull();
    expect(res.body.suggestedEnd).toBeNull();
    expect(res.body.reason).toMatch(/No free slot/);
  });

  it("should treat expanded recurring Dinner as occupied on the next day", async () => {
    const res = await request.post("/calendar/suggest-slot").send({
      date: "2026-09-10",
      durationMin: 60,
      timezone: TEST_TIMEZONE,
    });

    expect(res.status).toBe(200);
    expect(res.body.suggestedStart).toBe("00:00");
    expect(res.body.suggestedEnd).toBe("01:00");
    expect(res.body.reason).toBe("Largest free slot before Dinner.");
  });
});
