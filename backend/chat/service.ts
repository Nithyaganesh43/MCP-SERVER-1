import { Types } from "mongoose";
import { ChatMessageModel, type ChatMessage } from "../model/index";

export async function appendTurn(
  userId: string,
  userMessage: string,
  assistantReply: string,
): Promise<void> {
  const id = new Types.ObjectId(userId);
  await ChatMessageModel.create([
    { userId: id, role: "user", content: userMessage },
    { userId: id, role: "assistant", content: assistantReply },
  ]);
}

export async function listMessages(userId: string): Promise<ChatMessage[]> {
  return ChatMessageModel.find({ userId: new Types.ObjectId(userId) })
    .sort({ createdAt: 1, _id: 1 })
    .exec();
}

export function toMessageView(message: ChatMessage): {
  id: string;
  role: ChatMessage["role"];
  content: string;
  createdAt: string;
} {
  return {
    id: String(message._id),
    role: message.role,
    content: message.content,
    createdAt: message.createdAt.toISOString(),
  };
}
