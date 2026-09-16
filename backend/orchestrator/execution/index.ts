import type {
  ExecutedStep,
  ExecutionPlan,
  ExecutionResult,
  ExecutionStep,
  GatewayLike,
  ResolvedContext,
  StepBind,
} from "../types";

export async function executePlan(
  plan: ExecutionPlan,
  gateway: GatewayLike,
  context: ResolvedContext,
): Promise<ExecutionResult> {
  const steps: ExecutedStep[] = [];

  if (plan.skipExecution || plan.steps.length === 0) {
    return { ok: false, steps, error: plan.clarificationQuestion };
  }

  for (const step of plan.steps) {
    const payload = bindPayload(step, steps, context);
    if (needsActivityId(step.tool) && typeof payload.activityId !== "string") {
      return {
        ok: false,
        steps,
        error: "I couldn't tell which activity you meant.",
      };
    }

    try {
      const result = await gateway.execute(step.tool, payload);
      steps.push({
        tool: step.tool,
        success: result.success,
        data: result.data,
        error: result.success ? undefined : result.error || "That didn't work.",
      });
      if (!result.success) {
        return {
          ok: false,
          steps,
          error: result.error || "That didn't work.",
        };
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      steps.push({
        tool: step.tool,
        success: false,
        error: message,
      });
      return { ok: false, steps, error: message };
    }
  }

  return { ok: true, steps };
}

export function bindPayload(
  step: ExecutionStep,
  previous: ExecutedStep[],
  _context: ResolvedContext,
): Record<string, unknown> {
  const payload: Record<string, unknown> = { ...step.payload };
  if (!step.bind) {
    return payload;
  }

  for (const bind of step.bind) {
    const value = resolveBind(bind, previous);
    if (value !== undefined) {
      payload[bind.field] = value;
    }
  }

  return payload;
}

function needsActivityId(tool: string): boolean {
  return (
    tool === "calendar.reschedule" ||
    tool === "calendar.delete" ||
    tool === "calendar.complete" ||
    tool === "calendar.update"
  );
}

function resolveBind(bind: StepBind, previous: ExecutedStep[]): unknown {
  const source = previous.filter((step) => step.tool === bind.fromTool && step.success).at(-1);
  if (!source) {
    return undefined;
  }

  const root = asRecord(source.data);
  const listValue = getPath(root, bind.path);
  const list = Array.isArray(listValue) ? listValue : [];
  const match = list.find((item) => {
    const record = asRecord(item);
    const field = record[bind.matchField];
    return (
      typeof field === "string" &&
      field.toLowerCase().includes(bind.matchValue.toLowerCase())
    );
  });

  if (!match) {
    return undefined;
  }

  const record = asRecord(match);
  const picked = record[bind.pick];
  if (picked !== undefined && picked !== null && picked !== "") {
    return picked;
  }
  if (bind.fallbackPick) {
    return record[bind.fallbackPick];
  }
  return undefined;
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function getPath(root: Record<string, unknown>, path: string): unknown {
  if (!path) {
    return root;
  }
  return path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && !Array.isArray(acc)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, root);
}
