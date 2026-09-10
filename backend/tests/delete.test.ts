import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { seedDatabase, type SeededActivities } from "./helpers/seed";
import { ActivityModel } from "../model/index";

const app = getTestApp();
const request = authedRequest(app);

describe("DELETE /activities/:id - Delete Tests", () => {
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

  it("should delete existing activity successfully", async () => {
    const gymId = seeded.gym._id.toString();

    const res = await request.delete(`/activities/${gymId}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const doc = await ActivityModel.findById(gymId);
    expect(doc).toBeNull();
  });

  it("should return 404 when deleting a non-existent activity", async () => {
    const fakeId = "000000000000000000000999";
    const res = await request.delete(`/activities/${fakeId}`);

    expect(res.status).toBe(404);
  });
});
