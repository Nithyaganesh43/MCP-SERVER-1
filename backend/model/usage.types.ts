import type { Types } from "mongoose";

/** Per-user DeepSeek token usage. One document per user. */
export interface Usage {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  updatedAt: Date;
}

export type UsageCreateInput = Omit<Usage, "_id" | "updatedAt">;

export type TokenUsage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type UsageSnapshot = {
  requestCount: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  tokenBudget: number;
  remainingTokens: number;
};
