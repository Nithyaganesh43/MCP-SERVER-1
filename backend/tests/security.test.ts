import supertest from "supertest";
import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp, authedRequest } from "./helpers/app";
import { createApp } from "../calendar/http";
import { ActivityModel } from "../model/index";
import {
  TEST_GOOGLE_CALLBACK_URL,
  TEST_GOOGLE_CLIENT_ID,
  TEST_GOOGLE_CLIENT_SECRET,
  TEST_JWT_SECRET,
} from "./helpers/auth";
import { OTHER_USER_ID, TEST_TIMEZONE } from "./helpers/seed";

const app = getTestApp();
const request = authedRequest(app);

describe("Security & Validation Tests", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
  });

  it("should reject invalid 24-character hex activity ID", async () => {
    const res = await request.patch("/activities/invalid-id-123").send({
      changes: { title: "Test" },
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/24-character hex/);
  });

  it("should reject malformed JSON body", async () => {
    const res = await request
      .post("/activities")
      .set("Content-Type", "application/json")
      .send("{ malformed json ... }");

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Invalid JSON/);
  });

  it("should reject missing required fields (e.g., schedule or behavior)", async () => {
    const res = await request.post("/activities").send({
      title: "Incomplete Payload",
      priority: 3,
    });

    expect(res.status).toBe(400);
  });

  it("should reject unknown extra fields in payload", async () => {
    const res = await request.post("/activities").send({
      title: "Unknown Key Event",
      schedule: { timezone: TEST_TIMEZONE },
      behavior: { flexibility: "fixed" },
      priority: 3,
      unknownField: "not_allowed",
    });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/Unknown field/);
  });

  it("should enforce user isolation: not returning activities belonging to another user", async () => {
    // Insert activity directly for another user
    await ActivityModel.create({
      userId: OTHER_USER_ID,
      title: "Secret Other User Task",
      schedule: {
        startAt: new Date("2026-09-09T10:00:00+05:30"),
        endAt: new Date("2026-09-09T11:00:00+05:30"),
        timezone: TEST_TIMEZONE,
      },
      behavior: {
        flexibility: "fixed",
        recurrence: { rule: "none", interval: 1, days: [], until: null },
      },
      priority: 5,
      createdBy: "user",
    });

    const res = await request
      .get("/activities")
      .query({ range: "day", date: "2026-09-09", timezone: TEST_TIMEZONE });

    expect(res.status).toBe(200);
    expect(res.body.activities).toEqual([]);
  });

  it("should allow only configured origins, methods, and no credentials in production CORS", async () => {
    const allowed = "https://app.example.com";
    const prodApp = createApp({
      mongoUri: process.env.MONGODB_URI_TEST ?? "mongodb://localhost:27017/test",
      port: 3000,
      timezone: TEST_TIMEZONE,
      googleClientId: TEST_GOOGLE_CLIENT_ID,
      googleClientSecret: TEST_GOOGLE_CLIENT_SECRET,
      googleCallbackUrl: TEST_GOOGLE_CALLBACK_URL,
      jwtSecret: TEST_JWT_SECRET,
      jwtExpiresIn: "7d",
      nodeEnv: "production",
      corsOrigins: [allowed],
    });

    const allowedRes = await supertest(prodApp)
      .options("/health")
      .set("Origin", allowed)
      .set("Access-Control-Request-Method", "GET");
    expect(allowedRes.status).toBe(204);
    expect(allowedRes.headers["access-control-allow-origin"]).toBe(allowed);
    expect(allowedRes.headers["access-control-allow-credentials"]).toBe("false");
    expect(allowedRes.headers["access-control-allow-methods"]).toBe(
      "GET,POST,PATCH,DELETE,OPTIONS",
    );

    const deniedRes = await supertest(prodApp)
      .options("/health")
      .set("Origin", "https://evil.example")
      .set("Access-Control-Request-Method", "GET");
    expect(deniedRes.status).toBe(204);
    expect(deniedRes.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
