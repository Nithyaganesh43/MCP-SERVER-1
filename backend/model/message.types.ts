import type { Types } from "mongoose";
import type { MessageRole } from "./constants";

/** One turn in the user's single long conversation. History is stored here, never sent to the AI. */
export interface ChatMessage {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  role: MessageRole;
  content: string;
  createdAt: Date;
}

export type ChatMessageCreateInput = Omit<ChatMessage, "_id" | "createdAt">;
