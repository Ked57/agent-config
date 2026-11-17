/**
 * Date helpers from the first version of the app (2019). Days are plain
 * `YYYY-MM-DD` strings; timestamps are epoch milliseconds.
 *
 * New code should prefer src/lib/time.ts, but most modules still use these.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

const pad = (value: number) => String(value).padStart(2, "0");

/** Calendar day of a timestamp. */
// TODO(2021): timezones? All customers are in Europe for now, UTC is close enough.
export function dayKey(at: number | Date): string {
  const ms = typeof at === "number" ? at : at.getTime();
  return new Date(ms).toISOString().slice(0, 10);
}

/** Midnight UTC of a day, as epoch ms. */
export function dayStart(day: string): number {
  return Date.parse(`${day}T00:00:00.000Z`);
}

export function addDays(day: string, days: number): string {
  return dayKey(dayStart(day) + days * DAY_MS);
}

/**
 * Adds whole calendar months to a day. The day of month is kept, clamped to the
 * last day of the target month (2026-01-31 + 1 month = 2026-02-28).
 */
export function addMonths(day: string, months: number): string {
  const [year, month, date] = day.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const index = month - 1 + months;
  const targetYear = year + Math.floor(index / 12);
  const targetMonth = (((index % 12) + 12) % 12) + 1;
  return `${targetYear}-${pad(targetMonth)}-${pad(date)}`;
}

/** Monday of the week a day falls in. */
export function weekStart(day: string): string {
  const weekday = new Date(dayStart(day)).getUTCDay();
  return addDays(day, weekday === 0 ? -6 : 1 - weekday);
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isValidDay(day: string): boolean {
  const match = DAY_PATTERN.exec(day);
  if (!match) return false;
  const [, y, m, d] = match.map(Number) as [number, number, number, number];
  const parsed = new Date(Date.UTC(y, m - 1, d));
  return (
    parsed.getUTCFullYear() === y &&
    parsed.getUTCMonth() === m - 1 &&
    parsed.getUTCDate() === d
  );
}

/** `DD/MM/YYYY`, the format accountants asked for in the CSV exports and v1 reports. */
export function formatDay(day: string): string {
  if (!isValidDay(day)) throw new RangeError(`invalid calendar day "${day}"`);
  const [y, m, d] = day.split("-");
  return `${d}/${m}/${y}`;
}

/** @deprecated use dayKey */
export function toDay(at: number): string {
  return dayKey(at);
}
