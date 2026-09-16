import request from "supertest";
import { DeepSeekReasoner } from "../orchestrator/providers/deepseek";
import { createReasoner, createReasonerForUser } from "../orchestrator/providers";
import { HeuristicReasoner } from "../orchestrator/providers/heuristic";
import { record, snapshot } from "../usage/service";
import { connectTestDb, closeTestDb, clearTestDb } from "./helpers/db";
import { getTestApp } from "./helpers/app";
import { authHeader } from "./helpers/auth";
import { seedTestUser, TEST_USER_ID_HEX } from "./helpers/seed";

const app = getTestApp();

describe("AI usage", () => {
  const previousKey = process.env.DEEPSEEK_API_KEY;
  const previousBudget = process.env.DEEPSEEK_TOKEN_BUDGET;

  beforeAll(async () => {
    await connectTestDb();
  });

  afterAll(async () => {
    await closeTestDb();
    if (previousKey === undefined) {
      delete process.env.DEEPSEEK_API_KEY;
    } else {
      process.env.DEEPSEEK_API_KEY = previousKey;
    }
    if (previousBudget === undefined) {
      delete process.env.DEEPSEEK_TOKEN_BUDGET;
    } else {
      process.env.DEEPSEEK_TOKEN_BUDGET = previousBudget;
    }
  });

  beforeEach(async () => {
    await clearTestDb();
    delete process.env.DEEPSEEK_API_KEY;
    process.env.DEEPSEEK_TOKEN_BUDGET = "100";
  });

  it("returns zero usage and the token budget", async () => {
    await seedTestUser();
    const res = await request(app).get("/api/usage").set(authHeader());
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      requestCount: 0,
      promptTokens: 0,
      completionTokens: 0,
      totalTokens: 0,
      tokenBudget: 100,
      remainingTokens: 100,
    });
  });

  it("records DeepSeek tokens and reduces remaining budget", async () => {
    await seedTestUser();
    await record(TEST_USER_ID_HEX, { promptTokens: 40, completionTokens: 10, totalTokens: 50 });
    const usage = await snapshot(TEST_USER_ID_HEX);
    expect(usage.requestCount).toBe(1);
    expect(usage.totalTokens).toBe(50);
    expect(usage.remainingTokens).toBe(50);
  });

  it("does not call DeepSeek when the token budget is exhausted", async () => {
    await seedTestUser();
    await record(TEST_USER_ID_HEX, { promptTokens: 100, completionTokens: 0, totalTokens: 100 });
    process.env.DEEPSEEK_API_KEY = "sk-test";
    const reasoner = await createReasonerForUser(TEST_USER_ID_HEX);
    expect(reasoner).toBeInstanceOf(HeuristicReasoner);
  });

  it("skips a DeepSeek call when remaining tokens are zero", async () => {
    const fetchMock = jest.fn();
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as typeof fetch;
    try {
      const reasoner = new DeepSeekReasoner({ apiKey: "sk-test", remainingTokens: 0 });
      const result = await reasoner.classify("hello", {
        timezone: "Asia/Kolkata",
        now: new Date("2026-09-16T12:00:00+05:30"),
      });
      expect(result).toBeNull();
      expect(fetchMock).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("sends only the current system and user messages to DeepSeek", async () => {
    const fetchMock = jest.fn(
      async (_url: string | URL | Request, init?: RequestInit) => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: JSON.stringify({
                intent: "query",
                entities: {},
                needsClarification: false,
              }),
            },
          },
        ],
        usage: { prompt_tokens: 8, completion_tokens: 4, total_tokens: 12 },
      }),
    }),
    );
    const originalFetch = globalThis.fetch;
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const recorded: { totalTokens: number }[] = [];
    try {
      const reasoner = new DeepSeekReasoner({
        apiKey: "sk-test",
        remainingTokens: 50,
        onUsage: async (usage) => {
          recorded.push(usage);
        },
      });
      await reasoner.classify("hello now", {
        timezone: "Asia/Kolkata",
        now: new Date("2026-09-16T12:00:00+05:30"),
      });
      expect(fetchMock).toHaveBeenCalledTimes(1);
      const payload = JSON.parse(String(fetchMock.mock.calls[0]?.[1]?.body)) as {
        messages: { role: string; content: string }[];
        max_tokens: number;
      };
      expect(payload.messages).toHaveLength(2);
      expect(payload.messages[0]?.role).toBe("system");
      expect(payload.messages[1]?.role).toBe("user");
      expect(payload.messages[1]?.content).toContain("hello now");
      expect(payload.max_tokens).toBe(256);
      expect(recorded[0]?.totalTokens).toBe(12);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it("uses the heuristic reasoner when DeepSeek is unset", () => {
    delete process.env.DEEPSEEK_API_KEY;
    expect(createReasoner()).toBeInstanceOf(HeuristicReasoner);
  });

  it("requires auth for usage", async () => {
    const res = await request(app).get("/api/usage");
    expect(res.status).toBe(401);
  });
});
