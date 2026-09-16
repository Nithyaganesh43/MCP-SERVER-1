import mongoose from "mongoose";
import {
  ActivityModel,
  ChatMessageModel,
  ConversationStateModel,
  MemoryModel,
  SchedulingPreferenceModel,
  UsageModel,
  UserModel,
} from "./model/index";

export async function connectDb(uri: string): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  await ActivityModel.syncIndexes();
  await UserModel.syncIndexes();
  await SchedulingPreferenceModel.syncIndexes();
  await MemoryModel.syncIndexes();
  await ConversationStateModel.syncIndexes();
  await ChatMessageModel.syncIndexes();
  await UsageModel.syncIndexes();
}
