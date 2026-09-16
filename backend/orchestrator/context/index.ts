import type { GatewayLike, IntentResult, OrchestratorRequest, ResolvedContext } from "../types";

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export async function resolveContext(
  request: OrchestratorRequest,
  intent: IntentResult,
  gateway: GatewayLike,
): Promise<ResolvedContext> {
  let mission = "";
  let conversationContext = "";
  let stored: Record<string, unknown> = {};

  try {
    const result = await gateway.execute("conversation.context", {});
    const data = asRecord(result.data);
    mission = asString(data.mission);
    conversationContext = asString(data.context);
    stored = asRecord(data.entities);
  } catch {
    stored = {};
  }

  const entities: Record<string, unknown> = {
    ...stored,
    ...Object.fromEntries(
      Object.entries(intent.entities).filter(([, value]) => value !== undefined),
    ),
  };

  const utterance = intent.rawUtterance.toLowerCase();
  if (/\bit\b/.test(utterance) && stored.it !== undefined) {
    const it = stored.it;
    if (typeof it === "string") {
      if (/^[a-fA-F0-9]{24}$/.test(it)) {
        entities.activityId = it;
      } else {
        entities.activity = it;
      }
    }
  }

  if (/that meeting/.test(utterance) && stored["that meeting"] !== undefined) {
    const meeting = stored["that meeting"];
    if (typeof meeting === "string") {
      if (/^[a-fA-F0-9]{24}$/.test(meeting)) {
        entities.activityId = meeting;
      } else {
        entities.activity = meeting;
      }
    }
  }

  return {
    userId: request.userId,
    timezone: request.timezone,
    jwt: request.jwt,
    now: request.now ?? new Date(),
    userName: request.userName,
    mission,
    conversationContext,
    entities,
  };
}

export function applyResolvedReferences(intent: IntentResult, context: ResolvedContext): IntentResult {
  const activity =
    (typeof context.entities.activity === "string" && context.entities.activity) ||
    intent.entities.activity;
  const activityId =
    (typeof context.entities.activityId === "string" && context.entities.activityId) ||
    intent.entities.activityId;

  const entities = {
    ...intent.entities,
    ...(activity ? { activity } : {}),
    ...(activityId ? { activityId } : {}),
  };

  const stillVague =
    intent.needsClarification &&
    !activityId &&
    (!activity || activity === "meeting");

  return {
    ...intent,
    entities,
    needsClarification: stillVague,
    clarificationQuestion: stillVague ? intent.clarificationQuestion : undefined,
  };
}
