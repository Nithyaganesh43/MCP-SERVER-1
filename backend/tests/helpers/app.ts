import type { Express } from "express";
import request from "supertest";
import { createApp } from "../../calendar/http";
import {
  TEST_GOOGLE_CALLBACK_URL,
  TEST_GOOGLE_CLIENT_ID,
  TEST_GOOGLE_CLIENT_SECRET,
  TEST_JWT_SECRET,
  authHeader,
} from "./auth";
import { TEST_TIMEZONE } from "./seed";

export function getTestApp(): Express {
  return createApp({
    mongoUri: process.env.MONGODB_URI_TEST ?? "mongodb://localhost:27017/test",
    port: 3000,
    timezone: TEST_TIMEZONE,
    googleClientId: TEST_GOOGLE_CLIENT_ID,
    googleClientSecret: TEST_GOOGLE_CLIENT_SECRET,
    googleCallbackUrl: TEST_GOOGLE_CALLBACK_URL,
    jwtSecret: TEST_JWT_SECRET,
    jwtExpiresIn: "7d",
    nodeEnv: "test",
    corsOrigins: [],
  });
}

export function authedRequest(app: Express) {
  const header = authHeader();
  return {
    get: (url: string) => request(app).get(url).set(header),
    post: (url: string) => request(app).post(url).set(header),
    patch: (url: string) => request(app).patch(url).set(header),
    delete: (url: string) => request(app).delete(url).set(header),
  };
}
