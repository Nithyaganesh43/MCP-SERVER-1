import type {
  ExecutionPlan,
  ExecutionResult,
  IntentResult,
  OrchestratorRequest,
  ResolvedContext,
} from "../types";

export function formatReply(input: {
  message: string;
  intent: IntentResult;
  context: ResolvedContext;
  plan: ExecutionPlan;
  execution?: ExecutionResult;
  request?: OrchestratorRequest;
}): string {
  if (input.plan.skipExecution && input.plan.clarificationQuestion) {
    return sanitize(input.plan.clarificationQuestion);
  }

  if (!input.execution) {
    return "I want to be sure I understood. Could you say that another way?";
  }

  if (!input.execution.ok) {
    return sanitize(
      naturalFailure(input.execution.error) ??
        "I couldn't complete that. Nothing was changed.",
    );
  }

  return sanitize(naturalSuccess(input.intent, input.execution, input.context));
}

function naturalSuccess(
  intent: IntentResult,
  execution: ExecutionResult,
  context: ResolvedContext,
): string {
  const last = execution.steps.filter((step) => step.success).at(-1);
  const data = asRecord(last?.data);
  const title = intent.entities.title ?? titleCase(intent.entities.activity ?? "it");

  switch (intent.intent) {
    case "create": {
      const when = describeWhen(intent, context);
      return when
        ? `Done. I scheduled ${title}${when}.`
        : `Done. I scheduled ${title}.`;
    }
    case "update": {
      const relative = intent.entities.relativeTime
        ? ` ${intent.entities.relativeTime}`
        : "";
      return `Done. I moved ${title}${relative}.`;
    }
    case "delete":
      return `Done. I cancelled ${title}.`;
    case "complete":
      return `Nice work. I marked ${title} as done.`;
    case "query":
      return summarizeList(data, intent);
    case "planning":
      return summarizeSlot(execution);
    case "memory":
      if (intent.entities.preferenceType) {
        return "I'll keep that in mind for your schedule.";
      }
      if (last?.tool === "memory.search") {
        return summarizeMemories(data);
      }
      return "I'll remember that.";
    case "reflection": {
      const summary = typeof data.summary === "string" ? data.summary : "";
      return summary || "Here's a quiet look at that stretch of time.";
    }
    case "conversation": {
      const mission = context.mission.trim();
      const stored = context.conversationContext.trim();
      if (mission || stored) {
        return `Picking up where we left off${mission ? `: ${mission}` : "."}${stored ? ` ${stored}` : ""}`.trim();
      }
      return "I'm here. What would you like to do next?";
    }
    default:
      return "Done.";
  }
}

function naturalFailure(error?: string): string | undefined {
  if (!error) {
    return undefined;
  }
  const cleaned = sanitize(error);
  if (!cleaned || cleaned === "That didn't work.") {
    return "I couldn't complete that. Nothing was changed.";
  }
  return `I couldn't complete that. ${cleaned}`;
}

function summarizeList(data: Record<string, unknown>, intent: IntentResult): string {
  const activities = Array.isArray(data.activities) ? data.activities : [];
  if (activities.length === 0) {
    return intent.entities.date
      ? "That day looks open."
      : "Today looks open.";
  }
  const titles = activities
    .slice(0, 6)
    .map((item) => {
      const row = asRecord(item);
      const title = typeof row.title === "string" ? row.title : "Activity";
      return title;
    })
    .join(", ");
  return `Here's what you have: ${titles}.`;
}

function summarizeSlot(execution: ExecutionResult): string {
  const slot = execution.steps.find((step) => step.tool === "calendar.suggest_slot");
  const data = asRecord(slot?.data);
  const start = data.suggestedStart;
  const end = data.suggestedEnd;
  if (typeof start === "string" && typeof end === "string") {
    return `You could use ${start}–${end}. That still respects your learning window.`;
  }
  return "I couldn't find a free slot that fits.";
}

function summarizeMemories(data: Record<string, unknown>): string {
  const memories = Array.isArray(data.memories) ? data.memories : [];
  if (memories.length === 0) {
    return "I don't have a saved note about that yet.";
  }
  const first = asRecord(memories[0]);
  const content = typeof first.content === "string" ? first.content : "";
  return content
    ? `I remember this: ${content}`
    : "I have a few notes saved about you.";
}

function describeWhen(intent: IntentResult, context: ResolvedContext): string {
  if (intent.entities.relativeTime) {
    return ` ${intent.entities.relativeTime}`;
  }
  const day = intent.entities.date ? ` on ${intent.entities.date}` : "";
  if (intent.entities.start && intent.entities.end) {
    return `${day} from ${intent.entities.start} to ${intent.entities.end}`;
  }
  if (intent.entities.start) {
    return `${day} at ${formatClock(intent.entities.start)}`;
  }
  return day;
}

function formatClock(hmm: string): string {
  const [h, m] = hmm.split(":").map(Number);
  const meridiem = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return m === 0 ? `${hour}:00 ${meridiem}` : `${hour}:${String(m).padStart(2, "0")} ${meridiem}`;
}

function sanitize(text: string): string {
  return text.replace(
    /\b(?:calendar|memory|reflection|conversation)(?:\.[a-z_]+)+\b/gi,
    "that",
  );
}

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  return {};
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
