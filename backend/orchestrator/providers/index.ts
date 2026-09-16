import { snapshot, record } from "../../usage/service";
import { DeepSeekReasoner } from "./deepseek";
import { HeuristicReasoner } from "./heuristic";
import type { Reasoner } from "./types";
import type { TokenUsage } from "../../model/usage.types";

export * from "./types";
export * from "./heuristic";
export * from "./deepseek";

export function createReasoner(
  options: {
    remainingTokens?: number;
    onUsage?: (usage: TokenUsage) => Promise<void>;
  } = {},
): Reasoner {
  if (
    process.env.DEEPSEEK_API_KEY &&
    (options.remainingTokens === undefined || options.remainingTokens > 0)
  ) {
    return new DeepSeekReasoner(options);
  }
  return new HeuristicReasoner();
}

export async function createReasonerForUser(userId: string): Promise<Reasoner> {
  const usage = await snapshot(userId);
  return createReasoner({
    remainingTokens: usage.remainingTokens,
    onUsage: (tokenUsage) => record(userId, tokenUsage).then(() => undefined),
  });
}
