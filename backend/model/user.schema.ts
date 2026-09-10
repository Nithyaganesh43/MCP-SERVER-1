import { Schema, model, type Model } from "mongoose";
import type { User } from "./user.types";
import { COLLECTION_USERS } from "./constants";

export const UserSchema = new Schema<User>(
  {
    googleId: { type: String, required: true, unique: true },
    email: { type: String, required: true },
    name: { type: String, required: true },
    picture: { type: String, required: true, default: "" },
    timezone: { type: String, required: true },
  },
  {
    collection: COLLECTION_USERS,
    timestamps: true,
    strict: true,
    versionKey: false,
  },
);

export const UserModel: Model<User> = model<User>("User", UserSchema);
