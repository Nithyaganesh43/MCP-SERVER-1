import { DeepSeekReasoner } from "./deepseek";
import { HeuristicReasoner } from "./heuristic";
import type { Reasoner } from "./types";

export * from "./types";
export * from "./heuristic";
export * from "./deepseek";

export function createReasoner(): Reasoner {
  if (process.env.DEEPSEEK_API_KEY) {
    return new DeepSeekReasoner();
  }
  return new HeuristicReasoner();
}
