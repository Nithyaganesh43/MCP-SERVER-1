import { MEMORY_CATEGORY, type MemoryCategory } from "../../model/index";
import { HttpError } from "../../errors";

export const MEMORY_TOOLS = [
  "memory.save",
  "memory.search",
  "memory.update",
  "memory.delete",
  "memory.list",
] as const;

export type MemoryTool = (typeof MEMORY_TOOLS)[number];

const SAVE_KEYS = ["category", "content", "confidence", "expiresAt"] as const;
const SEARCH_KEYS = ["query", "limit"] as const;
const UPDATE_KEYS = ["memoryId", "content", "confidence"] as const;
const DELETE_KEYS = ["memoryId"] as const;
const LIST_KEYS = ["category"] as const;

export type MemorySaveInput = {
  category: MemoryCategory;
  content: string;
  confidence?: number;
  expiresAt?: Date | null;
};

export type MemorySearchInput = {
  query: string;
  limit?: number;
};

export type MemoryUpdateInput = {
  memoryId: string;
  content?: string;
  confidence?: number;
};

export type MemoryDeleteInput = {
  memoryId: string;
};

export type MemoryListInput = {
  category?: MemoryCategory;
};

export type MemoryView = {
  memoryId: string;
  category: MemoryCategory;
  content: string;
  confidence: number;
  expiresAt: string | null;
  updatedAt: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function rejectUnknown(
  record: Record<string, unknown>,
  allowed: readonly string[]
): void {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      throw new HttpError(400, `Unknown field: ${key}`);
    }
  }
}

function requireString(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${key} is required`);
  }
  return value;
}

function optionalString(value: unknown, key: string): string | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "string") {
    throw new HttpError(400, `${key} must be a string`);
  }
  return value;
}

export function parseObjectIdHex(value: string, key: string): string {
  if (!/^[a-fA-F0-9]{24}$/.test(value)) {
    throw new HttpError(400, `${key} must be a 24-character hex id`);
  }
  return value;
}

function parseIsoDate(value: unknown, key: string): Date {
  if (typeof value !== "string" || value.trim() === "") {
    throw new HttpError(400, `${key} must be an ISO date string`);
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new HttpError(400, `${key} must be an ISO date string`);
  }
  return date;
}

function optionalIsoDate(value: unknown, key: string): Date | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  return parseIsoDate(value, key);
}

function optionalNumber(value: unknown, key: string): number | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new HttpError(400, `${key} must be a number`);
  }
  return value;
}

function parseMemoryCategory(value: unknown): MemoryCategory {
  if (typeof value !== "string") {
    throw new HttpError(400, "category must be a string");
  }
  if (!MEMORY_CATEGORY.includes(value as MemoryCategory)) {
    throw new HttpError(
      400,
      `category must be one of: ${MEMORY_CATEGORY.join(", ")}`
    );
  }
  return value as MemoryCategory;
}

function optionalMemoryCategory(value: unknown): MemoryCategory | undefined {
  if (value === undefined) {
    return undefined;
  }
  return parseMemoryCategory(value);
}

function validateConfidence(confidence: number): void {
  if (confidence < 0 || confidence > 1) {
    throw new HttpError(400, "confidence must be between 0 and 1");
  }
}

export function parseMemorySaveInput(body: unknown): MemorySaveInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object");
  }
  rejectUnknown(body, SAVE_KEYS);

  const category = parseMemoryCategory(body.category);
  const content = requireString(body, "content");
  const confidence = optionalNumber(body.confidence, "confidence");
  const expiresAt = optionalIsoDate(body.expiresAt, "expiresAt");

  if (confidence !== undefined) {
    validateConfidence(confidence);
  }

  // temporary_preference requires expiresAt
  if (category === "temporary_preference" && expiresAt === undefined) {
    throw new HttpError(
      400,
      "expiresAt is required when category is temporary_preference"
    );
  }

  return { category, content, confidence, expiresAt };
}

export function parseMemorySearchInput(body: unknown): MemorySearchInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object");
  }
  rejectUnknown(body, SEARCH_KEYS);

  const query = requireString(body, "query");
  const limit = optionalNumber(body.limit, "limit");

  if (limit !== undefined && (limit < 1 || !Number.isInteger(limit))) {
    throw new HttpError(400, "limit must be a positive integer");
  }

  return { query, limit };
}

export function parseMemoryUpdateInput(body: unknown): MemoryUpdateInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object");
  }
  rejectUnknown(body, UPDATE_KEYS);

  const memoryId = parseObjectIdHex(requireString(body, "memoryId"), "memoryId");
  const content = optionalString(body.content, "content");
  const confidence = optionalNumber(body.confidence, "confidence");

  if (content === undefined && confidence === undefined) {
    throw new HttpError(
      400,
      "At least one of content or confidence must be provided"
    );
  }

  if (confidence !== undefined) {
    validateConfidence(confidence);
  }

  return { memoryId, content, confidence };
}

export function parseMemoryDeleteInput(body: unknown): MemoryDeleteInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object");
  }
  rejectUnknown(body, DELETE_KEYS);

  const memoryId = parseObjectIdHex(requireString(body, "memoryId"), "memoryId");

  return { memoryId };
}

export function parseMemoryListInput(body: unknown): MemoryListInput {
  if (!isRecord(body)) {
    throw new HttpError(400, "Request body must be an object");
  }
  rejectUnknown(body, LIST_KEYS);

  const category = optionalMemoryCategory(body.category);

  return { category };
}
