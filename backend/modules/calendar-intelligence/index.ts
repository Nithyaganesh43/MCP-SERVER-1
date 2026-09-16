import { calendarIntelligenceTools } from "./tools";
import { calendarIntelligencePrompts } from "./prompts";

export * from "./types";
export * from "./prompts";
export * from "./tools";

export default {
  name: "calendar-intelligence",
  tools: calendarIntelligenceTools,
  prompts: calendarIntelligencePrompts,
};
