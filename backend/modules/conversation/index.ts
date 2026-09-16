import { conversationTools } from "./tools";
import { conversationPrompts } from "./prompts";

export * from "./types";
export * from "./prompts";
export * from "./tools";

export default {
  name: "conversation",
  tools: conversationTools,
  prompts: conversationPrompts,
};
