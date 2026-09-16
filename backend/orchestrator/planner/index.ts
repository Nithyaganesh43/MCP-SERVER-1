import { zonedLocal, zonedYmd } from "../../calendar/time";
import { listRegisteredTools, registeredToolNames } from "../../registry/modules";
import type {
  ExecutionPlan,
  ExecutionStep,
  IntentResult,
  ResolvedContext,
  StepBind,
} from "../types";
import type { Reasoner } from "../providers/types";

export async function createPlan(
  intent: IntentResult,
  context: ResolvedContext,
  reasoner?: Reasoner,
): Promise<ExecutionPlan> {
  if (reasoner) {
    try {
      const reasoned = await reasoner.plan({
        intent,
        context,
        toolCatalog: listRegisteredTools(),
      });
      if (reasoned) {
        return sanitizePlan(reasoned);
      }
    } catch {
      // fall through to heuristic
    }
  }
  return sanitizePlan(heuristicPlan(intent, context));
}

export function heuristicPlan(intent: IntentResult, context: ResolvedContext): ExecutionPlan {
  if (intent.needsClarification && intent.clarificationQuestion) {
    return {
      toolChain: [],
      steps: [],
      skipExecution: true,
      clarificationQuestion: intent.clarificationQuestion,
    };
  }

  const timezone = context.timezone;
  const today = zonedYmd(context.now, timezone);
  const date = intent.entities.date ?? today;
  const title = intent.entities.title ?? titleCase(intent.entities.activity ?? "");

  switch (intent.intent) {
    case "create":
      return planCreate(intent, timezone, date, title);
    case "update":
      return planUpdate(intent, timezone, date);
    case "delete":
      return planLookupThen("calendar.delete", intent, timezone, date);
    case "complete":
      return planLookupThen("calendar.complete", intent, timezone, date);
    case "query":
      return single("calendar.list", {
        range: intent.entities.queryRange ?? "day",
        date,
        timezone,
      });
    case "planning":
      return {
        toolChain: ["calendar.preferences.get", "calendar.suggest_slot"],
        steps: [
          {
            tool: "calendar.preferences.get",
            payload: { types: ["learning_window"] },
          },
          {
            tool: "calendar.suggest_slot",
            payload: {
              date,
              durationMin: intent.entities.durationMin ?? 60,
              timezone,
            },
          },
        ],
        skipExecution: false,
      };
    case "memory":
      return planMemory(intent, timezone);
    case "reflection":
      return planReflection(intent, timezone, date);
    case "conversation":
      return single("conversation.context", {});
    default:
      return {
        toolChain: [],
        steps: [],
        skipExecution: true,
        clarificationQuestion: "I want to be sure I understood. What would you like me to do?",
      };
  }
}

function planCreate(
  intent: IntentResult,
  timezone: string,
  date: string,
  title: string,
): ExecutionPlan {
  const startAt = toIso(date, intent.entities.start, timezone);
  const endAt = toIso(date, intent.entities.end, timezone);
  const createStep: ExecutionStep = {
    tool: "calendar.create",
    payload: {
      title: title || "Activity",
      schedule: {
        timezone,
        startAt,
        endAt,
        durationMin: intent.entities.durationMin ?? (startAt && !endAt ? 60 : null),
      },
      behavior: { flexibility: startAt ? "moveable" : "floating" },
      priority: 3,
      ...(intent.entities.reminderBeforeMin !== undefined
        ? { reminders: [{ beforeMin: intent.entities.reminderBeforeMin }] }
        : {}),
    },
  };

  if (intent.entities.reminderBeforeMin !== undefined) {
    return {
      toolChain: ["calendar.create"],
      steps: [createStep],
      skipExecution: false,
    };
  }

  return {
    toolChain: ["calendar.create"],
    steps: [createStep],
    skipExecution: false,
  };
}

function planUpdate(intent: IntentResult, timezone: string, date: string): ExecutionPlan {
  const activity = intent.entities.activity ?? "activity";
  const listStep: ExecutionStep = {
    tool: "calendar.list",
    payload: { range: "day", date, timezone },
  };

  const bind: StepBind[] = [
    {
      field: "activityId",
      fromTool: "calendar.list",
      path: "activities",
      matchField: "title",
      matchValue: activity,
      pick: "activityId",
    },
  ];

  if (intent.entities.relativeAnchor) {
    bind.push({
      field: "newStartAt",
      fromTool: "calendar.list",
      path: "activities",
      matchField: "title",
      matchValue: intent.entities.relativeAnchor,
      pick: "endAt",
      fallbackPick: "startAt",
    });
  } else if (intent.entities.start) {
    const startAt = toIso(date, intent.entities.start, timezone);
    if (startAt) {
      return {
        toolChain: ["calendar.list", "calendar.reschedule"],
        steps: [
          listStep,
          {
            tool: "calendar.reschedule",
            payload: {
              ...(intent.entities.activityId ? { activityId: intent.entities.activityId } : {}),
              newStartAt: startAt,
              reason: intent.entities.relativeTime,
            },
            bind: intent.entities.activityId ? undefined : bind,
          },
        ],
        skipExecution: false,
      };
    }
  }

  if (intent.entities.activityId && !intent.entities.relativeAnchor) {
    return {
      toolChain: [],
      steps: [],
      skipExecution: true,
      clarificationQuestion: "What time should I move it to?",
    };
  }

  return {
    toolChain: ["calendar.list", "calendar.reschedule"],
    steps: [
      listStep,
      {
        tool: "calendar.reschedule",
        payload: {
          ...(intent.entities.activityId ? { activityId: intent.entities.activityId } : {}),
          reason: intent.entities.relativeTime ?? "updated time",
        },
        bind,
      },
    ],
    skipExecution: false,
  };
}

function planLookupThen(
  tool: "calendar.delete" | "calendar.complete",
  intent: IntentResult,
  timezone: string,
  date: string,
): ExecutionPlan {
  if (intent.entities.activityId) {
    return single(tool, { activityId: intent.entities.activityId });
  }
  const activity = intent.entities.activity ?? intent.entities.title ?? "";
  if (!activity) {
    return {
      toolChain: [],
      steps: [],
      skipExecution: true,
      clarificationQuestion: "Which activity should I use?",
    };
  }
  return {
    toolChain: ["calendar.list", tool],
    steps: [
      {
        tool: "calendar.list",
        payload: { range: "day", date, timezone },
      },
      {
        tool,
        payload: {},
        bind: [
          {
            field: "activityId",
            fromTool: "calendar.list",
            path: "activities",
            matchField: "title",
            matchValue: activity,
            pick: "activityId",
          },
        ],
      },
    ],
    skipExecution: false,
  };
}

function planMemory(intent: IntentResult, timezone: string): ExecutionPlan {
  const type = intent.entities.preferenceType;
  if (type) {
    const value = preferenceValue(type, intent);
    if (!value) {
      const question =
        type === "sleep_window"
          ? "What time do you usually wake up?"
          : "I need a bit more detail to save that scheduling preference.";
      return {
        toolChain: [],
        steps: [],
        skipExecution: true,
        clarificationQuestion: question,
      };
    }
    return single("calendar.preferences.save", { type, value, timezone });
  }

  const query = intent.rawUtterance.toLowerCase();
  if (/what do you remember|what do you know/.test(query)) {
    return single("memory.search", { query: intent.rawUtterance, limit: 5 });
  }

  return single("memory.save", {
    category: guessMemoryCategory(intent.rawUtterance),
    content: intent.entities.memoryContent ?? intent.rawUtterance,
  });
}

function planReflection(
  intent: IntentResult,
  timezone: string,
  date: string,
): ExecutionPlan {
  const period = intent.entities.reflectionPeriod ?? "weekly";
  const tool =
    period === "daily"
      ? "reflection.daily"
      : period === "monthly"
        ? "reflection.monthly"
        : "reflection.weekly";
  return single(tool, { date, timezone });
}

function preferenceValue(
  type: string,
  intent: IntentResult,
): Record<string, unknown> | null {
  if (type === "sleep_window") {
    if (!intent.entities.start || !intent.entities.end) {
      return null;
    }
    return { start: intent.entities.start, end: intent.entities.end };
  }
  if (type === "learning_window") {
    const start = intent.entities.start ?? "06:00";
    const end = intent.entities.end ?? addHour(start);
    return { start, end };
  }
  if (type === "quiet_hours") {
    return { start: intent.entities.start ?? "20:00", end: intent.entities.end ?? "08:00" };
  }
  if (type === "commute") {
    return { durationMin: intent.entities.durationMin ?? 30 };
  }
  if (type === "workload_limit") {
    return { maxImportant: 3 };
  }
  if (type === "focus_duration") {
    return { durationMin: intent.entities.durationMin ?? 60 };
  }
  if (type === "exam_planning") {
    return { enabled: true, daysBeforeExam: 7 };
  }
  return null;
}

function guessMemoryCategory(text: string): string {
  const lower = text.toLowerCase();
  if (/friend|family|partner/.test(lower)) {
    return "relationship";
  }
  if (/building|goal|want to/.test(lower)) {
    return "goal";
  }
  if (/health|vitamin|doctor/.test(lower)) {
    return "health";
  }
  if (/usually|every day|habit/.test(lower)) {
    return "habit";
  }
  return "preference";
}

function single(tool: string, payload: Record<string, unknown>): ExecutionPlan {
  return {
    toolChain: [tool],
    steps: [{ tool, payload }],
    skipExecution: false,
  };
}

function sanitizePlan(plan: ExecutionPlan): ExecutionPlan {
  const allowed = registeredToolNames();
  const steps = plan.steps.filter((step) => allowed.has(step.tool));
  return {
    ...plan,
    steps,
    toolChain: steps.map((step) => step.tool),
  };
}

function toIso(date: string, hmm: string | undefined, timezone: string): string | null {
  if (!hmm) {
    return null;
  }
  return zonedLocal(date, `${hmm}:00`, timezone).toISOString();
}

function addHour(hmm: string): string {
  const [h, m] = hmm.split(":").map(Number);
  const next = (h + 1) % 24;
  return `${String(next).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
