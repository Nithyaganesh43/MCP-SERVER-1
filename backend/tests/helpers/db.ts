import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import {
  ActivityModel,
  ConversationStateModel,
  MemoryModel,
  SchedulingPreferenceModel,
  UserModel,
} from "../../model/index";

let mongod: MongoMemoryServer | null = null;

export async function connectTestDb(): Promise<string> {
  let uri = process.env.MONGODB_URI_TEST;
  if (!uri) {
    mongod = await MongoMemoryServer.create();
    uri = mongod.getUri();
  }
  if (mongoose.connection.readyState !== 0) {
    await mongoose.disconnect();
  }
  await mongoose.connect(uri);
  await ActivityModel.syncIndexes();
  await UserModel.syncIndexes();
  await SchedulingPreferenceModel.syncIndexes();
  await MemoryModel.syncIndexes();
  await ConversationStateModel.syncIndexes();
  return uri;
}

export async function clearTestDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0 && mongoose.connection.db) {
    const collections = await mongoose.connection.db.collections();
    for (const collection of collections) {
      await collection.deleteMany({});
    }
  }
}

export async function closeTestDb(): Promise<void> {
  if (mongoose.connection.readyState !== 0) {
    await clearTestDb();
    await mongoose.connection.dropDatabase();
    await mongoose.disconnect();
  }
  if (mongod) {
    await mongod.stop();
    mongod = null;
  }
}
