import { isPrimaryIntent } from "../intent";
import type { ExecutionPlan, IntentResult } from "../types";
import type { PlanReasoningInput, Reasoner, ReplyReasoningInput } from "./types";

const DEFAULT_URL = "https://api.deepseek.com/chat/completions";
const DEFAULT_MODEL = "deepseek-chat";

export class DeepSeekReasoner implements Reasoner {
  private apiKey: string;
  private url: string;
  private model: string;

  constructor(options: { apiKey?: string; url?: string; model?: string } = {}) {
    this.apiKey = options.apiKey ?? process.env.DEEPSEEK_API_KEY ?? "";
    this.url = options.url ?? process.env.DEEPSEEK_URL ?? DEFAULT_URL;
    this.model = options.model ?? process.env.DEEPSEEK_MODEL ?? DEFAULT_MODEL;
  }

  async classify(
    message: string,
    request: { timezone: string; now: Date },
  ): Promise<IntentResult | null> {
    if (!this.apiKey) {
      return null;
    }
    const parsed = await this.complete(
      "Classify the user message. Return JSON with keys intent, entities, needsClarification, clarificationQuestion. intent must be one of create, update, delete, query, complete, planning, memory, reflection, conversation. Scheduling configuration (sleep, learning window, quiet hours, commute, workload, focus, exam revision) is still intent memory; the planner routes it.",
      JSON.stringify({
        message,
        timezone: request.timezone,
        now: request.now.toISOString(),
      }),
    );
    if (!parsed || typeof parsed.intent !== "string" || !isPrimaryIntent(parsed.intent)) {
      return null;
    }
    return {
      intent: parsed.intent,
      entities: asEntities(parsed.entities),
      needsClarification: parsed.needsClarification === true,
      clarificationQuestion:
        typeof parsed.clarificationQuestion === "string"
          ? parsed.clarificationQuestion
          : undefined,
      rawUtterance: message,
    };
  }

  async plan(input: PlanReasoningInput): Promise<ExecutionPlan | null> {
    if (!this.apiKey) {
      return null;
    }
    const parsed = await this.complete(
      "Build an MCP tool plan. Return JSON with toolChain (string array) and steps: [{ tool, payload }]. Use only listed tools. Never call memory.save for scheduling configuration. Never invent tool names.",
      JSON.stringify({
        intent: input.intent,
        entities: input.context.entities,
        timezone: input.context.timezone,
        tools: input.toolCatalog,
      }),
    );
    if (!parsed || !Array.isArray(parsed.steps)) {
      return null;
    }
    const steps = parsed.steps
      .filter((step) => step && typeof step === "object")
      .map((step) => {
        const record = step as Record<string, unknown>;
        return {
          tool: String(record.tool ?? ""),
          payload:
            record.payload && typeof record.payload === "object" && !Array.isArray(record.payload)
              ? (record.payload as Record<string, unknown>)
              : {},
        };
      })
      .filter((step) => step.tool.length > 0);

    return {
      toolChain: steps.map((step) => step.tool),
      steps,
      skipExecution: steps.length === 0,
      clarificationQuestion:
        typeof parsed.clarificationQuestion === "string"
          ? parsed.clarificationQuestion
          : undefined,
    };
  }

  async reply(input: ReplyReasoningInput): Promise<string | null> {
    if (!this.apiKey) {
      return null;
    }
    const parsed = await this.complete(
      "Write a short Karen reply: warm, polite, calm, no fake emotion, never mention MCP or tool names. Return JSON { reply: string }.",
      JSON.stringify({
        message: input.message,
        intent: input.intent.intent,
        results: input.results,
      }),
    );
    return typeof parsed?.reply === "string" ? parsed.reply : null;
  }

  private async complete(system: string, user: string): Promise<Record<string, unknown> | null> {
    try {
      const response = await fetch(this.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          response_format: { type: "json_object" },
          temperature: 0,
        }),
      });
      if (!response.ok) {
        return null;
      }
      const body = (await response.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const content = body.choices?.[0]?.message?.content;
      if (!content) {
        return null;
      }
      const parsed = JSON.parse(content) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch {
      return null;
    }
  }
}

function asEntities(value: unknown): IntentResult["entities"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  const entities: IntentResult["entities"] = {};
  for (const [key, raw] of Object.entries(record)) {
    if (
      raw === undefined ||
      raw === null ||
      typeof raw === "string" ||
      typeof raw === "number"
    ) {
      (entities as Record<string, unknown>)[key] = raw as never;
    }
  }
  return entities;
}
