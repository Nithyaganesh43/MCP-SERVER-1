import { verifyJwt } from "../auth/jwt";
import { ERROR_CODES, McpError } from "./errors";
import { UserContext } from "./manifest";

export const DEFAULT_V1_PERMISSIONS = [
  "calendar:read",
  "calendar:write",
  "calendar:delete",
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
