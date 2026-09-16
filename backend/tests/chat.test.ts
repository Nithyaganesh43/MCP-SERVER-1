jest.mock("../orchestrator/index", () => ({
  handle: jest.fn(async () => ({
    reply: "Scheduled.",
    clarification: false,
    executed: true,
  })),
}));

import request from "supertest";
import { handle } from "../orchestrator/index";
import { appendTurn, listMessages } from "../chat/service";
import { ChatMessageModel } from "../model/index";
import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp } from "./helpers/app";
import { authHeader } from "./helpers/auth";
import { seedTestUser, TEST_USER_ID_HEX } from "./helpers/seed";

const mockedHandle = handle as jest.MockedFunction<typeof handle>;
const app = getTestApp();

describe("Chat transcript", () => {
  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
  });

  beforeEach(async () => {
    await clearTestDb();
    mockedHandle.mockClear();
  });

  it("stores one user message and one assistant reply per turn", async () => {
    await appendTurn(TEST_USER_ID_HEX, "Schedule gym", "Scheduled.");
    const messages = await listMessages(TEST_USER_ID_HEX);
    expect(messages).toHaveLength(2);
    expect(messages[0]?.role).toBe("user");
    expect(messages[0]?.content).toBe("Schedule gym");
    expect(messages[1]?.role).toBe("assistant");
    expect(messages[1]?.content).toBe("Scheduled.");
  });

  it("returns the single long conversation in order", async () => {
    await seedTestUser();
    await appendTurn(TEST_USER_ID_HEX, "first", "one");
    await appendTurn(TEST_USER_ID_HEX, "second", "two");

    const res = await request(app).get("/chat/messages").set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(4);
    expect(res.body.messages.map((row: { content: string }) => row.content)).toEqual([
      "first",
      "one",
      "second",
      "two",
    ]);
  });

  it("persists the current message only and does not send history to handle", async () => {
    await seedTestUser();
    await request(app).post("/chat").set(authHeader()).send({ message: "first" });
    await request(app).post("/chat").set(authHeader()).send({ message: "second" });

    expect(mockedHandle).toHaveBeenCalledTimes(2);
    expect(mockedHandle.mock.calls[0]?.[0]).toMatchObject({ message: "first" });
    expect(mockedHandle.mock.calls[1]?.[0]).toMatchObject({ message: "second" });
    expect(mockedHandle.mock.calls[1]?.[0]).not.toHaveProperty("history");
    expect(mockedHandle.mock.calls[1]?.[0]).not.toHaveProperty("messages");

    const stored = await ChatMessageModel.find({}).sort({ createdAt: 1, _id: 1 });
    expect(stored.map((row) => row.content)).toEqual(["first", "Scheduled.", "second", "Scheduled."]);
  });

  it("requires auth for chat messages", async () => {
    const res = await request(app).get("/chat/messages");
    expect(res.status).toBe(401);
  });
});
