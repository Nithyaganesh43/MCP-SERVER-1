import request from "supertest";
import { exchangeGoogleCode } from "../auth/google";
import { verifyJwt } from "../auth/jwt";
import { HttpError } from "../errors";
import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp } from "./helpers/app";
import {
  TEST_GOOGLE_CLIENT_ID,
  TEST_GOOGLE_CALLBACK_URL,
  TEST_JWT_SECRET,
  authHeader,
  expiredJwt,
  invalidJwt,
  validJwt,
} from "./helpers/auth";
import { TEST_GOOGLE_PROFILE, seedTestUser } from "./helpers/seed";

jest.mock("../auth/google", () => {
  const actual = jest.requireActual("../auth/google") as typeof import("../auth/google");
  return {
    ...actual,
    exchangeGoogleCode: jest.fn(),
  };
});

const mockedExchange = exchangeGoogleCode as jest.MockedFunction<typeof exchangeGoogleCode>;
const app = getTestApp();

describe("Auth Tests", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    mockedExchange.mockReset();
  });

  it("should issue a JWT on login success", async () => {
    mockedExchange.mockResolvedValue(TEST_GOOGLE_PROFILE);

    const res = await request(app).get("/auth/google/callback").query({ code: "test-code" });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.email).toBe(TEST_GOOGLE_PROFILE.email);
    expect(res.body.user.name).toBe(TEST_GOOGLE_PROFILE.name);
    expect(res.body.user.googleId).toBe(TEST_GOOGLE_PROFILE.googleId);

    const claims = verifyJwt(res.body.token as string, TEST_JWT_SECRET);
    expect(claims.sub).toBe(res.body.user.id);
    expect(claims.email).toBe(TEST_GOOGLE_PROFILE.email);
    expect(claims.name).toBe(TEST_GOOGLE_PROFILE.name);
    expect(mockedExchange).toHaveBeenCalledWith(
      "test-code",
      expect.objectContaining({
        googleClientId: TEST_GOOGLE_CLIENT_ID,
        googleCallbackUrl: TEST_GOOGLE_CALLBACK_URL,
      }),
    );
  });

  it("should return 401 on invalid callback", async () => {
    const missing = await request(app).get("/auth/google/callback");
    expect(missing.status).toBe(401);

    const denied = await request(app).get("/auth/google/callback").query({ error: "access_denied" });
    expect(denied.status).toBe(401);

    mockedExchange.mockRejectedValue(new HttpError(401, "Unauthorized"));
    const badCode = await request(app).get("/auth/google/callback").query({ code: "bad" });
    expect(badCode.status).toBe(401);
  });

  it("should return 401 when JWT is missing", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("should return 401 when JWT is expired", async () => {
    await seedTestUser();
    const res = await request(app).get("/auth/me").set(authHeader(expiredJwt()));
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it("should return the current user profile from /auth/me", async () => {
    const user = await seedTestUser();
    const res = await request(app).get("/auth/me").set(authHeader(validJwt()));

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(String(user._id));
    expect(res.body.email).toBe(TEST_GOOGLE_PROFILE.email);
    expect(res.body.name).toBe(TEST_GOOGLE_PROFILE.name);
    expect(res.body.picture).toBe(TEST_GOOGLE_PROFILE.picture);
    expect(res.body.timezone).toBe(user.timezone);
    expect(res.body.googleId).toBe(TEST_GOOGLE_PROFILE.googleId);
    expect(typeof res.body.apiKey).toBe("string");
    expect(res.body.apiKey.length).toBeGreaterThan(0);
  });

  it("should redirect to Google from GET /auth/google", async () => {
    const res = await request(app).get("/auth/google");
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain("accounts.google.com");
    expect(res.headers.location).toContain(TEST_GOOGLE_CLIENT_ID);
  });

  it("should logout with a valid JWT", async () => {
    await seedTestUser();
    const res = await request(app).post("/auth/logout").set(authHeader(validJwt()));
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it("should return 401 when JWT is invalid", async () => {
    const res = await request(app).get("/auth/me").set(authHeader(invalidJwt()));
    expect(res.status).toBe(401);
  });

  it("should issue a JWT when logging in with a user API key", async () => {
    const user = await seedTestUser();
    const res = await request(app).post("/auth/api-key").send({ apiKey: user.apiKey });

    expect(res.status).toBe(200);
    expect(typeof res.body.token).toBe("string");
    expect(res.body.user.id).toBe(String(user._id));
    expect(res.body.user.apiKey).toBe(user.apiKey);

    const claims = verifyJwt(res.body.token as string, TEST_JWT_SECRET);
    expect(claims.sub).toBe(String(user._id));
  });

  it("should accept a user API key as a Bearer token", async () => {
    const user = await seedTestUser();
    const res = await request(app)
      .get("/auth/me")
      .set("Authorization", `Bearer ${user.apiKey}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(String(user._id));
    expect(res.body.apiKey).toBe(user.apiKey);
  });

  it("should redirect the browser Google callback to the app with a token", async () => {
    mockedExchange.mockResolvedValue(TEST_GOOGLE_PROFILE);

    const resApi = await request(app).get("/api/google/callback").query({ code: "test-code" });
    expect(resApi.status).toBe(302);
    expect(resApi.headers.location).toMatch(/^\/\?token=/);

    const resRoot = await request(app).get("/google/callback").query({ code: "test-code" });
    expect(resRoot.status).toBe(302);
    expect(resRoot.headers.location).toMatch(/^\/\?token=/);
  });

  it("should redirect the browser Google callback to an error on failure", async () => {
    const missing = await request(app).get("/api/google/callback");
    expect(missing.status).toBe(302);
    expect(missing.headers.location).toBe("/?error=auth");

    const denied = await request(app).get("/api/google/callback").query({ error: "access_denied" });
    expect(denied.status).toBe(302);
    expect(denied.headers.location).toBe("/?error=auth");
  });

  it("should redirect to Google from GET /api/google and GET /google", async () => {
    const resApi = await request(app).get("/api/google");
    expect(resApi.status).toBe(302);
    expect(resApi.headers.location).toContain("accounts.google.com");
    expect(resApi.headers.location).toContain(TEST_GOOGLE_CLIENT_ID);

    const resRoot = await request(app).get("/google");
    expect(resRoot.status).toBe(302);
    expect(resRoot.headers.location).toContain("accounts.google.com");
  });
});
