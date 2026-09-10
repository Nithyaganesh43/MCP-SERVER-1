import { ToolFailureEnvelope } from "./manifest";
import { HttpError } from "../errors";

export const ERROR_CODES = {
  VALIDATION_ERROR: "VALIDATION_ERROR",
  NOT_FOUND: "NOT_FOUND",
  UNAUTHORIZED: "UNAUTHORIZED",
  FORBIDDEN: "FORBIDDEN",
  CALENDAR_CONFLICT: "CALENDAR_CONFLICT",
  NO_AVAILABLE_SLOT: "NO_AVAILABLE_SLOT",
  INTERNAL_ERROR: "INTERNAL_ERROR",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];

export class McpError extends Error {
  constructor(
    public readonly code: ErrorCode | string,
    message: string,
  ) {
    super(message);
    this.name = "McpError";
  }
}

export function createErrorEnvelope(
  code: ErrorCode | string,
  message: string,
): ToolFailureEnvelope {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}

export function handleMcpError(err: unknown): ToolFailureEnvelope {
  if (err instanceof McpError) {
    return createErrorEnvelope(err.code, err.message);
  }

  if (err instanceof HttpError) {
    let code: string = ERROR_CODES.VALIDATION_ERROR;
    if (err.status === 401) code = ERROR_CODES.UNAUTHORIZED;
    else if (err.status === 403) code = ERROR_CODES.FORBIDDEN;
    else if (err.status === 404) code = ERROR_CODES.NOT_FOUND;
    else if (err.status === 409) code = ERROR_CODES.CALENDAR_CONFLICT;
    else if (err.status === 400) code = ERROR_CODES.VALIDATION_ERROR;
    return createErrorEnvelope(code, err.message);
  }

  if (err instanceof Error) {
    return createErrorEnvelope(ERROR_CODES.INTERNAL_ERROR, err.message);
  }

  return createErrorEnvelope(
    ERROR_CODES.INTERNAL_ERROR,
    "An unexpected error occurred",
  );
}
