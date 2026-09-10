export interface ToolManifest {
  name: string;
  version: string;
  description: string;
  permissions: string[];
  inputSchema: Record<string, unknown>;
  outputSchema: Record<string, unknown>;
}

export interface UserContext {
  userId: string;
  timezone: string;
  permissions: string[];
}

export interface ToolErrorEnvelope {
  code: string;
  message: string;
}

export interface ToolSuccessEnvelope<T = unknown> {
  success: true;
  data: T;
}

export interface ToolFailureEnvelope {
  success: false;
  error: ToolErrorEnvelope;
}

export type ToolResponseEnvelope<T = unknown> =
  | ToolSuccessEnvelope<T>
  | ToolFailureEnvelope;

export interface Tool<TInput = unknown, TOutput = unknown> extends ToolManifest {
  execute: (input: TInput, ctx: UserContext) => Promise<TOutput>;
}
