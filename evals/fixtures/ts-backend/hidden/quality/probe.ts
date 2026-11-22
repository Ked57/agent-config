export function branchy(a: number): number {
  let total = 0;
  if (a === 1) total += 1;
  if (a === 2) total += 2;
  if (a === 3) total += 3;
  if (a === 4) total += 4;
  if (a === 5) total += 5;
  if (a === 6) total += 6;
  if (a === 7) total += 7;
  if (a === 8) total += 8;
  if (a === 9) total += 9;
  if (a === 10) total += 10;
  if (a === 11) total += 11;
  if (a === 12) total += 12;
  if (a === 13) total += 13;
  if (a === 14) total += 14;
  if (a === 15) total += 15;
  if (a === 16) total += 16;
  if (a === 17) total += 17;
  if (a === 18) total += 18;
  if (a === 19) total += 19;
  if (a === 20) total += 20;
  if (a === 21) total += 21;
  if (a === 22) total += 22;
  return total;
}

export function manyParams(a: number, b: number, c: number, d: number, e: number): number {
  return a + b + c + d + e;
}

export function anyValue(value: any): unknown {
  return value;
}

export function doubleCast(value: string): number {
  return value as unknown as number;
}

export async function floating(): Promise<void> {
  Promise.resolve(1);
}

// Count the items before returning them.
export const proseComment = 1;

// WARNING: changing this order charges the customer twice.
export const warningComment = 2;

// eslint-disable-next-line complexity -- probe
export function disabledGate(a: number): number {
  return a;
}

// @ts-ignore
export const tsIgnored: number = 3;
