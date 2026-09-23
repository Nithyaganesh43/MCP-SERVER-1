export interface McpSessionState {
  sessionId: string;
  userId: string;
  createdAt: string;
  lastActiveAt: string;
}

export interface McpToolEnvelope<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}
