import { AsyncLocalStorage } from "node:async_hooks";
import { claimsFromHeader } from "../auth/middleware";
import { verifyJwt } from "../auth/jwt";
import { ERROR_CODES, McpError } from "./errors";
import { UserContext } from "./manifest";

const requestAuthorization = new AsyncLocalStorage<string | undefined>();

export const DEFAULT_V1_PERMISSIONS = [
  "calendar:read",
  "calendar:write",
  "calendar:delete",
  "calendar:preferences:read",
  "calendar:preferences:write",
  "calendar:preferences:delete",
  "memory:read",
  "memory:write",
  "memory:delete",
  "reflection:read",
  "conversation:read",
  "conversation:write",
];

export interface CreateContextOptions {
  userId?: string;
  timezone?: string;
  permissions?: string[];
  jwt?: string;
}

export function createUserContext(options: CreateContextOptions = {}): UserContext {
  const userId = resolveUserId(options);
  const timezone = options.timezone ?? process.env.TIMEZONE ?? "Asia/Kolkata";
  const permissions = options.permissions ?? [...DEFAULT_V1_PERMISSIONS];

  return {
    userId,
    timezone,
    permissions,
  };
}

export function createUserContextFromAuthorization(
  authorization: string | undefined,
): UserContext {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new McpError(
      ERROR_CODES.UNAUTHORIZED,
      "Invalid or missing userId in context",
    );
  }
  try {
    const claims = claimsFromHeader(authorization, secret);
    return createUserContext({ userId: claims.sub });
  } catch {
    throw new McpError(
      ERROR_CODES.UNAUTHORIZED,
      "Invalid or missing userId in context",
    );
  }
}

export function runWithRequestAuthorization<T>(
  authorization: string | undefined,
  fn: () => Promise<T>,
): Promise<T> {
  return requestAuthorization.run(authorization, fn);
}

export function createUserContextFromRequestAuthorization(): UserContext {
  return createUserContextFromAuthorization(requestAuthorization.getStore());
}

function resolveUserId(options: CreateContextOptions): string {
  if (options.userId) {
    if (!/^[0-9a-fA-F]{24}$/.test(options.userId)) {
      throw new McpError(
        ERROR_CODES.UNAUTHORIZED,
        "Invalid or missing userId in context",
      );
    }
    return options.userId;
  }
  const token = options.jwt;
  const secret = process.env.JWT_SECRET;
  if (token && secret) {
    return verifyJwt(token, secret).sub;
  }
  throw new McpError(
    ERROR_CODES.UNAUTHORIZED,
    "Invalid or missing userId in context",
  );
}
