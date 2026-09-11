import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { seedDatabase, TEST_TIMEZONE } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("Calendar Undo Tests (calendar.undo)", () => {
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

  it("should undo activity creation", async () => {
    const createRes = await request.post("/activities").send({
      title: "Undo Target Activity",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "moveable" },
      priority: 3,
    });
    const activityId = createRes.body.activityId;

    const undoRes = await request.post("/calendar/undo").send({});
    expect(undoRes.status).toBe(200);
    expect(undoRes.body.success).toBe(true);
    expect(undoRes.body.message).toMatch(/Reverted creation/);

    // Verify activity no longer exists
    const getRes = await request.get("/activities?range=day&date=2026-09-09");
    const found = getRes.body.activities.find(
      (a: { activityId: string }) => a.activityId === activityId,
    );
    expect(found).toBeUndefined();
  });

  it("should undo activity completion", async () => {
    const listRes = await request.get("/activities?range=day&date=2026-09-09");
    const gym = listRes.body.activities.find(
      (a: { title: string }) => a.title === "Gym",
    );

    // Complete Gym
    await request.post(`/activities/${gym.activityId}/complete`).send({});

    // Undo completion
    const undoRes = await request.post("/calendar/undo").send({});
    expect(undoRes.status).toBe(200);
    expect(undoRes.body.success).toBe(true);

    // Verify Gym status is pending again
    const checkRes = await request.get("/activities?range=day&date=2026-09-09");
    const gymCheck = checkRes.body.activities.find(
      (a: { title: string }) => a.title === "Gym",
    );
    expect(gymCheck.status).toBe("pending");
  });
});
