import type { Types } from "mongoose";
import type {
  CalendarActivityView,
  CalendarCompleteInput,
  CalendarConflictView,
  CalendarConflictsInput,
  CalendarCreateInput,
  CalendarDeleteInput,
  CalendarListInput,
  CalendarRescheduleInput,
  CalendarRescueMissedInput,
  CalendarRolloverInput,
  CalendarSplitTaskInput,
  CalendarSuggestInput,
  CalendarUndoInput,
  CalendarUpdateInput,
  CalendarUserPreferencesBlob,
  CalendarUserPreferencesInput,
  CalendarWeeklySummaryInput,
} from "./contract";
import {
  completeActivity,
  createActivity,
  deleteActivity,
  listActivities,
  toView,
  updateActivity,
} from "./crud";
import { calculateWeeklySummary, findConflicts, suggestSlot } from "./conflicts";
import {
  handleUserPreferences,
  rescheduleActivity,
  rescueMissed,
  rollover,
  splitTask,
  undoLastAction,
} from "./operations";

export { toView };

export class CalendarService {
  constructor(private readonly userId: Types.ObjectId) {}

  async create(input: CalendarCreateInput): Promise<{
    success: true;
    activityId: string;
    message: string;
  }> {
    return createActivity(this.userId, input);
  }

  async update(input: CalendarUpdateInput): Promise<{
    success: true;
    activityId: string;
    message: string;
  }> {
    return updateActivity(this.userId, input);
  }

  async delete(input: CalendarDeleteInput): Promise<{ success: true }> {
    return deleteActivity(this.userId, input);
  }

  async list(input: CalendarListInput): Promise<{ activities: CalendarActivityView[] }> {
    return listActivities(this.userId, input);
  }

  async complete(input: CalendarCompleteInput): Promise<{ status: "done" }> {
    return completeActivity(this.userId, input);
  }

  async reschedule(input: CalendarRescheduleInput): Promise<{
    success: true;
    newEndAt: string | null;
  }> {
    return rescheduleActivity(this.userId, input);
  }

  async undo(input?: CalendarUndoInput): Promise<{
    success: boolean;
    message: string;
  }> {
    return undoLastAction(this.userId, input);
  }

  async userPreferences(input: CalendarUserPreferencesInput): Promise<{
    success: boolean;
    preferences: CalendarUserPreferencesBlob;
  }> {
    return handleUserPreferences(this.userId, input);
  }

  async conflicts(input: CalendarConflictsInput): Promise<{
    conflicts: CalendarConflictView[];
  }> {
    return findConflicts(this.userId, input);
  }

  async suggestSlot(input: CalendarSuggestInput): Promise<{
    suggestedStart: string | null;
    suggestedEnd: string | null;
    reason: string;
  }> {
    return suggestSlot(this.userId, input);
  }

  async splitTask(input: CalendarSplitTaskInput): Promise<{
    title: string;
    totalDurationMin: number;
    chunkMin: number;
    chunks: { date: string; startAt: string; endAt: string }[];
  }> {
    return splitTask(this.userId, input);
  }

  async rescueMissed(input: CalendarRescueMissedInput): Promise<{
    rescuedCount: number;
    rescued: { activityId: string; title: string; newStartAt?: string }[];
  }> {
    return rescueMissed(this.userId, input);
  }

  async rollover(input: CalendarRolloverInput): Promise<{
    movedCount: number;
    activities: { activityId: string; title: string }[];
  }> {
    return rollover(this.userId, input);
  }

  async weeklySummary(input: CalendarWeeklySummaryInput): Promise<{
    days: { date: string; scheduledHours: number; isOverloaded: boolean }[];
    overloadedDays: string[];
    freeDay: string | null;
  }> {
    return calculateWeeklySummary(this.userId, input);
  }
}
