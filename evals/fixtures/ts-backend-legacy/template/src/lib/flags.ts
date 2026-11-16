/**
 * Per-organization feature flags, stored as JSON on organizations.feature_flags.
 * Unknown flags read as their default.
 */
export const flagDefaults = {
  /** v2 reports in the web app. The v1 endpoints stay mounted for the mobile app. */
  reportsV2: true,
  /** Invoice numbers as INV-<year>-<seq>; the old random numbers are gone. */
  newInvoiceNumbers: true,
  /** TODO(#312): time-entry approvals. Not built yet. */
  timeApprovals: false,
  /** Outgoing webhooks (beta). */
  webhooks: false,
} as const;

export type Flag = keyof typeof flagDefaults;

export function parseFlags(raw: string | null | undefined) {
  let stored: Record<string, unknown> = {};
  try {
    stored = raw ? (JSON.parse(raw) as Record<string, unknown>) : {};
  } catch {
    stored = {};
  }
  const flags = { ...flagDefaults } as Record<Flag, boolean>;
  for (const key of Object.keys(flagDefaults) as Flag[]) {
    if (typeof stored[key] === "boolean") flags[key] = stored[key];
  }
  return flags;
}

export function isEnabled(
  org: { featureFlags: string } | undefined,
  flag: Flag,
): boolean {
  return parseFlags(org?.featureFlags)[flag];
}
