import { Schema, model, type Model } from "mongoose";
import { COLLECTION_MESSAGES, INDEXES_MESSAGES, MESSAGE_ROLE } from "./constants";
import type { ChatMessage } from "./message.types";

export const ChatMessageSchema = new Schema<ChatMessage>(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    role: { type: String, required: true, enum: MESSAGE_ROLE },
    content: { type: String, required: true },
  },
  {
    collection: COLLECTION_MESSAGES,
    timestamps: { createdAt: true, updatedAt: false },
    strict: true,
    versionKey: false,
  },
);

for (const index of INDEXES_MESSAGES) {
  ChatMessageSchema.index({ ...index });
}

export const ChatMessageModel: Model<ChatMessage> = model<ChatMessage>(
  "ChatMessage",
  ChatMessageSchema,
);
