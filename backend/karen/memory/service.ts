import { Types } from "mongoose";
import { HttpError } from "../../errors";
import {
  DEFAULT_MEMORY_CONFIDENCE,
  MemoryModel,
  type Memory,
} from "../../model/index";
import type {
  MemoryDeleteInput,
  MemoryListInput,
  MemorySaveInput,
  MemorySearchInput,
  MemoryUpdateInput,
  MemoryView,
} from "./contract";

function objectId(memoryId: string): Types.ObjectId {
  return new Types.ObjectId(memoryId);
}

export function toMemoryView(memory: Memory): MemoryView {
  return {
    memoryId: String(memory._id),
    category: memory.category,
    content: memory.content,
    confidence: memory.confidence,
    expiresAt: memory.expiresAt ? memory.expiresAt.toISOString() : null,
    updatedAt: memory.updatedAt.toISOString(),
  };
}

export class MemoryService {
  constructor(private readonly userId: Types.ObjectId) {}

  async save(input: MemorySaveInput): Promise<{
    success: true;
    memoryId: string;
    message: string;
  }> {
    const confidence = input.confidence ?? DEFAULT_MEMORY_CONFIDENCE;
    const expiresAt = input.expiresAt ?? null;

    const memory = await MemoryModel.create({
      userId: this.userId,
      category: input.category,
      content: input.content,
      confidence,
      expiresAt,
    });

    return {
      success: true,
      memoryId: String(memory._id),
      message: `Memory saved in category ${input.category}.`,
    };
  }

  async search(input: MemorySearchInput): Promise<{
    memories: MemoryView[];
  }> {
    const limit = input.limit ?? 5;

    // Use regex for simple text search on content field
    const memories = await MemoryModel.find({
      userId: this.userId,
      content: { $regex: input.query, $options: "i" },
    })
      .sort({ confidence: -1, updatedAt: -1 })
      .limit(limit)
      .lean();

    return {
      memories: memories.map(toMemoryView),
    };
  }

  async update(input: MemoryUpdateInput): Promise<{
    success: true;
    memoryId: string;
    message: string;
  }> {
    const updateFields: Partial<Memory> = {};

    if (input.content !== undefined) {
      updateFields.content = input.content;
    }
    if (input.confidence !== undefined) {
      updateFields.confidence = input.confidence;
    }

    const memory = await MemoryModel.findOneAndUpdate(
      { _id: objectId(input.memoryId), userId: this.userId },
      { $set: updateFields },
      { new: true }
    );

    if (!memory) {
      throw new HttpError(404, "Memory not found");
    }

    return {
      success: true,
      memoryId: input.memoryId,
      message: "Memory updated.",
    };
  }

  async delete(input: MemoryDeleteInput): Promise<{
    success: true;
  }> {
    const result = await MemoryModel.deleteOne({
      _id: objectId(input.memoryId),
      userId: this.userId,
    });

    if (result.deletedCount === 0) {
      throw new HttpError(404, "Memory not found");
    }

    return { success: true };
  }

  async list(input: MemoryListInput): Promise<{
    memories: MemoryView[];
  }> {
    const filter: Record<string, unknown> = { userId: this.userId };

    if (input.category !== undefined) {
      filter.category = input.category;
    }

    const memories = await MemoryModel.find(filter)
      .sort({ updatedAt: -1 })
      .lean();

    return {
      memories: memories.map(toMemoryView),
    };
  }
}
