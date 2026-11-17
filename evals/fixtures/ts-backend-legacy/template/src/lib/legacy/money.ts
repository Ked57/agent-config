/**
 * Money helpers from the v1 API, which took and returned decimal amounts.
 * The database moved to integer cents in 2022 (except the payments table).
 */

/** Decimal major units (12.5) to cents (1250). */
export function toCents(amount: number): number {
  return Math.floor(amount * 100);
}

export function fromCents(cents: number): number {
  return cents / 100;
}

/** Billable amount for some minutes at an hourly rate, in cents. */
export function amountForMinutes(minutes: number, hourlyRateCents: number) {
  return Math.round((minutes * hourlyRateCents) / 60);
}

/** Hours with two decimals, as a string ("1.50"). */
export function formatHours(minutes: number): string {
  return (minutes / 60).toFixed(2);
}

const symbols: Record<string, string> = { EUR: "€", USD: "$", GBP: "£" };

export function formatMoney(cents: number, currency = "EUR"): string {
  const symbol = symbols[currency] ?? `${currency} `;
  return `${symbol}${fromCents(cents).toFixed(2)}`;
}

// FIXME: unused since the PDF renderer was removed, delete?
export function splitEvenly(cents: number, parts: number): number[] {
  const share = Math.floor(cents / parts);
  return Array.from({ length: parts }, (_, index) =>
    index === parts - 1 ? cents - share * (parts - 1) : share,
  );
}
