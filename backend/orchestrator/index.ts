import { applyResolvedReferences, resolveContext } from "./context";
import { executePlan } from "./execution";
import { McpGateway } from "./gateway";
import { classifyIntent } from "./intent";
import { formatReply } from "./personality";
import { createPlan } from "./planner";
import { createReasoner } from "./providers";
import type {
  ExecutionResult,
  GatewayLike,
  IntentResult,
  OrchestratorDeps,
  OrchestratorRequest,
  OrchestratorResponse,
  ResolvedContext,
} from "./types";

export * from "./gateway";
export * from "./intent";
export * from "./context";
export * from "./planner";
export * from "./execution";
export * from "./personality";
export * from "./types";
export * from "./providers";

export async function handle(
  request: OrchestratorRequest,
  deps: OrchestratorDeps = {},
): Promise<OrchestratorResponse> {
  const gateway = deps.gateway ?? new McpGateway({ jwt: request.jwt });
  const reasoner = deps.reasoner ?? createReasoner();
  const now = request.now ?? new Date();

  let intent: IntentResult;
  try {
    const reasoned = await reasoner.classify(request.message, {
      timezone: request.timezone,
      now,
    });
    intent = reasoned ?? classifyIntent(request.message, now, request.timezone);
  } catch {
    intent = classifyIntent(request.message, now, request.timezone);
  }

  const context = await resolveContext(request, intent, gateway);
  intent = applyResolvedReferences(intent, context);

  const plan = await createPlan(intent, context, reasoner);

  if (plan.skipExecution) {
    return {
      reply: formatReply({ message: request.message, intent, context, plan }),
      clarification: true,
      executed: false,
    };
  }

  const execution = await executePlan(plan, gateway, context);

  if (execution.ok) {
    await persistConversation(gateway, request, intent, context, execution);
  }

  let reply = formatReply({
    message: request.message,
    intent,
    context,
    plan,
    execution,
    request,
  });

  try {
    const reasonedReply = await reasoner.reply({
      message: request.message,
      intent,
      plan,
      results: execution,
    });
    if (reasonedReply && reasonedReply.trim()) {
      reply = reasonedReply.replace(
        /\b(?:calendar|memory|reflection|conversation)(?:\.[a-z_]+)+\b/gi,
        "that",
      );
    }
  } catch {
    // keep heuristic reply
  }

  return {
    reply,
    clarification: false,
    executed: execution.ok,
  };
}

async function persistConversation(
  gateway: GatewayLike,
  request: OrchestratorRequest,
  intent: IntentResult,
  context: ResolvedContext,
  execution: ExecutionResult,
): Promise<void> {
  const entities: Record<string, unknown> = { ...context.entities };
  const created = execution.steps.find((step) => step.tool === "calendar.create" && step.success);
  const createdData =
    created?.data && typeof created.data === "object"
      ? (created.data as Record<string, unknown>)
      : {};
  const activityId =
    typeof createdData.activityId === "string" ? createdData.activityId : undefined;
  const title = intent.entities.title ?? intent.entities.activity;

  if (activityId) {
    entities.it = activityId;
    if (title) {
      entities[title.toLowerCase()] = activityId;
    }
  }

  try {
    await gateway.execute("conversation.state", {
      mission: intent.intent,
      context: request.message,
      entities,
    });
  } catch {
    // conversation persistence must never fail the user reply
  }
}
