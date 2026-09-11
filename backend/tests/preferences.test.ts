import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { seedDatabase, TEST_TIMEZONE } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("Scheduling preferences adapter (calendar.user_preferences)", () => {
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

  it("should update and fetch user preferences", async () => {
    const updateRes = await request.post("/calendar/user-preferences").send({
      action: "update",
      preferences: {
        bestLearningWindow: { startHour: 6, endHour: 7 },
        quietHours: { startHour: 22, endHour: 6 },
        focusDurationMin: 45,
        maxDailyHighPriorityTasks: 3,
      },
    });

    expect(updateRes.status).toBe(200);
    expect(updateRes.body.preferences.focusDurationMin).toBe(45);

    const getRes = await request.post("/calendar/user-preferences").send({
      action: "get",
    });

    expect(getRes.status).toBe(200);
    expect(getRes.body.preferences.bestLearningWindow.startHour).toBe(6);
  });

  it("should prioritize best learning window in suggest_slot", async () => {
    // Set 6-7 AM as best learning window
    await request.post("/calendar/user-preferences").send({
      action: "update",
      preferences: {
        bestLearningWindow: { startHour: 6, endHour: 7 },
      },
    });

    const suggestRes = await request.post("/calendar/suggest-slot").send({
      date: "2026-09-15",
      durationMin: 45,
      timezone: TEST_TIMEZONE,
    });

    expect(suggestRes.status).toBe(200);
    expect(suggestRes.body.suggestedStart).toBe("06:00");
    expect(suggestRes.body.reason).toMatch(/preferred learning window/);
  });
});
