import { Types } from "mongoose";
import { ConversationStateModel } from "../../model/index";
import type { ConversationStateInput, ConversationContextOutput } from "./contract";

export class ConversationService {
  private userId: Types.ObjectId;

  constructor(userId: Types.ObjectId) {
    this.userId = userId;
  }

  /**
   * Store or update conversation state (upsert).
   * Only updates provided fields.
   */
  async setState(input: ConversationStateInput): Promise<{ success: true }> {
    const update: Record<string, unknown> = {};

    if (input.mission !== undefined) {
      update.mission = input.mission;
    }
    if (input.context !== undefined) {
      update.context = input.context;
    }
    if (input.entities !== undefined) {
      update.entities = input.entities;
    }

    await ConversationStateModel.findOneAndUpdate(
      { userId: this.userId },
      { $set: update },
      { upsert: true, new: true }
    );

    return { success: true };
  }

  /**
   * Retrieve current conversation state.
   * Returns empty values if no state exists.
   */
  async getContext(): Promise<ConversationContextOutput> {
    const state = await ConversationStateModel.findOne({ userId: this.userId });

    if (!state) {
      return {
        mission: "",
        context: "",
        entities: {},
        updatedAt: new Date().toISOString(),
      };
    }

    return {
      mission: state.mission,
      context: state.context,
      entities: state.entities,
      updatedAt: state.updatedAt.toISOString(),
    };
  }

  /**
   * Clear conversation state.
   */
  async clearState(): Promise<{ success: true }> {
    await ConversationStateModel.deleteOne({ userId: this.userId });
    return { success: true };
  }
}
