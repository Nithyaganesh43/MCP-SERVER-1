import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { ActivityModel } from "../model/index";
import { TEST_USER_ID, TEST_TIMEZONE } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("POST /activities - Create Tests", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it("should create a valid event with HTTP 201 and correct timestamps", async () => {
    const payload = {
      title: "Tomorrow project",
      note: "Project work",
      category: "work",
      schedule: {
        startAt: "2026-09-10T08:00:00+05:30",
        endAt: "2026-09-10T11:00:00+05:30",
        timezone: TEST_TIMEZONE,
      },
      behavior: {
        flexibility: "moveable",
        recurrence: { rule: "none" },
      },
      priority: 4,
    };

    const res = await request.post("/activities").send(payload);

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.activityId).toBeDefined();

    const created = await ActivityModel.findById(res.body.activityId);
    expect(created).not.toBeNull();
    expect(created?.title).toBe("Tomorrow project");
    expect(created?.userId.toString()).toBe(TEST_USER_ID.toString());
    expect(created?.schedule.startAt?.toISOString()).toBe(new Date("2026-09-10T08:00:00+05:30").toISOString());
    expect(created?.schedule.endAt?.toISOString()).toBe(new Date("2026-09-10T11:00:00+05:30").toISOString());
  });

  it("should support startAt and durationMin payload", async () => {
    const payload = {
      title: "Quick Standup",
      schedule: {
        startAt: "2026-09-10T09:00:00+05:30",
        durationMin: 30,
        timezone: TEST_TIMEZONE,
      },
      behavior: { flexibility: "fixed" },
      priority: 3,
    };

    const res = await request.post("/activities").send(payload);

    expect(res.status).toBe(201);
    const created = await ActivityModel.findById(res.body.activityId);
    expect(created?.schedule.durationMin).toBe(30);
    expect(created?.schedule.startAt?.toISOString()).toBe(new Date("2026-09-10T09:00:00+05:30").toISOString());
  });

  it("should fail validation when title is missing", async () => {
    const payload = {
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "moveable" },
      priority: 3,
    };

    const res = await request.post("/activities").send(payload);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should fail validation on invalid ISO date format", async () => {
    const payload = {
      title: "Invalid Date Event",
      schedule: {
        startAt: "invalid-date-string",
        timezone: TEST_TIMEZONE,
      },
      behavior: { flexibility: "moveable" },
      priority: 3,
    };

    const res = await request.post("/activities").send(payload);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should fail validation on negative durationMin", async () => {
    const payload = {
      title: "Negative Duration Event",
      schedule: {
        durationMin: -15,
        timezone: TEST_TIMEZONE,
      },
      behavior: { flexibility: "moveable" },
      priority: 3,
    };

    const res = await request.post("/activities").send(payload);
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should handle duplicate submission cleanly creating separate documents", async () => {
    const payload = {
      title: "Identical Task",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "floating" },
      priority: 2,
    };

    const res1 = await request.post("/activities").send(payload);
    const res2 = await request.post("/activities").send(payload);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(res1.body.activityId).not.toBe(res2.body.activityId);

    const count = await ActivityModel.countDocuments({ title: "Identical Task" });
    expect(count).toBe(2);
  });
});
