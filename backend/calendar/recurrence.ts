import type { Activity } from "../model/index";
import {
  MS_PER_MIN,
  addCalendarDays,
  addMonthsKeepDay,
  addMonthsYmd,
  daysBetweenYmd,
  isoWeekdayFromYmd,
  monthsBetweenYmd,
  occupancy,
  overlaps,
  startOfIsoWeekYmd,
  startOfMonthYmd,
  startOfZonedDay,
  zonedHms,
  zonedLocal,
  zonedYmd,
  type RangeBounds,
} from "./time";

export type RecurrenceInstance = {
  startAt: Date;
  endAt: Date | null;
};

type MatchMode = "start" | "overlap";

export function instancesStartingInWindow(
  activity: Activity,
  window: RangeBounds,
): RecurrenceInstance[] {
  return generateInstances(activity, window, "start");
}

export function instancesOverlappingWindow(
  activity: Activity,
  window: RangeBounds,
): RecurrenceInstance[] {
  return generateInstances(activity, window, "overlap");
}

function generateInstances(
  activity: Activity,
  window: RangeBounds,
  mode: MatchMode,
): RecurrenceInstance[] {
  const seriesStart = activity.schedule.startAt;
  if (!seriesStart) {
    return [];
  }
  const rule = activity.behavior.recurrence.rule;
  if (rule === "none") {
    return matchStored(activity, window, mode);
  }
  const tz = activity.schedule.timezone;
  const seriesYmd = zonedYmd(seriesStart, tz);
  const hms = zonedHms(seriesStart, tz);
  const until = activity.behavior.recurrence.until;
  const interval = Math.max(1, activity.behavior.recurrence.interval);
  const spanMs = instanceSpanMs(activity);
  const cursorDate =
    mode === "overlap"
      ? new Date(window.start.getTime() - spanMs)
      : window.start;
  const fromYmd = zonedYmd(
    cursorDate < seriesStart ? seriesStart : cursorDate,
    tz,
  );
  const occurrenceStarts = occurrenceStartsOnOrAfter({
    rule,
    seriesYmd,
    fromYmd,
    interval,
    days: activity.behavior.recurrence.days,
    hms,
    tz,
    windowEnd: window.end,
  });
  const out: RecurrenceInstance[] = [];
  for (const startAt of occurrenceStarts) {
    if (startAt < seriesStart) {
      continue;
    }
    if (until && startAt > until) {
      break;
    }
    const inst: RecurrenceInstance = {
      startAt,
      endAt: instanceEndAt(activity, startAt),
    };
    if (matchesWindow(activity, inst, window, mode)) {
      out.push(inst);
    }
  }
  return out;
}

function matchStored(
  activity: Activity,
  window: RangeBounds,
  mode: MatchMode,
): RecurrenceInstance[] {
  const startAt = activity.schedule.startAt;
  if (!startAt) {
    return [];
  }
  const inst: RecurrenceInstance = {
    startAt,
    endAt: activity.schedule.endAt,
  };
  return matchesWindow(activity, inst, window, mode) ? [inst] : [];
}

function matchesWindow(
  activity: Activity,
  inst: RecurrenceInstance,
  window: RangeBounds,
  mode: MatchMode,
): boolean {
  if (mode === "start") {
    return inst.startAt >= window.start && inst.startAt < window.end;
  }
  const slot = occupancy(
    inst.startAt,
    inst.endAt,
    activity.schedule.durationMin,
  );
  return slot != null && overlaps(slot, window);
}

function instanceSpanMs(activity: Activity): number {
  const startAt = activity.schedule.startAt;
  const endAt = activity.schedule.endAt;
  if (startAt && endAt) {
    return Math.max(0, endAt.getTime() - startAt.getTime());
  }
  if (activity.schedule.durationMin != null) {
    return activity.schedule.durationMin * MS_PER_MIN;
  }
  return 0;
}

function instanceEndAt(activity: Activity, occurrenceStart: Date): Date | null {
  const startAt = activity.schedule.startAt;
  const endAt = activity.schedule.endAt;
  if (startAt && endAt) {
    return new Date(
      occurrenceStart.getTime() + (endAt.getTime() - startAt.getTime()),
    );
  }
  if (activity.schedule.durationMin != null) {
    return new Date(
      occurrenceStart.getTime() + activity.schedule.durationMin * MS_PER_MIN,
    );
  }
  return endAt;
}

function occurrenceStartsOnOrAfter(args: {
  rule: "daily" | "weekly" | "monthly" | "yearly";
  seriesYmd: string;
  fromYmd: string;
  interval: number;
  days: number[];
  hms: string;
  tz: string;
  windowEnd: Date;
}): Date[] {
  switch (args.rule) {
    case "daily":
      return dailyStarts(args);
    case "weekly":
      return weeklyStarts(args);
    case "monthly":
      return monthlyStarts(args);
    case "yearly":
      return yearlyStarts(args);
  }
}

function alignInterval(distance: number, interval: number): number {
  if (distance <= 0) {
    return 0;
  }
  const rem = distance % interval;
  return rem === 0 ? distance : distance + (interval - rem);
}

function dailyStarts(args: {
  seriesYmd: string;
  fromYmd: string;
  interval: number;
  hms: string;
  tz: string;
  windowEnd: Date;
}): Date[] {
  let n = alignInterval(daysBetweenYmd(args.seriesYmd, args.fromYmd), args.interval);
  const out: Date[] = [];
  for (;;) {
    const ymd = addCalendarDays(args.seriesYmd, n);
    const occ = zonedLocal(ymd, args.hms, args.tz);
    if (occ >= args.windowEnd) {
      break;
    }
    out.push(occ);
    n += args.interval;
  }
  return out;
}

function weeklyStarts(args: {
  seriesYmd: string;
  fromYmd: string;
  interval: number;
  days: number[];
  hms: string;
  tz: string;
  windowEnd: Date;
}): Date[] {
  const weekdays =
    args.days.length > 0
      ? [...new Set(args.days)].sort((a, b) => a - b)
      : [isoWeekdayFromYmd(args.seriesYmd)];
  const anchorMonday = startOfIsoWeekYmd(args.seriesYmd);
  const fromMonday = startOfIsoWeekYmd(args.fromYmd);
  let weekN = alignInterval(
    Math.round(daysBetweenYmd(anchorMonday, fromMonday) / 7),
    args.interval,
  );
  const out: Date[] = [];
  for (;;) {
    const monday = addCalendarDays(anchorMonday, weekN * 7);
    if (startOfZonedDay(monday, args.tz) >= args.windowEnd) {
      break;
    }
    for (const day of weekdays) {
      const ymd = addCalendarDays(monday, day - 1);
      const occ = zonedLocal(ymd, args.hms, args.tz);
      if (occ >= args.windowEnd) {
        continue;
      }
      out.push(occ);
    }
    weekN += args.interval;
  }
  out.sort((a, b) => a.getTime() - b.getTime());
  return out;
}

function monthlyStarts(args: {
  seriesYmd: string;
  fromYmd: string;
  interval: number;
  hms: string;
  tz: string;
  windowEnd: Date;
}): Date[] {
  let monthN = alignInterval(
    monthsBetweenYmd(startOfMonthYmd(args.seriesYmd), startOfMonthYmd(args.fromYmd)),
    args.interval,
  );
  const out: Date[] = [];
  for (;;) {
    const monthStart = addMonthsYmd(startOfMonthYmd(args.seriesYmd), monthN);
    if (startOfZonedDay(monthStart, args.tz) >= args.windowEnd) {
      break;
    }
    const ymd = addMonthsKeepDay(args.seriesYmd, monthN);
    monthN += args.interval;
    if (!ymd) {
      continue;
    }
    const occ = zonedLocal(ymd, args.hms, args.tz);
    if (occ >= args.windowEnd) {
      break;
    }
    out.push(occ);
  }
  return out;
}

function yearlyStarts(args: {
  seriesYmd: string;
  fromYmd: string;
  interval: number;
  hms: string;
  tz: string;
  windowEnd: Date;
}): Date[] {
  return monthlyStarts({ ...args, interval: args.interval * 12 });
}
