import type { Types } from "mongoose";

/** V1 conversation_states document. One per user. Field set is closed. */
export interface ConversationState {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  mission: string;
  context: string;
  entities: Record<string, unknown>;
  updatedAt: Date;
}

export type ConversationStateCreateInput = Omit<
  ConversationState,
  "_id" | "updatedAt"
>;
