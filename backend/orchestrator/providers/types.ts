import type { ExecutionPlan, IntentResult, OrchestratorRequest, ResolvedContext } from "../types";

export interface PlanReasoningInput {
  intent: IntentResult;
  context: ResolvedContext;
  toolCatalog: { name: string; description: string }[];
}

export interface ReplyReasoningInput {
  message: string;
  intent: IntentResult;
  plan: ExecutionPlan;
  results: unknown;
}

export interface Reasoner {
  classify(
    message: string,
    request: Pick<OrchestratorRequest, "timezone"> & { now: Date },
  ): Promise<IntentResult | null>;
  plan(input: PlanReasoningInput): Promise<ExecutionPlan | null>;
  reply(input: ReplyReasoningInput): Promise<string | null>;
}
