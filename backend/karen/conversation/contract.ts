import { HttpError } from "../../errors";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknown(record: Record<string, unknown>, allowed: readonly string[]): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new HttpError(400, `Unknown field: ${key}`);
    }
  }
}

const CONVERSATION_STATE_KEYS = ["mission", "context", "entities"] as const;

export type ConversationStateInput = {
  mission?: string;
  context?: string;
  entities?: Record<string, unknown>;
};

export type ConversationContextOutput = {
  mission: string;
  context: string;
  entities: Record<string, unknown>;
  updatedAt: string;
};

/**
 * Parse conversation.state input.
 * At least one field must be provided.
 */
export function parseConversationStateInput(body: unknown): ConversationStateInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Invalid body");
  }
  rejectUnknown(body, CONVERSATION_STATE_KEYS);

  const { mission, context, entities } = body;

  // Validate at least one field is provided
  if (mission === undefined && context === undefined && entities === undefined) {
    throw new HttpError(400, "At least one field (mission, context, entities) is required");
  }

  // Validate types if provided
  if (mission !== undefined && typeof mission !== "string") {
    throw new HttpError(400, "mission must be a string");
  }

  if (context !== undefined && typeof context !== "string") {
    throw new HttpError(400, "context must be a string");
  }

  if (entities !== undefined && !isRecord(entities)) {
    throw new HttpError(400, "entities must be an object");
  }

  return {
    mission: mission as string | undefined,
    context: context as string | undefined,
    entities: entities as Record<string, unknown> | undefined,
  };
}

/**
 * Parse conversation.context input.
 * No input required.
 */
export function parseConversationContextInput(body: unknown): Record<string, never> {
  if (!isRecord(body)) {
    throw new HttpError(400, "Invalid body");
  }
  rejectUnknown(body, []);
  return {};
}

/**
 * Parse conversation.clear input.
 * No input required.
 */
export function parseConversationClearInput(body: unknown): Record<string, never> {
  if (!isRecord(body)) {
    throw new HttpError(400, "Invalid body");
  }
  rejectUnknown(body, []);
  return {};
}
