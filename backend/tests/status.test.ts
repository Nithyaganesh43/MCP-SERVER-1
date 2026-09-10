import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { ActivityModel } from "../model/index";
import { TEST_TIMEZONE } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("Status Lifecycle Tests", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it.each(["done", "cancelled", "missed"])("should support updating status from pending to %s", async (status) => {
    const createRes = await request.post("/activities").send({
      title: `Status test ${status}`,
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "moveable" },
      priority: 3,
    });

    const activityId = createRes.body.activityId;

    const updateRes = await request.patch(`/activities/${activityId}`).send({
      changes: { status },
    });

    expect(updateRes.status).toBe(200);

    const doc = await ActivityModel.findById(activityId);
    expect(doc?.status).toBe(status);
  });

  it("should reject invalid status string", async () => {
    const createRes = await request.post("/activities").send({
      title: "Status test invalid",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "moveable" },
      priority: 3,
    });

    const updateRes = await request.patch(`/activities/${createRes.body.activityId}`).send({
      changes: { status: "unknown_status" },
    });

    expect(updateRes.status).toBe(400);
  });
});
