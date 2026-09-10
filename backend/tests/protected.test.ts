import request from "supertest";
import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp } from "./helpers/app";
import { authHeader, invalidJwt, validJwt } from "./helpers/auth";
import { seedDatabase, TEST_TIMEZONE, type SeededActivities } from "./helpers/seed";

const app = getTestApp();

type Case = {
  name: string;
  method: "get" | "post" | "patch" | "delete";
  path: string;
  body?: Record<string, unknown>;
  query?: Record<string, string>;
  success: number;
};

const CREATE_BODY = {
  title: "Auth Protected Create",
  schedule: { timezone: TEST_TIMEZONE },
  behavior: { flexibility: "floating" },
  priority: 2,
};

const NAMES = [
  "POST /activities",
  "GET /activities",
  "PATCH /activities/:id",
  "DELETE /activities/:id",
  "POST /activities/:id/complete",
  "POST /activities/:id/reschedule",
  "POST /calendar/conflicts",
  "POST /calendar/suggest-slot",
] as const;

function makeCase(name: (typeof NAMES)[number], seeded: SeededActivities): Case {
  const gymId = String(seeded.gym._id);
  switch (name) {
    case "POST /activities":
      return { name, method: "post", path: "/activities", body: CREATE_BODY, success: 201 };
    case "GET /activities":
      return {
        name,
        method: "get",
        path: "/activities",
        query: { range: "day", date: "2026-09-09", timezone: TEST_TIMEZONE },
        success: 200,
      };
    case "PATCH /activities/:id":
      return {
        name,
        method: "patch",
        path: `/activities/${gymId}`,
        body: { changes: { note: "auth update" } },
        success: 200,
      };
    case "DELETE /activities/:id":
      return { name, method: "delete", path: `/activities/${gymId}`, success: 200 };
    case "POST /activities/:id/complete":
      return {
        name,
        method: "post",
        path: `/activities/${gymId}/complete`,
        body: {},
        success: 200,
      };
    case "POST /activities/:id/reschedule":
      return {
        name,
        method: "post",
        path: `/activities/${gymId}/reschedule`,
        body: { newStartAt: "2026-09-09T19:00:00+05:30" },
        success: 200,
      };
    case "POST /calendar/conflicts":
      return {
        name,
        method: "post",
        path: "/calendar/conflicts",
        body: {
          startAt: "2026-09-09T10:00:00+05:30",
          endAt: "2026-09-09T11:00:00+05:30",
        },
        success: 200,
      };
    case "POST /calendar/suggest-slot":
      return {
        name,
        method: "post",
        path: "/calendar/suggest-slot",
        body: { date: "2026-09-09", durationMin: 30, timezone: TEST_TIMEZONE },
        success: 200,
      };
  }
}

describe("Protected Calendar API Tests", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  it("valid JWT → success on every Calendar endpoint", async () => {
    for (const name of NAMES) {
      await clearTestDb();
      const item = makeCase(name, await seedDatabase());
      const res = await run(item, validJwt());
      expect(`${item.name} ${res.status}`).toBe(`${item.name} ${item.success}`);
    }
  });

  it("missing JWT → 401 on every Calendar endpoint", async () => {
    await clearTestDb();
    const seeded = await seedDatabase();
    for (const name of NAMES) {
      const item = makeCase(name, seeded);
      const res = await run(item);
      expect(`${item.name} ${res.status}`).toBe(`${item.name} 401`);
    }
  });

  it("invalid JWT → 401 on every Calendar endpoint", async () => {
    await clearTestDb();
    const seeded = await seedDatabase();
    for (const name of NAMES) {
      const item = makeCase(name, seeded);
      const res = await run(item, invalidJwt());
      expect(`${item.name} ${res.status}`).toBe(`${item.name} 401`);
    }
  });
});

async function run(item: Case, token?: string) {
  let req = request(app)[item.method](item.path);
  if (token !== undefined) {
    req = req.set(authHeader(token));
  }
  if (item.query) {
    req = req.query(item.query);
  }
  if (item.body !== undefined) {
    req = req.send(item.body);
  }
  return req;
}
