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

  it("should expand daily recurrence inside a day window without duplicating documents", async () => {
    const created = await request.post("/activities").send({
      title: "Nightly Review",
      schedule: {
        startAt: "2026-09-09T21:00:00+05:30",
        endAt: "2026-09-09T21:15:00+05:30",
        durationMin: 15,
        timezone: TEST_TIMEZONE,
      },
      behavior: {
        flexibility: "fixed",
        recurrence: { rule: "daily", interval: 1 },
      },
      priority: 3,
    });
    expect(created.status).toBe(201);

    const listed = await request.get("/activities").query({
      range: "day",
      date: "2026-09-11",
      timezone: TEST_TIMEZONE,
    });
    expect(listed.status).toBe(200);
    const matches = listed.body.activities.filter(
      (a: { title: string }) => a.title === "Nightly Review",
    );
    expect(matches).toHaveLength(1);
    expect(matches[0].activityId).toBe(created.body.activityId);
    expect(matches[0].startAt).toBe("2026-09-11T15:30:00.000Z");
    expect(await ActivityModel.countDocuments()).toBe(1);
  });

  it("should expand weekly recurrence only on listed ISO weekdays", async () => {
    const created = await request.post("/activities").send({
      title: "MWF Sync",
      schedule: {
        startAt: "2026-09-07T09:00:00+05:30",
        endAt: "2026-09-07T09:30:00+05:30",
        timezone: TEST_TIMEZONE,
      },
      behavior: {
        flexibility: "fixed",
        recurrence: { rule: "weekly", interval: 1, days: [1, 3, 5] },
      },
      priority: 4,
    });
    expect(created.status).toBe(201);

    const tuesday = await request.get("/activities").query({
      range: "day",
      date: "2026-09-08",
      timezone: TEST_TIMEZONE,
    });
    expect(tuesday.body.activities).toEqual([]);

    const wednesday = await request.get("/activities").query({
      range: "day",
      date: "2026-09-09",
      timezone: TEST_TIMEZONE,
    });
    const titles = wednesday.body.activities.map((a: { title: string }) => a.title);
    expect(titles).toContain("MWF Sync");
  });

  it("should expand monthly and yearly recurrence into later windows", async () => {
    await request.post("/activities").send({
      title: "Rent",
      schedule: {
        startAt: "2026-09-09T08:00:00+05:30",
        endAt: "2026-09-09T08:15:00+05:30",
        timezone: TEST_TIMEZONE,
      },
      behavior: {
        flexibility: "fixed",
        recurrence: { rule: "monthly", interval: 1 },
      },
      priority: 5,
    });
    await request.post("/activities").send({
      title: "Birthday",
      schedule: {
        startAt: "2026-09-09T12:00:00+05:30",
        endAt: "2026-09-09T13:00:00+05:30",
        timezone: TEST_TIMEZONE,
      },
      behavior: {
        flexibility: "moveable",
        recurrence: { rule: "yearly", interval: 1 },
      },
      priority: 3,
    });

    const october = await request.get("/activities").query({
      range: "day",
      date: "2026-10-09",
      timezone: TEST_TIMEZONE,
    });
    const octoberTitles = october.body.activities.map((a: { title: string }) => a.title);
    expect(octoberTitles).toContain("Rent");
    expect(octoberTitles).not.toContain("Birthday");

    const nextYear = await request.get("/activities").query({
      range: "day",
      date: "2027-09-09",
      timezone: TEST_TIMEZONE,
    });
    const nextYearTitles = nextYear.body.activities.map((a: { title: string }) => a.title);
    expect(nextYearTitles).toContain("Birthday");
    expect(nextYearTitles).toContain("Rent");
  });

  it("should stop expanding when until is reached", async () => {
    await request.post("/activities").send({
      title: "Short Series",
      schedule: {
        startAt: "2026-09-09T07:00:00+05:30",
        endAt: "2026-09-09T07:30:00+05:30",
        timezone: TEST_TIMEZONE,
      },
      behavior: {
        flexibility: "fixed",
        recurrence: {
          rule: "daily",
          interval: 1,
          until: "2026-09-10T07:00:00+05:30",
        },
      },
      priority: 3,
    });

    const last = await request.get("/activities").query({
      range: "day",
      date: "2026-09-10",
      timezone: TEST_TIMEZONE,
    });
    expect(last.body.activities.map((a: { title: string }) => a.title)).toContain("Short Series");

    const after = await request.get("/activities").query({
      range: "day",
      date: "2026-09-11",
      timezone: TEST_TIMEZONE,
    });
    expect(after.body.activities.map((a: { title: string }) => a.title)).not.toContain(
      "Short Series",
    );
  });
});
