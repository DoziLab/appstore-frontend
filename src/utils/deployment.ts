import type { DeploymentDto } from "../api/deployments";

/**
 * Lifecycle state of a deployment based on how much runtime is left before its
 * `expires_at` timestamp (set by the backend at create-/extend-time).
 *
 * - "ok"       : more than 3 months left — no banner, no icon
 * - "warning"  : within 3 months of expiry (yellow) — expiry approaching
 * - "critical" : within 6 weeks of expiry (red) — expiry imminent
 * - "expired"  : past `expires_at`, will be hard-deleted by the next Beat sweep
 *
 * The 6-week / 3-month windows (issue #180) are fixed frontend constants for
 * now. The issue discussion raised whether these durations should instead come
 * from the backend — if that happens, replace the constants below with values
 * read off the DTO. Whether every extension is actually accepted is a separate
 * concern tracked in #184.
 *
 * Legacy deployments without an `expires_at` stay "ok" forever so the UI never
 * warns about something the backend isn't actually tracking.
 */
export type ExpiryState = "ok" | "warning" | "critical" | "expired";

// Pre-expiry thresholds, expressed in ms. Days-based (not calendar months) to
// mirror the backend's DAYS_PER_MONTH=30 approximation in deployment_expiry.py.
const SIX_WEEKS_MS = 42 * 24 * 60 * 60 * 1000; // "critical" — red
const THREE_MONTHS_MS = 90 * 24 * 60 * 60 * 1000; // "warning" — yellow

export function getExpiryState(
  deployment: Pick<DeploymentDto, "expires_at">
): ExpiryState {
  if (!deployment.expires_at) return "ok";
  const expiresAtMs = new Date(deployment.expires_at).getTime();
  if (Number.isNaN(expiresAtMs)) return "ok";
  const remaining = expiresAtMs - Date.now();
  if (remaining <= 0) return "expired";
  if (remaining <= SIX_WEEKS_MS) return "critical";
  if (remaining <= THREE_MONTHS_MS) return "warning";
  return "ok";
}
