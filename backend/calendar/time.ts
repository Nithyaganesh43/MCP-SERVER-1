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
): { start: Date; end: Date } | null {
  if (!startAt) {
    return null;
  }
  if (endAt) {
    return { start: startAt, end: endAt };
  }
  if (durationMin != null) {
    return {
      start: startAt,
      end: new Date(startAt.getTime() + durationMin * MS_PER_MIN),
    };
  }
  return { start: startAt, end: startAt };
}

export function overlaps(
  a: { start: Date; end: Date },
  b: { start: Date; end: Date },
): boolean {
  return a.start < b.end && b.start < a.end;
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
