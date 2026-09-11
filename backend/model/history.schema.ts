import { Schema, model, type Model } from "mongoose";
import type { ActivityHistory } from "./history.types";
import { COLLECTION_ACTIVITY_HISTORIES } from "./constants";

export const ActivityHistorySchema = new Schema<ActivityHistory>(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    activityId: { type: Schema.Types.ObjectId, required: true },
    action: {
      type: String,
      required: true,
      enum: ["create", "update", "delete", "complete", "reschedule"],
    },
    previousState: { type: Schema.Types.Mixed, default: null },
    newState: { type: Schema.Types.Mixed, default: null },
  },
  {
    collection: COLLECTION_ACTIVITY_HISTORIES,
    timestamps: { createdAt: true, updatedAt: false },
    strict: true,
    versionKey: false,
  },
);

ActivityHistorySchema.index({ userId: 1, createdAt: -1 });

export const ActivityHistoryModel: Model<ActivityHistory> = model<ActivityHistory>(
  "ActivityHistory",
  ActivityHistorySchema,
);
