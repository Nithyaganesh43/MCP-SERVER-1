import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { TEST_TIMEZONE } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("Priority Tests", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it.each([1, 2, 3, 4, 5])("should accept priority %i", async (priority) => {
    const res = await request.post("/activities").send({
      title: `Priority ${priority}`,
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "fixed" },
      priority,
    });

    expect(res.status).toBe(201);
  });

  it.each([0, 6, -1, 10])("should reject invalid priority %i", async (priority) => {
    const res = await request.post("/activities").send({
      title: `Invalid Priority ${priority}`,
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "fixed" },
      priority,
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
