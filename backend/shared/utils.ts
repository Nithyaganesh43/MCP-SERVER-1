import crypto from "node:crypto";

/**
 * Common shared utility functions for cross-cutting application concerns.
 */

export function generateRandomString(length = 32): string {
  return crypto.randomBytes(length).toString("hex");
}

export function safeJsonParse<T>(json: string, fallback: T): T {
  try {
    return JSON.parse(json) as T;
  } catch {
    return fallback;
  }
}
