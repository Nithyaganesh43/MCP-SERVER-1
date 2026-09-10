import type { Types } from "mongoose";

/** Identity document. Field set is closed. Google is the identity provider. */
export interface User {
  _id: Types.ObjectId;
  googleId: string;
  email: string;
  name: string;
  picture: string;
  timezone: string;
  createdAt: Date;
  updatedAt: Date;
}

export type UserCreateInput = Omit<User, "_id" | "createdAt" | "updatedAt">;
