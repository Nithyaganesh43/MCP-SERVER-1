import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { seedDatabase, type SeededActivities } from "./helpers/seed";
import { ActivityModel } from "../model/index";

const app = getTestApp();
const request = authedRequest(app);

describe("POST /activities/:id/reschedule - Reschedule Tests", () => {
  let seeded: SeededActivities;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    seeded = await seedDatabase();
  });

  it("should reschedule a moveable activity and store new startAt and endAt", async () => {
    const gymId = seeded.gym._id.toString();
    const newStart = "2026-09-09T19:00:00+05:30";

    const res = await request.post(`/activities/${gymId}/reschedule`).send({
      newStartAt: newStart,
      reason: "Postponed gym session",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const doc = await ActivityModel.findById(gymId);
    expect(doc?.schedule.startAt?.toISOString()).toBe(new Date(newStart).toISOString());
    expect(doc?.schedule.endAt?.toISOString()).toBe(new Date("2026-09-09T20:00:00+05:30").toISOString());
  });

  it("should reject rescheduling a fixed activity", async () => {
    const dellId = seeded.dellMeeting._id.toString();

    const res = await request.post(`/activities/${dellId}/reschedule`).send({
      newStartAt: "2026-09-09T11:00:00+05:30",
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it("should handle rescheduling across midnight accurately", async () => {
    const gymId = seeded.gym._id.toString();
    const lateStart = "2026-09-09T23:30:00+05:30";

    const res = await request.post(`/activities/${gymId}/reschedule`).send({
      newStartAt: lateStart,
    });

    expect(res.status).toBe(200);

    const doc = await ActivityModel.findById(gymId);
    expect(doc?.schedule.startAt?.toISOString()).toBe(new Date(lateStart).toISOString());
    expect(doc?.schedule.endAt?.toISOString()).toBe(new Date("2026-09-10T00:30:00+05:30").toISOString());
  });
});
