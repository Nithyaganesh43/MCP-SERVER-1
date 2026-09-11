import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { seedDatabase, TEST_TIMEZONE } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("Buffer Intelligence Tests (Travel & Time Buffers)", () => {
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

  it("should enforce bufferAfterMin (15 min meeting buffer)", async () => {
    // Create event 10:00-11:00 with 15 min bufferAfterMin
    const createRes = await request.post("/activities").send({
      title: "Client Sync",
      schedule: {
        startAt: "2026-09-12T10:00:00.000Z",
        endAt: "2026-09-12T11:00:00.000Z",
        bufferAfterMin: 15,
        timezone: TEST_TIMEZONE,
      },
      behavior: { flexibility: "fixed" },
      priority: 5,
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.activityId).toBeDefined();

    // Check conflicts between 11:00 and 11:15 (should conflict due to bufferAfterMin)
    const conflictRes = await request.post("/calendar/conflicts").send({
      startAt: "2026-09-12T11:00:00.000Z",
      endAt: "2026-09-12T11:15:00.000Z",
    });

    expect(conflictRes.status).toBe(200);
    expect(conflictRes.body.conflicts.length).toBeGreaterThan(0);
    expect(conflictRes.body.conflicts[0].title).toBe("Client Sync");
  });

  it("should enforce bufferBeforeMin (30 min travel buffer)", async () => {
    // Create office meeting 09:00-10:00 with 30 min bufferBeforeMin
    const createRes = await request.post("/activities").send({
      title: "Onsite Interview",
      schedule: {
        startAt: "2026-09-12T09:00:00.000Z",
        endAt: "2026-09-12T10:00:00.000Z",
        bufferBeforeMin: 30,
        timezone: TEST_TIMEZONE,
      },
      behavior: { flexibility: "fixed" },
      priority: 5,
    });

    expect(createRes.status).toBe(201);

    // Check conflicts between 08:30 and 09:00 (should conflict due to travel buffer)
    const conflictRes = await request.post("/calendar/conflicts").send({
      startAt: "2026-09-12T08:30:00.000Z",
      endAt: "2026-09-12T09:00:00.000Z",
    });

    expect(conflictRes.status).toBe(200);
    expect(conflictRes.body.conflicts.length).toBeGreaterThan(0);
    expect(conflictRes.body.conflicts[0].title).toBe("Onsite Interview");
  });
});
