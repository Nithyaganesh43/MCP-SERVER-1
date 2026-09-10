import mongoose from "mongoose";
import { ActivityModel, UserModel } from "./model/index";

export async function connectDb(uri: string): Promise<void> {
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  await ActivityModel.syncIndexes();
  await UserModel.syncIndexes();
}
