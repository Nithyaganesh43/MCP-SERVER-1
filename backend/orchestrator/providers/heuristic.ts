import { classifyIntent } from "../intent";
import { heuristicPlan } from "../planner";
import type { Reasoner } from "./types";

export class HeuristicReasoner implements Reasoner {
  async classify(
    message: string,
    request: { timezone: string; now: Date },
  ) {
    return classifyIntent(message, request.now, request.timezone);
  }

  async plan(input: Parameters<Reasoner["plan"]>[0]) {
    return heuristicPlan(input.intent, input.context);
  }

  async reply() {
    return null;
  }
}
