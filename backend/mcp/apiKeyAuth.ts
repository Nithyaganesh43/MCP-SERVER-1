import { type NextFunction, type Request, type Response } from "express";
import crypto from "node:crypto";

const API_KEY_HEADER = "x-mcp-api-key";

/**
 * Mask an API key for safe logging — shows only the last 4 characters.
 */
function maskKey(key: string): string {
  if (key.length <= 4) return "***";
  return "***" + key.slice(-4);
}

/**
 * Timing-safe comparison of two strings.
 * Returns false if lengths differ (but still constant-time for equal-length inputs).
 */
export function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compare against self to burn the same amount of time,
    // then return false to avoid length-oracle attacks.
    const buf = Buffer.from(a);
    crypto.timingSafeEqual(buf, buf);
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

/**
 * Express middleware that validates the X-MCP-API-Key header.
 *
 * - In production: MCP_API_KEY must be set; missing/invalid key → 401.
 * - In development: if MCP_API_KEY is unset, auth is skipped (with a warning).
 */
export function requireMcpApiKey() {
  const configuredKey = process.env.MCP_API_KEY;
  const isProd = process.env.NODE_ENV === "production";

  if (!configuredKey && isProd) {
    throw new Error(
      "MCP_API_KEY must be set in production. Refusing to start without it.",
    );
  }

  if (!configuredKey) {
    console.warn(
      "[MCP Auth] WARNING: MCP_API_KEY is not set. API key authentication is DISABLED. " +
        "Set MCP_API_KEY to enable authentication.",
    );
  }

  return (req: Request, res: Response, next: NextFunction): void => {
    // Skip auth if no key is configured (dev only — production throws above)
    if (!configuredKey) {
      next();
      return;
    }

    const providedKey = req.headers[API_KEY_HEADER];

    if (!providedKey || typeof providedKey !== "string") {
      console.warn(
        `[MCP Auth] Rejected: missing ${API_KEY_HEADER} header from ${req.ip}`,
      );
      res.status(401).json({
        error: "Unauthorized",
        message: "Missing X-MCP-API-Key header",
      });
      return;
    }

    if (!timingSafeCompare(providedKey, configuredKey)) {
      console.warn(
        `[MCP Auth] Rejected: invalid API key ${maskKey(providedKey)} from ${req.ip}`,
      );
      res.status(401).json({
        error: "Unauthorized",
        message: "Invalid API key",
      });
      return;
    }

    next();
  };
}
