import type { Types } from "mongoose";
import type { MemoryCategory } from "./constants";

/** V1 memories document. Field set is closed. memoryId in tools is String(_id). */
export interface Memory {
  _id: Types.ObjectId;
  userId: Types.ObjectId;
  category: MemoryCategory;
  content: string;
  confidence: number;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

export type MemoryCreateInput = Omit<Memory, "_id" | "createdAt" | "updatedAt">;
