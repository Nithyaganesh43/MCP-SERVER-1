export type PrimaryIntent =
  | "create"
  | "update"
  | "delete"
  | "query"
  | "complete"
  | "planning"
  | "memory"
  | "reflection"
  | "conversation";

export interface IntentEntities {
  activity?: string;
  activityId?: string;
  title?: string;
  date?: string;
  start?: string;
  end?: string;
  relativeTime?: string;
  relativeAnchor?: string;
  durationMin?: number;
  reminderBeforeMin?: number;
  memoryContent?: string;
  preferenceType?: string;
  queryRange?: "day" | "week" | "month";
  reflectionPeriod?: "daily" | "weekly" | "monthly";
}

export interface IntentResult {
  intent: PrimaryIntent;
  entities: IntentEntities;
  needsClarification: boolean;
  clarificationQuestion?: string;
  rawUtterance: string;
}

export interface ResolvedContext {
  userId: string;
  timezone: string;
  jwt: string;
  now: Date;
  userName?: string;
  mission: string;
  conversationContext: string;
  entities: Record<string, unknown>;
}

export interface StepBind {
  field: string;
  fromTool: string;
  path: string;
  matchField: string;
  matchValue: string;
  pick: string;
  fallbackPick?: string;
}

export interface ExecutionStep {
  tool: string;
  payload: Record<string, unknown>;
  bind?: StepBind[];
}

export interface ExecutionPlan {
  toolChain: string[];
  steps: ExecutionStep[];
  skipExecution: boolean;
  clarificationQuestion?: string;
}

export interface ExecutedStep {
  tool: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ExecutionResult {
  ok: boolean;
  steps: ExecutedStep[];
  error?: string;
}

export interface OrchestratorRequest {
  message: string;
  jwt: string;
  userId: string;
  timezone: string;
  userName?: string;
  now?: Date;
}

export interface OrchestratorResponse {
  reply: string;
  clarification: boolean;
  executed: boolean;
}

export interface GatewayLike {
  execute: (
    tool: string,
    payload?: Record<string, unknown>,
  ) => Promise<{
    success: boolean;
    data?: unknown;
    error?: string;
  }>;
}

export interface OrchestratorDeps {
  gateway?: GatewayLike;
  reasoner?: import("./providers/types").Reasoner;
}
