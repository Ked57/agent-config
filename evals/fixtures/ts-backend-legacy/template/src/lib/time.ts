/**
 * Newer time helpers (2024). Meant to replace src/lib/legacy/dates.ts; only the
 * notification digest uses them so far.
 */

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** The calendar day (YYYY-MM-DD) of an instant in an IANA time zone. */
export function zonedDay(at: Date | number, timeZone: string): string {
  return formatterFor(timeZone).format(at);
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    formatterFor(timeZone);
    return true;
  } catch {
    return false;
  }
}

export const nowIso = () => new Date().toISOString();
