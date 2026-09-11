import { Schema, model, type Model } from "mongoose";
import {
  COLLECTION_MEMORIES,
  DEFAULT_MEMORY_CONFIDENCE,
  DEFAULT_MEMORY_EXPIRES_AT,
  INDEXES_MEMORIES,
  MEMORY_CATEGORY,
} from "./constants";
import type { Memory } from "./memory.types";

export const MemorySchema = new Schema<Memory>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    category: {
      type: String,
      required: true,
      enum: MEMORY_CATEGORY,
    },
    content: { type: String, required: true },
    confidence: {
      type: Number,
      required: true,
      min: 0,
      max: 1,
      default: DEFAULT_MEMORY_CONFIDENCE,
    },
    expiresAt: {
      type: Date,
      default: DEFAULT_MEMORY_EXPIRES_AT,
      validate: {
        validator: function (this: Memory, value: Date | null) {
          if (this.category === "temporary_preference") {
            return value != null;
          }
          return true;
        },
        message: "expiresAt is required when category is temporary_preference",
      },
    },
  },
  {
    collection: COLLECTION_MEMORIES,
    timestamps: true,
    strict: true,
    versionKey: false,
    minimize: false,
  },
);

for (const index of INDEXES_MEMORIES) {
  MemorySchema.index({ ...index });
}

export const MemoryModel: Model<Memory> = model<Memory>("Memory", MemorySchema);
