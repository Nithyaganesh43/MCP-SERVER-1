import { Schema, model, type Model } from "mongoose";
import {
  COLLECTION_CONVERSATION_STATES,
  DEFAULT_CONVERSATION_CONTEXT,
  DEFAULT_CONVERSATION_ENTITIES,
  DEFAULT_CONVERSATION_MISSION,
  INDEXES_CONVERSATION_STATES,
} from "./constants";
import type { ConversationState } from "./conversation-state.types";

export const ConversationStateSchema = new Schema<ConversationState>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    mission: {
      type: String,
      required: false,
      default: DEFAULT_CONVERSATION_MISSION,
    },
    context: {
      type: String,
      required: false,
      default: DEFAULT_CONVERSATION_CONTEXT,
    },
    entities: {
      type: Schema.Types.Mixed,
      required: true,
      default: () => ({ ...DEFAULT_CONVERSATION_ENTITIES }),
    },
  },
  {
    collection: COLLECTION_CONVERSATION_STATES,
    timestamps: { createdAt: false, updatedAt: true },
    strict: true,
    versionKey: false,
    minimize: false,
  },
);

for (const index of INDEXES_CONVERSATION_STATES) {
  ConversationStateSchema.index({ ...index }, { unique: true });
}

export const ConversationStateModel: Model<ConversationState> =
  model<ConversationState>("ConversationState", ConversationStateSchema);
