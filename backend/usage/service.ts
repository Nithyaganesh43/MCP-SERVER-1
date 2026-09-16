import { Types } from "mongoose";
import { DEFAULT_DEEPSEEK_TOKEN_BUDGET } from "../model/constants";
import { UsageModel, type TokenUsage, type UsageSnapshot } from "../model/index";

function tokenBudget(): number {
  const raw = Number(process.env.DEEPSEEK_TOKEN_BUDGET ?? DEFAULT_DEEPSEEK_TOKEN_BUDGET);
  return Number.isFinite(raw) && raw > 0 ? raw : DEFAULT_DEEPSEEK_TOKEN_BUDGET;
}

export async function snapshot(userId: string): Promise<UsageSnapshot> {
  const doc = await UsageModel.findOne({ userId: new Types.ObjectId(userId) });
  const totalTokens = doc?.totalTokens ?? 0;
  const budget = tokenBudget();
  return {
    requestCount: doc?.requestCount ?? 0,
    promptTokens: doc?.promptTokens ?? 0,
    completionTokens: doc?.completionTokens ?? 0,
    totalTokens,
    tokenBudget: budget,
    remainingTokens: Math.max(0, budget - totalTokens),
  };
}

export async function record(userId: string, usage: TokenUsage): Promise<UsageSnapshot> {
  const id = new Types.ObjectId(userId);
  await UsageModel.findOneAndUpdate(
    { userId: id },
    {
      $inc: {
        requestCount: 1,
        promptTokens: usage.promptTokens,
        completionTokens: usage.completionTokens,
        totalTokens: usage.totalTokens,
      },
      $setOnInsert: { userId: id },
    },
    { upsert: true, new: true },
  );
  return snapshot(userId);
}
