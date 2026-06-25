// Approval-Status lebt seit der Per-Version-Migration ausschließlich auf
// `TemplateVersion` — nicht mehr auf `Template`. Daher gibt es hier zwei
// Helfer:
//
//   1. `deriveTemplateOverallStatus(template)` leitet eine UI-taugliche
//      Aggregations-Bewertung aus den Versionen ab. Reihenfolge:
//        - Hat eine APPROVED & is_active Version  → "active"
//        - Hat eine APPROVED Version              → "approved"
//        - Hat PENDING Versionen                  → "pending"
//        - Hat NUR REJECTED/DEPRECATED            → "rejected"
//        - Keine Versionen                        → "empty"
//
//   2. <ApprovalBadge /> rendert für jeden Enum-Wert ein einheitliches
//      Badge — wird sowohl pro Version als auch fürs Aggregat verwendet.
//
// Wichtig: Das alte `template.approval_status` existiert im Backend-Response
// nicht; jede Stelle, die das früher gelesen hat, muss diesen Helfer
// benutzen oder direkt auf `version.approval_status` zeigen.

import type { TemplateDto, TemplateVersionApprovalStatus } from "../api/templates";

export type TemplateOverallStatus =
  | "active"     // mind. eine approved Version ist aktiv → deploybar
  | "approved"   // approved Versionen vorhanden, aber keine aktive
  | "pending"    // wartet auf Admin-Approval
  | "rejected"   // alles abgelehnt oder veraltet
  | "empty";     // gar keine Versionen importiert

export function deriveTemplateOverallStatus(
  template: Pick<TemplateDto, "versions">,
): TemplateOverallStatus {
  const versions = template.versions ?? [];
  if (versions.length === 0) return "empty";

  const approved = versions.filter((v) => v.approval_status === "approved");
  if (approved.some((v) => v.is_active)) return "active";
  if (approved.length > 0) return "approved";

  if (versions.some((v) => v.approval_status === "pending")) return "pending";
  return "rejected";
}

/** Label + Tailwind-Klassen für jedes Enum, an einer Stelle. */
export function badgeStyle(
  status: TemplateVersionApprovalStatus,
): { text: string; cls: string } {
  switch (status) {
    case "approved":
      return { text: "genehmigt", cls: "bg-green-100 text-green-700" };
    case "pending":
      return { text: "offen", cls: "bg-amber-100 text-amber-700" };
    case "rejected":
      return { text: "abgelehnt", cls: "bg-red-100 text-red-700" };
    case "deprecated":
      return { text: "veraltet", cls: "bg-slate-200 text-slate-600" };
  }
}

/** Aggregations-Bewertung → Label + Klassen für das Template-Gesamt-Badge. */
export function overallBadgeStyle(
  status: TemplateOverallStatus,
): { text: string; cls: string } {
  switch (status) {
    case "active":
      return { text: "einsatzbereit", cls: "bg-green-100 text-green-700" };
    case "approved":
      return { text: "genehmigt", cls: "bg-green-100 text-green-700" };
    case "pending":
      return { text: "wartet auf Freigabe", cls: "bg-amber-100 text-amber-700" };
    case "rejected":
      return { text: "abgelehnt", cls: "bg-red-100 text-red-700" };
    case "empty":
      return { text: "keine Versionen", cls: "bg-slate-100 text-slate-600" };
  }
}
