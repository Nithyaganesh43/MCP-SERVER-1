import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { ActivityModel } from "../model/index";
import { TEST_TIMEZONE } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("Reminder Tests", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it("should create activity with single reminder", async () => {
    const res = await request.post("/activities").send({
      title: "Dentist",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "fixed" },
      priority: 3,
      reminders: [{ beforeMin: 15 }],
    });

    expect(res.status).toBe(201);
    const doc = await ActivityModel.findById(res.body.activityId).lean();
    expect(doc?.reminders).toEqual([{ beforeMin: 15 }]);
  });

  it("should create activity with multiple reminders", async () => {
    const res = await request.post("/activities").send({
      title: "Flight Departure",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "fixed" },
      priority: 5,
      reminders: [{ beforeMin: 120 }, { beforeMin: 60 }, { beforeMin: 15 }],
    });

    expect(res.status).toBe(201);
    const doc = await ActivityModel.findById(res.body.activityId).lean();
    expect(doc?.reminders).toEqual([{ beforeMin: 120 }, { beforeMin: 60 }, { beforeMin: 15 }]);
  });

  it("should create activity with zero reminders (empty array)", async () => {
    const res = await request.post("/activities").send({
      title: "Quiet Task",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "floating" },
      priority: 1,
      reminders: [],
    });

    expect(res.status).toBe(201);
    const doc = await ActivityModel.findById(res.body.activityId).lean();
    expect(doc?.reminders).toEqual([]);
  });

  it("should reject negative reminder offset", async () => {
    const res = await request.post("/activities").send({
      title: "Invalid Reminder",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "fixed" },
      priority: 3,
      reminders: [{ beforeMin: -10 }],
    });

    expect(res.status).toBe(400);
  });
});
