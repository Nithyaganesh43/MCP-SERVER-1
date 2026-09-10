import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { ActivityModel } from "../model/index";
import { TEST_TIMEZONE } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("Recurrence Tests", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it("should create activity with daily recurrence", async () => {
    const res = await request.post("/activities").send({
      title: "Daily Standup",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: {
        flexibility: "fixed",
        recurrence: { rule: "daily", interval: 1 },
      },
      priority: 3,
    });

    expect(res.status).toBe(201);
    const doc = await ActivityModel.findById(res.body.activityId);
    expect(doc?.behavior.recurrence.rule).toBe("daily");
    expect(doc?.behavior.recurrence.interval).toBe(1);
  });

  it("should create activity with weekly recurrence preserving specified days", async () => {
    const res = await request.post("/activities").send({
      title: "Weekly Sprint Planning",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: {
        flexibility: "fixed",
        recurrence: { rule: "weekly", interval: 1, days: [1, 3, 5] },
      },
      priority: 4,
    });

    expect(res.status).toBe(201);
    const doc = await ActivityModel.findById(res.body.activityId);
    expect(doc?.behavior.recurrence.rule).toBe("weekly");
    expect(doc?.behavior.recurrence.days).toEqual([1, 3, 5]);
  });

  it("should create activity with monthly recurrence", async () => {
    const res = await request.post("/activities").send({
      title: "Monthly Rent Payment",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: {
        flexibility: "fixed",
        recurrence: { rule: "monthly", interval: 1 },
      },
      priority: 5,
    });

    expect(res.status).toBe(201);
    const doc = await ActivityModel.findById(res.body.activityId);
    expect(doc?.behavior.recurrence.rule).toBe("monthly");
  });

  it("should create activity with yearly recurrence", async () => {
    const res = await request.post("/activities").send({
      title: "Annual Health Checkup",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: {
        flexibility: "moveable",
        recurrence: { rule: "yearly", interval: 1 },
      },
      priority: 3,
    });

    expect(res.status).toBe(201);
    const doc = await ActivityModel.findById(res.body.activityId);
    expect(doc?.behavior.recurrence.rule).toBe("yearly");
  });
});
