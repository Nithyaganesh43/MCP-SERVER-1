import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { TEST_TIMEZONE } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("Timezone Tests", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it("should preserve input timezone and accurately format ISO UTC representation", async () => {
    const kolkataTime = "2026-09-09T14:30:00+05:30";
    const expectedUtcIso = new Date(kolkataTime).toISOString();

    const res = await request.post("/activities").send({
      title: "Timezone Test Activity",
      schedule: {
        startAt: kolkataTime,
        durationMin: 45,
        timezone: "Asia/Kolkata",
      },
      behavior: { flexibility: "fixed" },
      priority: 3,
    });

    expect(res.status).toBe(201);
    const activityId = res.body.activityId;

    const listRes = await request
      .get("/activities")
      .query({ range: "day", date: "2026-09-09", timezone: TEST_TIMEZONE });

    expect(listRes.status).toBe(200);
    const item = listRes.body.activities.find((a: { activityId: string }) => a.activityId === activityId);

    expect(item).toBeDefined();
    expect(item.timezone).toBe("Asia/Kolkata");
    expect(item.startAt).toBe(expectedUtcIso);
  });
});
