import { randomBytes } from "node:crypto";
import { Schema, model, type Model } from "mongoose";
import type { User } from "./user.types";
import { COLLECTION_USERS } from "./constants";

export function generateUserApiKey(): string {
  return `ry_${randomBytes(24).toString("hex")}`;
}

export const UserSchema = new Schema<User>(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
    picture: { type: String, required: true, default: "" },
    timezone: { type: String, required: true },
    apiKey: { type: String, required: true, unique: true, default: generateUserApiKey },
  },
  {
    collection: COLLECTION_USERS,
    timestamps: true,
    strict: true,
    versionKey: false,
  },
);

export const UserModel: Model<User> = model<User>("User", UserSchema);
