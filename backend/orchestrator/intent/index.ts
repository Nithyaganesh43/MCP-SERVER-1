import { addCalendarDays, zonedLocal, zonedYmd } from "../../calendar/time";
import type { IntentEntities, IntentResult, PrimaryIntent } from "../types";

const INTENTS: PrimaryIntent[] = [
  "create",
  "update",
  "delete",
  "query",
  "complete",
  "planning",
  "memory",
  "reflection",
  "conversation",
];

export function classifyIntent(
  utterance: string,
  now: Date = new Date(),
  timezone: string = "Asia/Kolkata",
): IntentResult {
  const rawUtterance = utterance.trim();
  const text = rawUtterance.toLowerCase();
  const entities = extractEntities(rawUtterance, now, timezone);

  if (/how was my week|weekly (review|summary|reflection)/.test(text)) {
    return done("reflection", { ...entities, reflectionPeriod: "weekly" }, rawUtterance);
  }
  if (/how was my month|monthly (review|summary|reflection)/.test(text)) {
    return done("reflection", { ...entities, reflectionPeriod: "monthly" }, rawUtterance);
  }
  if (/how was my (day|today)|daily (review|summary|reflection)/.test(text)) {
    return done("reflection", { ...entities, reflectionPeriod: "daily" }, rawUtterance);
  }

  if (/continue where we left off|what were we (doing|talking)|pick up (where|from)/.test(text)) {
    return done("conversation", entities, rawUtterance);
  }

  if (/when can i|find (me )?time|fit .+ (in|into)|free (slot|time)|suggest (a )?slot/.test(text)) {
    return done("planning", entities, rawUtterance);
  }

  if (
    /i sleep|sleep from|sleep at|quiet hours|don'?t like calls after|best at learning|learning (window|before)|revise before exams|commute|workload limit|focus duration/.test(
      text,
    )
  ) {
    return done("memory", { ...entities, ...preferenceEntities(text, entities) }, rawUtterance);
  }

  if (/^remember\b|please remember|i like |i love |my friend |i'?m building /.test(text)) {
    return done("memory", { ...entities, memoryContent: rawUtterance }, rawUtterance);
  }

  if (/^(i )?finished\b|mark .+ (as )?(done|complete)|completed\b/.test(text)) {
    const complete = withActivityFallback(text, entities, /finished\s+(.+)$/i);
    return maybeClarify("complete", complete, rawUtterance, "Which activity should I mark done?");
  }

  if (/^(cancel|delete|remove)\b/.test(text)) {
    const removed = withActivityFallback(text, entities, /(?:cancel|delete|remove)\s+(?:my\s+)?(.+)$/i);
    return maybeClarify("delete", removed, rawUtterance, "Which activity should I cancel?");
  }

  if (/^(move|reschedule|shift|push)\b/.test(text)) {
    const updated = withActivityFallback(
      text,
      entities,
      /(?:move|reschedule|shift|push)\s+(?:my\s+)?(.+?)(?:\s+after|\s+before|\s+to\s+|$)/i,
    );
    const vagueMeeting = !updated.activity || updated.activity === "meeting";
    if (vagueMeeting && !updated.activityId) {
      return {
        intent: "update",
        entities: updated,
        needsClarification: true,
        clarificationQuestion: "Which meeting should I move?",
        rawUtterance,
      };
    }
    return done("update", updated, rawUtterance);
  }

  if (/what('s| is) (on )?(my )?(today|tomorrow|this week|the week|this month)|show (my )?(calendar|schedule|day)|what do i have/.test(text)) {
    return done("query", { ...entities, queryRange: entities.queryRange ?? "day" }, rawUtterance);
  }

  if (/^(schedule|add|book|create|set up)\b/.test(text)) {
    const created = withActivityFallback(
      text,
      entities,
      /(?:schedule|add|book|create|set up)\s+(?:a\s+|an\s+)?(.+?)(?:\s+tomorrow|\s+today|\s+at\s+|\s+from\s+|$)/i,
    );
    if (!created.activity && !created.title) {
      return {
        intent: "create",
        entities: created,
        needsClarification: true,
        clarificationQuestion: "What should I schedule?",
        rawUtterance,
      };
    }
    if (!created.date && !created.start && !created.relativeTime) {
      return {
        intent: "create",
        entities: created,
        needsClarification: true,
        clarificationQuestion: `What time works for ${created.activity ?? created.title}?`,
        rawUtterance,
      };
    }
    return done("create", created, rawUtterance);
  }

  if (/what do you remember|what do you know about me/.test(text)) {
    return done("memory", { ...entities, memoryContent: rawUtterance }, rawUtterance);
  }

  return done("conversation", entities, rawUtterance);
}

export function isPrimaryIntent(value: string): value is PrimaryIntent {
  return INTENTS.includes(value as PrimaryIntent);
}

function done(intent: PrimaryIntent, entities: IntentEntities, rawUtterance: string): IntentResult {
  return {
    intent,
    entities,
    needsClarification: false,
    rawUtterance,
  };
}

function maybeClarify(
  intent: PrimaryIntent,
  entities: IntentEntities,
  rawUtterance: string,
  question: string,
): IntentResult {
  if (!entities.activity && !entities.activityId && !entities.title) {
    return {
      intent,
      entities,
      needsClarification: true,
      clarificationQuestion: question,
      rawUtterance,
    };
  }
  return done(intent, entities, rawUtterance);
}

function withActivityFallback(
  text: string,
  entities: IntentEntities,
  pattern: RegExp,
): IntentEntities {
  if (entities.activity) {
    return entities;
  }
  const match = text.match(pattern);
  if (!match?.[1]) {
    return entities;
  }
  const activity = cleanActivity(match[1]);
  if (!activity) {
    return entities;
  }
  return { ...entities, activity, title: titleCase(activity) };
}

function preferenceEntities(text: string, entities: IntentEntities): IntentEntities {
  const next: IntentEntities = { ...entities, memoryContent: entities.memoryContent };
  if (/sleep/.test(text)) {
    next.preferenceType = "sleep_window";
  } else if (/learning|sunrise|before sunrise/.test(text)) {
    next.preferenceType = "learning_window";
  } else if (/quiet|calls after|don'?t like calls/.test(text)) {
    next.preferenceType = "quiet_hours";
  } else if (/commute/.test(text)) {
    next.preferenceType = "commute";
  } else if (/workload|max .*tasks/.test(text)) {
    next.preferenceType = "workload_limit";
  } else if (/focus/.test(text)) {
    next.preferenceType = "focus_duration";
  } else if (/exam|revise/.test(text)) {
    next.preferenceType = "exam_planning";
  }
  return next;
}

export function extractEntities(
  utterance: string,
  now: Date,
  timezone: string,
): IntentEntities {
  const text = utterance.trim();
  const lower = text.toLowerCase();
  const entities: IntentEntities = {};

  const today = zonedYmd(now, timezone);
  if (/\btomorrow\b/.test(lower)) {
    entities.date = addCalendarDays(today, 1);
  } else if (/\btoday\b/.test(lower)) {
    entities.date = today;
  } else if (/\bthis week\b/.test(lower)) {
    entities.date = today;
    entities.queryRange = "week";
  } else if (/\bthis month\b/.test(lower)) {
    entities.date = today;
    entities.queryRange = "month";
  }

  const after = lower.match(/\bafter\s+([a-z][a-z\s]{1,24}?)(?:\.|$)/);
  if (after?.[1]) {
    entities.relativeTime = `after ${after[1].trim()}`;
    entities.relativeAnchor = cleanActivity(after[1]);
  }
  const before = lower.match(/\bbefore\s+([a-z][a-z\s]{1,24}?)(?:\.|$)/);
  if (before?.[1] && !entities.relativeTime) {
    entities.relativeTime = `before ${before[1].trim()}`;
    entities.relativeAnchor = cleanActivity(before[1]);
  }

  const range = lower.match(
    /\bfrom\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)\s+(?:to|-)\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i,
  );
  if (range) {
    entities.start = toHmm(range[1], "pm");
    entities.end = toHmm(range[2], "pm");
  } else {
    const at = lower.match(/\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)/i);
    if (at?.[1]) {
      entities.start = toHmm(at[1], inferMeridiem(at[1], lower));
    }
  }

  const duration = lower.match(/\bfor\s+(\d+)\s*(minutes|minute|mins|min|hours|hour|hrs|hr)\b/);
  if (duration) {
    const n = Number(duration[1]);
    entities.durationMin = /hour/.test(duration[2]) ? n * 60 : n;
  }

  const reminder = lower.match(/remind me\s+(\d+)\s*minutes? before/);
  if (reminder) {
    entities.reminderBeforeMin = Number(reminder[1]);
  }

  const known = lower.match(
    /\b(gym|dinner|lunch|breakfast|meeting|project|coding|airflow|vitamin d)\b/,
  );
  if (known?.[1]) {
    entities.activity = known[1];
    entities.title = titleCase(known[1]);
  }

  if (entities.start && entities.end && entities.date) {
    const startDate = zonedLocal(entities.date, `${entities.start}:00`, timezone);
    const endDate = zonedLocal(entities.date, `${entities.end}:00`, timezone);
    const minutes = Math.round((endDate.getTime() - startDate.getTime()) / 60000);
    if (minutes > 0) {
      entities.durationMin = minutes;
    }
  }

  return entities;
}

function inferMeridiem(raw: string, full: string): "am" | "pm" {
  if (/am|pm/i.test(raw)) {
    return /pm/i.test(raw) ? "pm" : "am";
  }
  if (/evening|night|tonight|gym|dinner/.test(full)) {
    return "pm";
  }
  if (/morning|learning|study|sunrise/.test(full)) {
    return "am";
  }
  const hour = Number(raw.match(/^(\d{1,2})/)?.[1] ?? "0");
  if (hour >= 1 && hour <= 7) {
    return "pm";
  }
  return hour >= 8 && hour <= 11 ? "am" : "pm";
}

function toHmm(raw: string, fallbackMeridiem: "am" | "pm"): string {
  const match = raw.trim().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
  if (!match) {
    return "18:00";
  }
  let hour = Number(match[1]);
  const minute = match[2] ?? "00";
  const meridiem = (match[3]?.toLowerCase() as "am" | "pm" | undefined) ?? fallbackMeridiem;
  if (meridiem === "pm" && hour < 12) {
    hour += 12;
  }
  if (meridiem === "am" && hour === 12) {
    hour = 0;
  }
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function cleanActivity(value: string): string {
  return value
    .replace(/\b(tomorrow|today|please|the|my|a|an)\b/gi, " ")
    .replace(/[?.!]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function titleCase(value: string): string {
  return value
    .split(" ")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
