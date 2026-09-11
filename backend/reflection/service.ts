import { Types } from "mongoose";
import {
  dayBounds,
  weekBounds,
  monthBounds,
  zonedYmd,
} from "../calendar/time";
import { CalendarService } from "../calendar/service";
import type {
  ReflectionDailyInput,
  ReflectionDailyOutput,
  ReflectionWeeklyInput,
  ReflectionWeeklyOutput,
  ReflectionMonthlyInput,
  ReflectionMonthlyOutput,
} from "./contract";

export class ReflectionService {
  constructor(private readonly userId: Types.ObjectId) {}

  async daily(input: ReflectionDailyInput): Promise<ReflectionDailyOutput> {
    const calendarService = new CalendarService(this.userId);
    
    // Default to today if no date provided
    const timezone = input.timezone || "Asia/Kolkata";
    const date = input.date || zonedYmd(new Date(), timezone);

    // Get all activities for the day
    const result = await calendarService.list({
      range: "day",
      date,
      timezone,
    });

    const activities = result.activities;

    // Count by status
    const completed = activities.filter((a) => a.status === "done").length;
    const missed = activities.filter((a) => a.status === "missed").length;
    const upcoming = activities.filter((a) => a.status === "pending").length;

    // Generate summary
    let summary = "";
    if (completed === 0 && missed === 0 && upcoming === 0) {
      summary = "You have no activities scheduled for this day.";
    } else {
      const parts: string[] = [];
      if (completed > 0) {
        parts.push(`Completed ${completed} ${completed === 1 ? "task" : "tasks"}`);
      }
      if (missed > 0) {
        parts.push(`missed ${missed}`);
      }
      if (upcoming > 0) {
        parts.push(`${upcoming} ${upcoming === 1 ? "task" : "tasks"} upcoming`);
      }
      summary = parts.join(", ") + ".";
    }

    return {
      summary,
      completed,
      missed,
      upcoming,
    };
  }

  async weekly(input: ReflectionWeeklyInput): Promise<ReflectionWeeklyOutput> {
    const calendarService = new CalendarService(this.userId);
    
    // Default to current week if no date provided
    const timezone = input.timezone || "Asia/Kolkata";
    const date = input.date || zonedYmd(new Date(), timezone);

    // Get all activities for the week
    const result = await calendarService.list({
      range: "week",
      date,
      timezone,
    });

    const activities = result.activities;

    // Analyze weekly patterns
    const total = activities.length;
    const completed = activities.filter((a) => a.status === "done").length;
    const missed = activities.filter((a) => a.status === "missed").length;
    const pending = activities.filter((a) => a.status === "pending").length;
    
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Count activities by day
    const activityCountByDay: Record<string, number> = {};
    activities.forEach((activity) => {
      if (activity.startAt) {
        const dayKey = activity.startAt.slice(0, 10); // YYYY-MM-DD
        activityCountByDay[dayKey] = (activityCountByDay[dayKey] || 0) + 1;
      }
    });

    const dayCounts = Object.entries(activityCountByDay);
    const busiestDay = dayCounts.length > 0
      ? dayCounts.reduce((max, curr) => curr[1] > max[1] ? curr : max)
      : null;

    // Priority distribution
    const highPriority = activities.filter((a) => a.priority >= 4).length;
    
    // Recurring activities adherence
    const recurringActivities = activities.filter(
      (a) => a.recurrence.rule !== "none"
    );
    const recurringCompleted = recurringActivities.filter(
      (a) => a.status === "done"
    ).length;

    // Generate summary
    let summary = "";
    if (total === 0) {
      summary = "You had no activities scheduled this week.";
    } else {
      summary = `This week you completed ${completed} out of ${total} activities (${completionRate}% completion rate).`;
      if (missed > 0) {
        summary += ` ${missed} ${missed === 1 ? "task was" : "tasks were"} missed.`;
      }
      if (pending > 0) {
        summary += ` ${pending} ${pending === 1 ? "task remains" : "tasks remain"} pending.`;
      }
    }

    // Generate insights
    const insights: string[] = [];

    if (busiestDay) {
      const dayName = new Date(busiestDay[0]).toLocaleDateString("en-US", {
        weekday: "long",
        timeZone: timezone,
      });
      insights.push(`${dayName} was your busiest day with ${busiestDay[1]} activities.`);
    }

    if (completionRate >= 80) {
      insights.push("Strong week! You completed most of your planned activities.");
    } else if (completionRate >= 50) {
      insights.push("Moderate completion rate. Consider reviewing your workload.");
    } else if (completionRate > 0) {
      insights.push("Low completion rate this week. Consider breaking tasks into smaller chunks.");
    }

    if (recurringActivities.length > 0) {
      const recurringRate = Math.round((recurringCompleted / recurringActivities.length) * 100);
      if (recurringRate >= 80) {
        insights.push(`Great habit consistency: ${recurringRate}% of recurring activities completed.`);
      } else {
        insights.push(`Recurring habits need attention: only ${recurringRate}% completed.`);
      }
    }

    if (highPriority > 0) {
      insights.push(`You had ${highPriority} high-priority ${highPriority === 1 ? "task" : "tasks"} this week.`);
    }

    if (missed > total * 0.3 && missed > 0) {
      insights.push("Over 30% of tasks were missed. Consider reducing your workload or adjusting schedules.");
    }

    // Ensure at least one insight
    if (insights.length === 0 && total > 0) {
      insights.push("Continue maintaining your activity schedule.");
    }

    return {
      summary,
      insights,
    };
  }

  async monthly(input: ReflectionMonthlyInput): Promise<ReflectionMonthlyOutput> {
    const calendarService = new CalendarService(this.userId);
    
    // Default to current month if no date provided
    const timezone = input.timezone || "Asia/Kolkata";
    const date = input.date || zonedYmd(new Date(), timezone);

    // Get all activities for the month
    const result = await calendarService.list({
      range: "month",
      date,
      timezone,
    });

    const activities = result.activities;

    // Analyze monthly trends
    const total = activities.length;
    const completed = activities.filter((a) => a.status === "done").length;
    const missed = activities.filter((a) => a.status === "missed").length;
    const cancelled = activities.filter((a) => a.status === "cancelled").length;
    
    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    // Category distribution
    const categoryCount: Record<string, number> = {};
    activities.forEach((activity) => {
      const cat = activity.category || "Uncategorized";
      categoryCount[cat] = (categoryCount[cat] || 0) + 1;
    });

    const topCategories = Object.entries(categoryCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3);

    // Priority vs completion correlation
    const highPriorityActivities = activities.filter((a) => a.priority >= 4);
    const highPriorityCompleted = highPriorityActivities.filter(
      (a) => a.status === "done"
    ).length;
    const highPriorityRate = highPriorityActivities.length > 0
      ? Math.round((highPriorityCompleted / highPriorityActivities.length) * 100)
      : 0;

    const lowPriorityActivities = activities.filter((a) => a.priority <= 2);
    const lowPriorityCompleted = lowPriorityActivities.filter(
      (a) => a.status === "done"
    ).length;
    const lowPriorityRate = lowPriorityActivities.length > 0
      ? Math.round((lowPriorityCompleted / lowPriorityActivities.length) * 100)
      : 0;

    // Generate summary
    let summary = "";
    if (total === 0) {
      summary = "You had no activities scheduled this month.";
    } else {
      const monthName = new Date(date).toLocaleDateString("en-US", {
        month: "long",
        year: "numeric",
        timeZone: timezone,
      });
      summary = `In ${monthName}, you completed ${completed} out of ${total} activities (${completionRate}% completion rate).`;
      if (missed > 0) {
        summary += ` ${missed} ${missed === 1 ? "task was" : "tasks were"} missed.`;
      }
      if (cancelled > 0) {
        summary += ` ${cancelled} ${cancelled === 1 ? "task was" : "tasks were"} cancelled.`;
      }
    }

    // Generate trends
    const trends: string[] = [];

    if (completionRate >= 75) {
      trends.push("Strong overall performance with high completion rate.");
    } else if (completionRate >= 50) {
      trends.push("Moderate completion rate. Consider optimizing your schedule.");
    } else if (completionRate > 0) {
      trends.push("Low completion rate this month. Review your workload and priorities.");
    }

    if (topCategories.length > 0) {
      const categoryList = topCategories
        .map((c) => `${c[0]} (${c[1]} activities)`)
        .join(", ");
      trends.push(`Top activity categories: ${categoryList}.`);
    }

    if (highPriorityActivities.length > 0) {
      if (highPriorityRate >= 80) {
        trends.push(`Excellent focus on priorities: ${highPriorityRate}% of high-priority tasks completed.`);
      } else if (highPriorityRate >= 50) {
        trends.push(`${highPriorityRate}% of high-priority tasks completed. Room for improvement.`);
      } else {
        trends.push(`Only ${highPriorityRate}% of high-priority tasks completed. Consider focusing on important items first.`);
      }
    }

    if (lowPriorityActivities.length > 0 && lowPriorityRate > highPriorityRate) {
      trends.push("You completed more low-priority tasks than high-priority ones. Consider prioritizing important work.");
    }

    if (missed > total * 0.25 && missed > 0) {
      trends.push("Over 25% of tasks were missed this month. Consider setting more realistic deadlines.");
    }

    if (cancelled > total * 0.15 && cancelled > 0) {
      trends.push("High cancellation rate suggests over-scheduling. Consider planning more conservatively.");
    }

    // Ensure at least one trend
    if (trends.length === 0 && total > 0) {
      trends.push("Continue tracking your activities for better insights.");
    }

    return {
      summary,
      trends,
    };
  }
}
