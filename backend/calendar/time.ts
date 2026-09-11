import { HttpError } from "../errors";

export const MS_PER_MIN = 60_000;
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function assertTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone }).format(new Date());
  } catch {
    throw new HttpError(400, `Invalid timezone: ${timeZone}`);
  }
}

function offsetMs(timeZone: string, at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    timeZoneName: "longOffset",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(at);
  const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
  const match = name.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
  if (!match) {
    throw new HttpError(400, `Cannot resolve offset for timezone: ${timeZone}`);
  }
  const sign = match[1] === "-" ? -1 : 1;
  const hours = Number(match[2]);
  const minutes = Number(match[3] ?? "0");
  return sign * (hours * 60 + minutes) * MS_PER_MIN;
}

export function zonedLocal(ymd: string, hms: string, timeZone: string): Date {
  assertTimeZone(timeZone);
  const asUtc = Date.parse(`${ymd}T${hms}Z`);
  if (Number.isNaN(asUtc)) {
    throw new HttpError(400, `Invalid date: ${ymd}T${hms}`);
  }
  const utcMs = asUtc - offsetMs(timeZone, new Date(asUtc));
  return new Date(asUtc - offsetMs(timeZone, new Date(utcMs)));
}

export function startOfZonedDay(ymd: string, timeZone: string): Date {
  return zonedLocal(ymd, "00:00:00", timeZone);
}

export function addCalendarDays(ymd: string, days: number): string {
  const match = YMD.exec(ymd);
  if (!match) {
    throw new HttpError(400, `Invalid date: ${ymd}`);
  }
  const utc = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]) + days),
  );
  return utc.toISOString().slice(0, 10);
}

export function isoWeekdayFromYmd(ymd: string): number {
  const match = YMD.exec(ymd);
  if (!match) {
    throw new HttpError(400, `Invalid date: ${ymd}`);
  }
  const js = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  ).getUTCDay();
  return js === 0 ? 7 : js;
}

export function startOfIsoWeekYmd(ymd: string): string {
  return addCalendarDays(ymd, 1 - isoWeekdayFromYmd(ymd));
}

export function startOfMonthYmd(ymd: string): string {
  if (!YMD.test(ymd)) {
    throw new HttpError(400, `Invalid date: ${ymd}`);
  }
  return `${ymd.slice(0, 7)}-01`;
}

export function addMonthsYmd(ymd: string, months: number): string {
  const match = YMD.exec(ymd);
  if (!match) {
    throw new HttpError(400, `Invalid date: ${ymd}`);
  }
  const utc = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1 + months, 1),
  );
  return utc.toISOString().slice(0, 10);
}

export function addMonthsKeepDay(ymd: string, months: number): string | null {
  const match = YMD.exec(ymd);
  if (!match) {
    throw new HttpError(400, `Invalid date: ${ymd}`);
  }
  const day = Number(match[3]);
  const utc = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1 + months, day),
  );
  if (utc.getUTCDate() !== day) {
    return null;
  }
  return utc.toISOString().slice(0, 10);
}

export function daysBetweenYmd(from: string, to: string): number {
  const a = YMD.exec(from);
  const b = YMD.exec(to);
  if (!a || !b) {
    throw new HttpError(400, `Invalid date: ${!a ? from : to}`);
  }
  const fromUtc = Date.UTC(Number(a[1]), Number(a[2]) - 1, Number(a[3]));
  const toUtc = Date.UTC(Number(b[1]), Number(b[2]) - 1, Number(b[3]));
  return Math.round((toUtc - fromUtc) / 86_400_000);
}

export function monthsBetweenYmd(from: string, to: string): number {
  const a = YMD.exec(from);
  const b = YMD.exec(to);
  if (!a || !b) {
    throw new HttpError(400, `Invalid date: ${!a ? from : to}`);
  }
  return (Number(b[1]) - Number(a[1])) * 12 + (Number(b[2]) - Number(a[2]));
}

export function zonedYmd(date: Date, timeZone: string): string {
  assertTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "01";
  const day = parts.find((part) => part.type === "day")?.value ?? "01";
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

export function zonedHms(date: Date, timeZone: string): string {
  assertTimeZone(timeZone);
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);
  let hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  const second = parts.find((part) => part.type === "second")?.value ?? "00";
  if (hour === "24") {
    hour = "00";
  }
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}`;
}

export type RangeBounds = { start: Date; end: Date };

export function dayBounds(ymd: string, timeZone: string): RangeBounds {
  const start = startOfZonedDay(ymd, timeZone);
  const end = startOfZonedDay(addCalendarDays(ymd, 1), timeZone);
  return { start, end };
}

export function weekBounds(ymd: string, timeZone: string): RangeBounds {
  const monday = startOfIsoWeekYmd(ymd);
  const start = startOfZonedDay(monday, timeZone);
  const end = startOfZonedDay(addCalendarDays(monday, 7), timeZone);
  return { start, end };
}

export function monthBounds(ymd: string, timeZone: string): RangeBounds {
  const first = startOfMonthYmd(ymd);
  const start = startOfZonedDay(first, timeZone);
  const end = startOfZonedDay(addMonthsYmd(first, 1), timeZone);
  return { start, end };
}

export function formatHm(date: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(date);
  const hour = parts.find((part) => part.type === "hour")?.value ?? "00";
  const minute = parts.find((part) => part.type === "minute")?.value ?? "00";
  return `${hour.padStart(2, "0")}:${minute.padStart(2, "0")}`;
}

export type Occupied = { start: Date; end: Date; title: string };

export function occupancy(
  startAt: Date | null,
  endAt: Date | null,
  durationMin: number | null,
  bufferBeforeMin?: number | null,
  bufferAfterMin?: number | null,
): { start: Date; end: Date } | null {
  if (!startAt) {
    return null;
  }
  const bBeforeMs = (bufferBeforeMin ?? 0) * MS_PER_MIN;
  const bAfterMs = (bufferAfterMin ?? 0) * MS_PER_MIN;
  const start = new Date(startAt.getTime() - bBeforeMs);
  let end: Date;
  if (endAt) {
    end = new Date(endAt.getTime() + bAfterMs);
  } else if (durationMin != null) {
    end = new Date(startAt.getTime() + durationMin * MS_PER_MIN + bAfterMs);
  } else {
    end = new Date(startAt.getTime() + bAfterMs);
  }
  return { start, end };
}

export function overlaps(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
): boolean {
  return a.start < b.end && b.start < a.end;
}

export function quietHoursOccupied(
  dayYmd: string,
  timeZone: string,
  quietHours?: { start: string; end: string },
): Occupied[] {
  if (!quietHours) return [];
  const { start: startHm, end: endHm } = quietHours;
  const blocks: Occupied[] = [];

  if (startHm > endHm) {
    const start1 = zonedLocal(dayYmd, "00:00:00", timeZone);
    const end1 = zonedLocal(dayYmd, `${endHm}:00`, timeZone);
    if (start1 < end1) {
      blocks.push({ start: start1, end: end1, title: "Quiet hours" });
    }
    const start2 = zonedLocal(dayYmd, `${startHm}:00`, timeZone);
    const nextYmd = addCalendarDays(dayYmd, 1);
    const end2 = zonedLocal(nextYmd, "00:00:00", timeZone);
    if (start2 < end2) {
      blocks.push({ start: start2, end: end2, title: "Quiet hours" });
    }
  } else if (startHm < endHm) {
    const start = zonedLocal(dayYmd, `${startHm}:00`, timeZone);
    const end = zonedLocal(dayYmd, `${endHm}:00`, timeZone);
    if (start < end) {
      blocks.push({ start, end, title: "Quiet hours" });
    }
  }
  return blocks;
}

export function mergeBusy(items: Occupied[]): Occupied[] {
  if (items.length === 0) {
    return [];
  }
  const sorted = [...items].sort((x, y) => x.start.getTime() - y.start.getTime());
  const out: Occupied[] = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i += 1) {
    const cur = sorted[i];
    const last = out[out.length - 1];
    if (cur.start <= last.end) {
      if (cur.end > last.end) {
        last.end = cur.end;
      }
    } else {
      out.push({ ...cur });
    }
  }
  return out;
}

export function largestSlot(
  dayStart: Date,
  dayEnd: Date,
  busy: Occupied[],
  durationMin: number,
  options?: {
    preferredWindow?: { start: Date; end: Date };
  },
): { start: Date; end: Date; nextTitle: string | null } | null {
  const need = durationMin * MS_PER_MIN;
  const clipped = busy
    .map((item) => ({
      start: item.start < dayStart ? dayStart : item.start,
      end: item.end > dayEnd ? dayEnd : item.end,
      title: item.title,
    }))
    .filter((item) => item.start < item.end);
  const merged = mergeBusy(clipped);
  type Gap = { start: Date; end: Date; nextTitle: string | null };
  const gaps: Gap[] = [];
  let cursor = dayStart;
  for (const block of merged) {
    if (block.start > cursor) {
      gaps.push({ start: cursor, end: block.start, nextTitle: block.title });
    }
    if (block.end > cursor) {
      cursor = block.end;
    }
  }
  if (cursor < dayEnd) {
    gaps.push({ start: cursor, end: dayEnd, nextTitle: null });
  }

  // If a preferred window is provided, try to find a fit in that window first
  if (options?.preferredWindow) {
    const pStart = options.preferredWindow.start;
    const pEnd = options.preferredWindow.end;
    for (const gap of gaps) {
      const overlapStart = gap.start > pStart ? gap.start : pStart;
      const overlapEnd = gap.end < pEnd ? gap.end : pEnd;
      if (overlapEnd.getTime() - overlapStart.getTime() >= need) {
        return {
          start: overlapStart,
          end: new Date(overlapStart.getTime() + need),
          nextTitle: gap.nextTitle,
        };
      }
    }
  }

  let best: Gap | null = null;
  for (const gap of gaps) {
    const size = gap.end.getTime() - gap.start.getTime();
    if (size < need) {
      continue;
    }
    const bestSize = best ? best.end.getTime() - best.start.getTime() : -1;
    if (size > bestSize || (size === bestSize && best && gap.start < best.start)) {
      best = gap;
    }
  }
  if (!best) {
    return null;
  }
  return {
    start: best.start,
    end: new Date(best.start.getTime() + need),
    nextTitle: best.nextTitle,
  };
}

export type FloatingReserve = {
  title: string;
  durationMin: number;
  priority: number;
};

/**
 * Place unscheduled floating tasks into free gaps (higher priority first).
 * Occupied blocks are returned so suggest_slot can plan around them.
 */
export function reserveFloatingGaps(
  dayStart: Date,
  dayEnd: Date,
  busy: Occupied[],
  floaters: FloatingReserve[],
): Occupied[] {
  const reserved: Occupied[] = [];
  const ordered = [...floaters].sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return a.title.localeCompare(b.title);
  });
  for (const floater of ordered) {
    if (floater.durationMin <= 0) {
      continue;
    }
    const placed = largestSlot(
      dayStart,
      dayEnd,
      [...busy, ...reserved],
      floater.durationMin,
    );
    if (!placed) {
      continue;
    }
    reserved.push({
      start: placed.start,
      end: placed.end,
      title: floater.title,
    });
  }
  return reserved;
}
