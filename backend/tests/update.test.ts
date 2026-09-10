import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { seedDatabase, type SeededActivities } from "./helpers/seed";
import { ActivityModel } from "../model/index";

const app = getTestApp();
const request = authedRequest(app);

describe("PATCH /activities/:id - Update Tests", () => {
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

  it("should update title, note, priority, reminders, and recurrence while keeping other fields unchanged", async () => {
    const gymId = seeded.gym._id.toString();

    const payload = {
      changes: {
        title: "Heavy Leg Day",
        note: "Updated workout note",
        priority: 5,
        reminders: [{ beforeMin: 45 }],
        "behavior.recurrence.rule": "weekly",
      },
    };

    const res = await request.patch(`/activities/${gymId}`).send(payload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const updated = await ActivityModel.findById(gymId).lean();
    expect(updated).not.toBeNull();
    expect(updated?.title).toBe("Heavy Leg Day");
    expect(updated?.note).toBe("Updated workout note");
    expect(updated?.priority).toBe(5);
    expect(updated?.reminders).toEqual([{ beforeMin: 45 }]);
    expect(updated?.behavior.recurrence.rule).toBe("weekly");

    // Unchanged fields sanity check
    expect(updated?.category).toBe(seeded.gym.category);
    expect(updated?.behavior.flexibility).toBe(seeded.gym.behavior.flexibility);
    expect(updated?.schedule.timezone).toBe(seeded.gym.schedule.timezone);
  });

  it("should fail when changes object is empty", async () => {
    const gymId = seeded.gym._id.toString();
    const res = await request.patch(`/activities/${gymId}`).send({ changes: {} });
    expect(res.status).toBe(400);
  });

  it("should return 404 for updating non-existent activity", async () => {
    const fakeId = "000000000000000000000999";
    const res = await request.patch(`/activities/${fakeId}`).send({
      changes: { title: "Ghost" },
    });
    expect(res.status).toBe(404);
  });
});
