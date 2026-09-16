import request from "supertest";
import { getTestApp } from "./helpers/app";
import { authHeader } from "./helpers/auth";
import { TEST_TIMEZONE, TEST_USER_ID_HEX } from "./helpers/seed";
import { handle } from "../orchestrator";
import { classifyIntent } from "../orchestrator/intent";
import { heuristicPlan } from "../orchestrator/planner";
import { executePlan } from "../orchestrator/execution";
import { formatReply } from "../orchestrator/personality";
import { HeuristicReasoner } from "../orchestrator/providers";
import { listRegisteredTools, modules } from "../registry/modules";
import type { GatewayLike, IntentResult, OrchestratorRequest, ResolvedContext } from "../orchestrator/types";

const NOW = new Date("2026-09-16T12:00:00+05:30");

function requestFor(message: string): OrchestratorRequest {
  return {
    message,
    jwt: "test-jwt",
    userId: TEST_USER_ID_HEX,
    timezone: TEST_TIMEZONE,
    userName: "Test User",
    now: NOW,
  };
}

function emptyContext(intent: IntentResult): ResolvedContext {
  return {
    userId: TEST_USER_ID_HEX,
    timezone: TEST_TIMEZONE,
    jwt: "test-jwt",
    now: NOW,
    userName: "Test User",
    mission: "",
    conversationContext: "",
    entities: { ...intent.entities },
  };
}

function mockGateway(
  handlers: Record<string, (payload: Record<string, unknown>) => { success: boolean; data?: unknown; error?: string }>,
): GatewayLike & { calls: { tool: string; payload: Record<string, unknown> }[] } {
  const calls: { tool: string; payload: Record<string, unknown> }[] = [];
  return {
    calls,
    async execute(tool: string, payload: Record<string, unknown> = {}) {
      calls.push({ tool, payload });
      const handler = handlers[tool];
      if (!handler) {
        return { success: false, error: `unexpected tool ${tool}` };
      }
      return handler(payload);
    },
  };
}

describe("AI Orchestrator", () => {
  describe("registry", () => {
    it("registers the five current modules and their tools", () => {
      expect(modules.map((mod) => mod.name)).toEqual([
        "calendar",
        "calendar-intelligence",
        "memory",
        "reflection",
        "conversation",
      ]);
      const names = listRegisteredTools().map((tool) => tool.name);
      expect(names).toEqual(expect.arrayContaining([
        "calendar.create",
        "calendar.preferences.get",
        "calendar.suggest_slot",
        "memory.save",
        "reflection.weekly",
        "conversation.context",
      ]));
    });
  });

  describe("intent", () => {
    it("classifies schedule, memory, reflection, and planning examples", () => {
      expect(classifyIntent("Schedule gym tomorrow at 6.", NOW, TEST_TIMEZONE).intent).toBe("create");
      expect(classifyIntent("Remember I like vintage gifts.", NOW, TEST_TIMEZONE).intent).toBe("memory");
      expect(classifyIntent("How was my week?", NOW, TEST_TIMEZONE).entities.reflectionPeriod).toBe("weekly");
      expect(classifyIntent("When can I study Airflow?", NOW, TEST_TIMEZONE).intent).toBe("planning");
    });

    it("extracts gym after dinner and asks when a meeting is ambiguous", () => {
      const moved = classifyIntent("Move my gym after dinner.", NOW, TEST_TIMEZONE);
      expect(moved.intent).toBe("update");
      expect(moved.entities.activity).toBe("gym");
      expect(moved.entities.relativeAnchor).toBe("dinner");
      expect(moved.needsClarification).toBe(false);

      const meeting = classifyIntent("Move meeting.", NOW, TEST_TIMEZONE);
      expect(meeting.needsClarification).toBe(true);
      expect(meeting.clarificationQuestion).toMatch(/meeting/i);
    });
  });

  describe("planner", () => {
    it("routes scheduling configuration to calendar.preferences.save", () => {
      const intent = classifyIntent("I sleep from 10 PM to 5 AM.", NOW, TEST_TIMEZONE);
      const plan = heuristicPlan(intent, emptyContext(intent));
      expect(plan.toolChain).toEqual(["calendar.preferences.save"]);
      expect(plan.steps[0]?.payload).toMatchObject({
        type: "sleep_window",
        value: { start: "22:00", end: "05:00" },
      });
    });

    it("routes personal knowledge to memory.save", () => {
      const intent = classifyIntent("Remember I like vintage gifts.", NOW, TEST_TIMEZONE);
      const plan = heuristicPlan(intent, emptyContext(intent));
      expect(plan.toolChain).toEqual(["memory.save"]);
      expect(plan.steps[0]?.payload).toMatchObject({
        category: "preference",
      });
    });

    it("chains learning-window lookup and slot suggestion", () => {
      const intent = classifyIntent("When can I study Airflow?", NOW, TEST_TIMEZONE);
      const plan = heuristicPlan(intent, emptyContext(intent));
      expect(plan.toolChain).toEqual(["calendar.preferences.get", "calendar.suggest_slot"]);
    });

    it("plans calendar.create for a clear schedule request", () => {
      const intent = classifyIntent("Schedule gym tomorrow at 6.", NOW, TEST_TIMEZONE);
      const plan = heuristicPlan(intent, emptyContext(intent));
      expect(plan.toolChain).toEqual(["calendar.create"]);
      expect(plan.steps[0]?.payload).toMatchObject({
        title: "Gym",
        behavior: { flexibility: "moveable" },
        priority: 3,
      });
    });

    it("does not emit tools that are not registered", () => {
      const intent = classifyIntent("How was my week?", NOW, TEST_TIMEZONE);
      const plan = heuristicPlan(intent, emptyContext(intent));
      const allowed = new Set(listRegisteredTools().map((tool) => tool.name));
      for (const tool of plan.toolChain) {
        expect(allowed.has(tool)).toBe(true);
      }
    });
  });

  describe("execution", () => {
    it("executes steps sequentially through the gateway and stops on failure", async () => {
      const intent = classifyIntent("When can I study Airflow?", NOW, TEST_TIMEZONE);
      const plan = heuristicPlan(intent, emptyContext(intent));
      const gateway = mockGateway({
        "calendar.preferences.get": () => ({
          success: true,
          data: { preferences: [{ type: "learning_window", value: { start: "06:00", end: "07:00" } }] },
        }),
        "calendar.suggest_slot": () => ({ success: false, error: "No free slot of 60 minutes." }),
      });

      const result = await executePlan(plan, gateway, emptyContext(intent));
      expect(gateway.calls.map((call) => call.tool)).toEqual([
        "calendar.preferences.get",
        "calendar.suggest_slot",
      ]);
      expect(result.ok).toBe(false);
      expect(result.steps).toHaveLength(2);
    });

    it("binds activityId from a previous list result", async () => {
      const intent = classifyIntent("Move my gym after dinner.", NOW, TEST_TIMEZONE);
      const plan = heuristicPlan(intent, emptyContext(intent));
      const gateway = mockGateway({
        "calendar.list": () => ({
          success: true,
          data: {
            activities: [
              {
                activityId: "aaaaaaaaaaaaaaaaaaaaaaaa",
                title: "Gym",
                startAt: "2026-09-16T18:00:00.000Z",
              },
              {
                activityId: "bbbbbbbbbbbbbbbbbbbbbbbb",
                title: "Dinner",
                endAt: "2026-09-16T16:00:00.000Z",
              },
            ],
          },
        }),
        "calendar.reschedule": () => ({
          success: true,
          data: { success: true, newEndAt: "2026-09-16T17:00:00.000Z" },
        }),
      });

      const result = await executePlan(plan, gateway, emptyContext(intent));
      expect(result.ok).toBe(true);
      const reschedule = gateway.calls.find((call) => call.tool === "calendar.reschedule");
      expect(reschedule?.payload.activityId).toBe("aaaaaaaaaaaaaaaaaaaaaaaa");
      expect(reschedule?.payload.newStartAt).toBe("2026-09-16T16:00:00.000Z");
    });
  });

  describe("personality", () => {
    it("never mentions tool names and does not fabricate success", () => {
      const intent = classifyIntent("Schedule gym tomorrow at 6.", NOW, TEST_TIMEZONE);
      const plan = heuristicPlan(intent, emptyContext(intent));
      const success = formatReply({
        message: intent.rawUtterance,
        intent,
        context: emptyContext(intent),
        plan,
        execution: {
          ok: true,
          steps: [
            {
              tool: "calendar.create",
              success: true,
              data: { activityId: "abc", message: "Gym added." },
            },
          ],
        },
      });
      expect(success.toLowerCase()).toContain("scheduled");
      expect(success).not.toMatch(/calendar\.create/i);

      const failure = formatReply({
        message: intent.rawUtterance,
        intent,
        context: emptyContext(intent),
        plan,
        execution: {
          ok: false,
          steps: [{ tool: "calendar.create", success: false, error: "calendar.create failed" }],
          error: "calendar.create failed",
        },
      });
      expect(failure.toLowerCase()).not.toContain("done");
      expect(failure).not.toMatch(/calendar\.create/i);
    });
  });

  describe("pipeline", () => {
    it("schedules gym through the gateway", async () => {
      const gateway = mockGateway({
        "conversation.context": () => ({
          success: true,
          data: { mission: "", context: "", entities: {} },
        }),
        "calendar.create": () => ({
          success: true,
          data: { success: true, activityId: "cccccccccccccccccccccccc", message: "Gym added." },
        }),
        "conversation.state": () => ({ success: true, data: { success: true } }),
      });

      const result = await handle(requestFor("Schedule gym tomorrow at 6."), {
        gateway,
        reasoner: new HeuristicReasoner(),
      });

      expect(result.executed).toBe(true);
      expect(result.clarification).toBe(false);
      expect(result.reply).toMatch(/scheduled/i);
      expect(result.reply).not.toMatch(/calendar\.create/i);
      expect(gateway.calls.map((call) => call.tool)).toEqual([
        "conversation.context",
        "calendar.create",
        "conversation.state",
      ]);
    });

    it("asks one clarifying question and does not execute tools", async () => {
      const gateway = mockGateway({
        "conversation.context": () => ({
          success: true,
          data: { mission: "", context: "", entities: {} },
        }),
      });

      const result = await handle(requestFor("Move meeting."), {
        gateway,
        reasoner: new HeuristicReasoner(),
      });

      expect(result.clarification).toBe(true);
      expect(result.executed).toBe(false);
      expect(result.reply).toMatch(/meeting/i);
      expect(gateway.calls.map((call) => call.tool)).toEqual(["conversation.context"]);
    });

    it("resolves it from conversation context", async () => {
      const gateway = mockGateway({
        "conversation.context": () => ({
          success: true,
          data: {
            mission: "update",
            context: "Dell Meeting",
            entities: { it: "dddddddddddddddddddddddd", "that meeting": "dddddddddddddddddddddddd" },
          },
        }),
        "calendar.complete": () => ({ success: true, data: { status: "done" } }),
        "conversation.state": () => ({ success: true, data: { success: true } }),
      });

      const result = await handle(requestFor("Finished it."), {
        gateway,
        reasoner: new HeuristicReasoner(),
      });

      expect(result.executed).toBe(true);
      const complete = gateway.calls.find((call) => call.tool === "calendar.complete");
      expect(complete?.payload.activityId).toBe("dddddddddddddddddddddddd");
    });

    it("saves vintage gifts with memory.save", async () => {
      const gateway = mockGateway({
        "conversation.context": () => ({
          success: true,
          data: { mission: "", context: "", entities: {} },
        }),
        "memory.save": () => ({
          success: true,
          data: { success: true, memoryId: "eeeeeeeeeeeeeeeeeeeeeeee", message: "saved" },
        }),
        "conversation.state": () => ({ success: true, data: { success: true } }),
      });

      const result = await handle(requestFor("Remember I like vintage gifts."), {
        gateway,
        reasoner: new HeuristicReasoner(),
      });

      expect(result.executed).toBe(true);
      expect(result.reply.toLowerCase()).toContain("remember");
      expect(gateway.calls[1]?.tool).toBe("memory.save");
    });

    it("summarizes the week with reflection.weekly", async () => {
      const gateway = mockGateway({
        "conversation.context": () => ({
          success: true,
          data: { mission: "", context: "", entities: {} },
        }),
        "reflection.weekly": () => ({
          success: true,
          data: { summary: "A steady week with gym still in place.", insights: [] },
        }),
        "conversation.state": () => ({ success: true, data: { success: true } }),
      });

      const result = await handle(requestFor("How was my week?"), {
        gateway,
        reasoner: new HeuristicReasoner(),
      });

      expect(result.executed).toBe(true);
      expect(result.reply).toContain("steady week");
      expect(gateway.calls[1]?.tool).toBe("reflection.weekly");
    });
  });

  describe("HTTP", () => {
    const app = getTestApp();

    it("requires a Bearer JWT", async () => {
      const res = await request(app).post("/chat").send({ message: "Hello" });
      expect(res.status).toBe(401);
    });

    it("rejects a missing message", async () => {
      const res = await request(app).post("/chat").set(authHeader()).send({});
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });
});
