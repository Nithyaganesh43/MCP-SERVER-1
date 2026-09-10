import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { ActivityModel } from "../model/index";
import { TEST_TIMEZONE } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("Database Integrity Tests", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it("should preserve createdAt, update updatedAt, maintain userId, and track document counts", async () => {
    const initialCount = await ActivityModel.countDocuments();
    expect(initialCount).toBe(0);

    const createRes = await request.post("/activities").send({
      title: "Integrity Test Task",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "fixed" },
      priority: 3,
    });

    const activityId = createRes.body.activityId;
    const docAfterCreate = await ActivityModel.findById(activityId);

    expect(docAfterCreate).not.toBeNull();
    const createdAtInitial = docAfterCreate!.createdAt.getTime();
    const updatedAtInitial = docAfterCreate!.updatedAt.getTime();
    const userIdInitial = docAfterCreate!.userId.toString();

    expect(await ActivityModel.countDocuments()).toBe(1);

    // Short pause to ensure timestamp diff
    await new Promise((resolve) => setTimeout(resolve, 50));

    await request.patch(`/activities/${activityId}`).send({
      changes: { note: "Updated note for integrity test" },
    });

    const docAfterUpdate = await ActivityModel.findById(activityId);
    expect(docAfterUpdate!.createdAt.getTime()).toBe(createdAtInitial);
    expect(docAfterUpdate!.updatedAt.getTime()).toBeGreaterThan(updatedAtInitial);
    expect(docAfterUpdate!.userId.toString()).toBe(userIdInitial);
    expect(await ActivityModel.countDocuments()).toBe(1);
  });
});
