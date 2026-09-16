import { Schema, model, type Model } from "mongoose";
import {
  COLLECTION_USAGE,
  DEFAULT_USAGE_COMPLETION_TOKENS,
  DEFAULT_USAGE_PROMPT_TOKENS,
  DEFAULT_USAGE_REQUEST_COUNT,
  DEFAULT_USAGE_TOTAL_TOKENS,
  INDEXES_USAGE,
} from "./constants";
import type { Usage } from "./usage.types";

export const UsageSchema = new Schema<Usage>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    requestCount: { type: Number, required: true, default: DEFAULT_USAGE_REQUEST_COUNT, min: 0 },
    promptTokens: { type: Number, required: true, default: DEFAULT_USAGE_PROMPT_TOKENS, min: 0 },
    completionTokens: {
      type: Number,
      required: true,
      default: DEFAULT_USAGE_COMPLETION_TOKENS,
      min: 0,
    },
    totalTokens: { type: Number, required: true, default: DEFAULT_USAGE_TOTAL_TOKENS, min: 0 },
  },
  {
    collection: COLLECTION_USAGE,
    timestamps: { createdAt: false, updatedAt: true },
    strict: true,
    versionKey: false,
  },
);

for (const index of INDEXES_USAGE) {
  UsageSchema.index({ ...index }, { unique: true });
}

export const UsageModel: Model<Usage> = model<Usage>("Usage", UsageSchema);
