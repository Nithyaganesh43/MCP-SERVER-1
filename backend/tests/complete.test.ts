import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { seedDatabase, type SeededActivities } from "./helpers/seed";
import { ActivityModel } from "../model/index";

const app = getTestApp();
const request = authedRequest(app);

describe("POST /activities/:id/complete - Complete Tests", () => {
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

  it("should complete a pending activity", async () => {
    const gymId = seeded.gym._id.toString();

    const res = await request.post(`/activities/${gymId}/complete`).send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("done");

    const doc = await ActivityModel.findById(gymId);
    expect(doc?.status).toBe("done");
  });

  it("should remain done when completing an already completed activity", async () => {
    const gymId = seeded.gym._id.toString();

    await request.post(`/activities/${gymId}/complete`).send({});
    const res = await request.post(`/activities/${gymId}/complete`).send({});

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("done");

    const doc = await ActivityModel.findById(gymId);
    expect(doc?.status).toBe("done");
  });
});
