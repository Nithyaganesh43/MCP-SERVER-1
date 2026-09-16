import { calendarTools } from "./tools";
import { calendarPrompts } from "./prompts";

export * from "./types";
export * from "./prompts";
export * from "./tools";

export default {
  name: "calendar",
  tools: calendarTools,
  prompts: calendarPrompts,
};
