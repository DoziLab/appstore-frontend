import type { DeploymentDto } from "../api/deployments";

/**
 * Lifecycle state of a deployment based on its `expires_at` and
 * `expiry_warning_at` timestamps (set by the backend at create-time).
 *
 * - "ok"      : not expiring soon — no banner, no icon
 * - "warning" : within the warning window (e.g. ≤14 days before expiry)
 * - "expired" : past expires_at, will be hard-deleted by the next Beat sweep
 *
 * Legacy deployments without expiry timestamps stay "ok" forever so the
 * UI never warns about something the backend isn't actually tracking.
 */
export type ExpiryState = "ok" | "warning" | "expired";

export function getExpiryState(
  deployment: Pick<DeploymentDto, "expires_at" | "expiry_warning_at">
): ExpiryState {
  if (!deployment.expires_at || !deployment.expiry_warning_at) return "ok";
  const now = Date.now();
  const expiresAtMs = new Date(deployment.expires_at).getTime();
  const warnAtMs = new Date(deployment.expiry_warning_at).getTime();
  if (now >= expiresAtMs) return "expired";
  if (now >= warnAtMs) return "warning";
  return "ok";
}
