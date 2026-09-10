import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { ActivityModel } from "../model/index";
import { TEST_TIMEZONE } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("Concurrency Tests", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it("should succeed when executing two simultaneous create requests", async () => {
    const payload1 = {
      title: "Concurrent Task 1",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "moveable" },
      priority: 3,
    };
    const payload2 = {
      title: "Concurrent Task 2",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "fixed" },
      priority: 4,
    };

    const [res1, res2] = await Promise.all([
      request.post("/activities").send(payload1),
      request.post("/activities").send(payload2),
    ]);

    expect(res1.status).toBe(201);
    expect(res2.status).toBe(201);
    expect(await ActivityModel.countDocuments()).toBe(2);
  });

  it("should handle simultaneous updates without document corruption", async () => {
    const createRes = await request.post("/activities").send({
      title: "Concurrent Update Base",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "moveable" },
      priority: 3,
    });
    const id = createRes.body.activityId;

    const [up1, up2] = await Promise.all([
      request.patch(`/activities/${id}`).send({ changes: { title: "Title A" } }),
      request.patch(`/activities/${id}`).send({ changes: { note: "Note B" } }),
    ]);

    expect(up1.status).toBe(200);
    expect(up2.status).toBe(200);

    const finalDoc = await ActivityModel.findById(id);
    expect(finalDoc).not.toBeNull();
    expect(["Title A", "Concurrent Update Base"]).toContain(finalDoc?.title);
  });

  it("should handle delete while updating gracefully", async () => {
    const createRes = await request.post("/activities").send({
      title: "Concurrent Delete Base",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "moveable" },
      priority: 3,
    });
    const id = createRes.body.activityId;

    const [delRes, upRes] = await Promise.all([
      request.delete(`/activities/${id}`),
      request.patch(`/activities/${id}`).send({ changes: { title: "Attempt Update" } }),
    ]);

    expect([200, 404]).toContain(delRes.status);
    expect([200, 404]).toContain(upRes.status);
  });
});
