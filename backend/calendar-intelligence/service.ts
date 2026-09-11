import { Types } from "mongoose";
import { HttpError } from "../errors";
import {
  SchedulingPreferenceModel,
  ActivityModel,
  type PreferenceType,
  type PreferenceValue,
} from "../model/index";
import type {
  PreferencesSaveInput,
  PreferencesGetInput,
  PreferencesUpdateInput,
  PreferencesDeleteInput,
  CapacityCheckInput,
  CapacityCheckOutput,
  MissedReviewInput,
  MissedReviewOutput,
  PreviewInput,
  PreviewOutput,
  PreferenceView,
  MissedActivityView,
} from "./contract";
import { CalendarService } from "../calendar/service";
import { addCalendarDays, dayBounds } from "../calendar/time";
import type { CalendarActivityView } from "../calendar/contract";

export class CalendarIntelligenceService {
  private userId: Types.ObjectId;
  private calendarService: CalendarService;

  constructor(userId: Types.ObjectId) {
    this.userId = userId;
    this.calendarService = new CalendarService(userId);
  }

  /**
   * Save or upsert a scheduling preference.
   */
  async savePreference(input: PreferencesSaveInput): Promise<{
    success: true;
    preferenceId: string;
    message: string;
  }> {
    // Upsert on { userId, type }
    const result = await SchedulingPreferenceModel.findOneAndUpdate(
      { userId: this.userId, type: input.type },
      {
        userId: this.userId,
        type: input.type,
        value: input.value as PreferenceValue,
        timezone: input.timezone,
      },
      { upsert: true, new: true },
    );

    return {
      success: true,
      preferenceId: String(result._id),
      message: `Preference ${input.type} saved.`,
    };
  }

  /**
   * Get scheduling preferences, optionally filtered by types.
   */
  async getPreferences(input: PreferencesGetInput): Promise<{
    preferences: PreferenceView[];
  }> {
    const filter: Record<string, unknown> = { userId: this.userId };
    if (input.types && input.types.length > 0) {
      filter.type = { $in: input.types };
    }

    const prefs = await SchedulingPreferenceModel.find(filter).sort({ type: 1 });

    return {
      preferences: prefs.map((p) => ({
        preferenceId: String(p._id),
        type: p.type,
        value: p.value as Record<string, unknown>,
        timezone: p.timezone,
        updatedAt: p.updatedAt.toISOString(),
      })),
    };
  }

  /**
   * Update an existing preference by ID.
   */
  async updatePreference(input: PreferencesUpdateInput): Promise<{
    success: true;
    preferenceId: string;
    message: string;
  }> {
    const preferenceId = new Types.ObjectId(input.preferenceId);
    const pref = await SchedulingPreferenceModel.findOne({
      _id: preferenceId,
      userId: this.userId,
    });

    if (!pref) {
      throw new HttpError(404, "Preference not found");
    }

    pref.value = input.value as PreferenceValue;
    await pref.save();

    return {
      success: true,
      preferenceId: String(pref._id),
      message: `Preference ${pref.type} updated.`,
    };
  }

  /**
   * Delete a scheduling preference.
   */
  async deletePreference(input: PreferencesDeleteInput): Promise<{
    success: true;
  }> {
    const preferenceId = new Types.ObjectId(input.preferenceId);
    const result = await SchedulingPreferenceModel.deleteOne({
      _id: preferenceId,
      userId: this.userId,
    });

    if (result.deletedCount === 0) {
      throw new HttpError(404, "Preference not found");
    }

    return { success: true };
  }

  /**
   * Check if a day's workload exceeds the user's limit.
   */
  async checkCapacity(input: CapacityCheckInput): Promise<CapacityCheckOutput> {
    // Query activities with priority >= 4 on the date
    const { start, end } = dayBounds(input.date, input.timezone);
    const activities = await ActivityModel.find({
      userId: this.userId,
      status: "pending",
      priority: { $gte: 4 },
      "schedule.startAt": { $gte: start, $lt: end },
    });

    const count = activities.length;

    // Get workload_limit preference if it exists
    const limitPref = await SchedulingPreferenceModel.findOne({
      userId: this.userId,
      type: "workload_limit",
    });

    const limit =
      limitPref && typeof limitPref.value === "object" && limitPref.value !== null
        ? (limitPref.value as { maxImportant?: number }).maxImportant ?? null
        : null;

    return {
      exceedsLimit: limit !== null && count > limit,
      count,
      limit,
      date: input.date,
    };
  }

  /**
   * Review missed activities and suggest recovery.
   */
  async reviewMissed(input: MissedReviewInput): Promise<MissedReviewOutput> {
    const { start } = dayBounds(input.date, input.timezone);

    // Find activities with status: "missed" before the given date
    const missed = await ActivityModel.find({
      userId: this.userId,
      status: "missed",
      "schedule.startAt": { $lt: start },
    })
      .sort({ "schedule.startAt": 1 })
      .limit(20);

    const missedViews: MissedActivityView[] = missed.map((a) => ({
      activityId: String(a._id),
      title: a.title,
      priority: a.priority,
      flexibility: a.behavior.flexibility,
    }));

    // Generate recovery suggestions: moveable/floating → suggest next available day
    const suggestions = await Promise.all(
      missed
        .filter((a) => a.behavior.flexibility !== "fixed")
        .map(async (a) => {
          // Suggest the date after input.date as a simple recovery date
          const suggestedDate = addCalendarDays(input.date, 1);
          return {
            activityId: String(a._id),
            suggestedDate,
            reason: `Reschedule missed ${a.behavior.flexibility} task.`,
          };
        }),
    );

    return { missed: missedViews, suggestions };
  }

  // splitTask removed - calendar.split_task already exists in calendar module

  /**
   * Generate a preview summary for a given day.
   */
  async preview(input: PreviewInput): Promise<PreviewOutput> {
    // Use CalendarService.list to get the day's activities
    const listResult = await this.calendarService.list({
      range: "day",
      date: input.date,
      timezone: input.timezone,
    });

    // Check capacity
    const capacityResult = await this.checkCapacity({
      date: input.date,
      timezone: input.timezone,
    });

    // Generate natural summary
    const activityCount = listResult.activities.length;
    const importantCount = capacityResult.count;
    const limitText =
      capacityResult.limit !== null ? ` (limit: ${capacityResult.limit})` : "";

    let summary = `${input.date} has ${activityCount} activity${
      activityCount === 1 ? "" : "ies"
    }`;
    if (importantCount > 0) {
      summary += `, ${importantCount} important${limitText}`;
    }
    if (capacityResult.exceedsLimit) {
      summary += ". Workload exceeds your preferred limit.";
    } else {
      summary += ".";
    }

    return {
      summary,
      activities: listResult.activities,
      workload: {
        count: capacityResult.count,
        limit: capacityResult.limit,
      },
    };
  }
}
