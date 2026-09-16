import { reflectionTools } from "./tools";
import { reflectionPrompts } from "./prompts";

export * from "./types";
export * from "./prompts";
export * from "./tools";

export default {
  name: "reflection",
  tools: reflectionTools,
  prompts: reflectionPrompts,
};
