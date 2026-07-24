// Approval-Status lebt seit der Per-Version-Migration ausschließlich auf
// `TemplateVersion` — nicht mehr auf `Template`. Daher gibt es hier zwei
// Helfer:
//
//   1. `deriveTemplateOverallStatus(template)` leitet eine UI-taugliche
//      Aggregations-Bewertung aus den Versionen ab. Reihenfolge:
//        - publish_requested ist gesetzt UND es gibt PENDING-Versionen
//          (Owner hat „öffentlich" gewählt; Template ist PRIVATE bis
//          zur Erst-Genehmigung) → "awaiting_publish"
//        - Hat eine `approval_status === null` & is_active Version
//          (Private-Template — kein Approval-Flow, direkt nutzbar) → "active"
//        - Hat eine APPROVED & is_active Version  → "active"
//        - Hat eine APPROVED Version              → "approved"
//        - Hat eine Version mit approval_status === null
//          (Private-Template, ohne is_active markiert) → "active"
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
  | "awaiting_publish"  // Owner hat „öffentlich" gewählt; wartet auf Erst-Genehmigung
  | "active"     // mind. eine deploybare Version (approved+aktiv oder Private)
  | "approved"   // approved Versionen vorhanden, aber keine aktive
  | "pending"    // wartet auf Admin-Approval (bestehend-öffentliches Template)
  | "rejected"   // alles abgelehnt oder veraltet
  | "empty";     // gar keine Versionen importiert

export function deriveTemplateOverallStatus(
  template: Pick<TemplateDto, "versions" | "publish_requested" | "visibility">,
): TemplateOverallStatus {
  const versions = template.versions ?? [];
  if (versions.length === 0) return "empty";

  // Erst-Veröffentlichungs-Pfad: Owner hat das Template als „öffentlich"
  // markiert, Backend hält es bis zur Erst-Genehmigung als PRIVATE +
  // publish_requested. Wir zeigen das DEM OWNER als eigenständigen Status,
  // damit es nicht fälschlich als „nur privat" oder „normal pending"
  // wahrgenommen wird. Andere (Non-Owner) sehen dieses Template ohnehin
  // gar nicht erst — Backend filtert sie aus.
  if (
    template.publish_requested === true
    && versions.some((v) => v.approval_status === "pending")
  ) {
    return "awaiting_publish";
  }

  // Private-Templates: Versionen tragen approval_status === null und sind
  // für den Owner ohne weiteren Workflow nutzbar.
  const privateVersions = versions.filter((v) => v.approval_status === null);
  if (privateVersions.some((v) => v.is_active)) return "active";

  const approved = versions.filter((v) => v.approval_status === "approved");
  if (approved.some((v) => v.is_active)) return "active";
  if (approved.length > 0) return "approved";

  // Private-Versionen ohne is_active-Flag: trotzdem als „nutzbar" anzeigen,
  // damit ein frisch importiertes Private-Template nicht als „pending"
  // beim Owner aufschlägt.
  if (privateVersions.length > 0) return "active";

  if (versions.some((v) => v.approval_status === "pending")) return "pending";
  return "rejected";
}

/** Label + Tailwind-Klassen für jedes Enum, an einer Stelle. */
export function badgeStyle(
  status: TemplateVersionApprovalStatus,
): { text: string; cls: string } | null {
  switch (status) {
    case "approved":
      return { text: "genehmigt", cls: "bg-green-100 text-green-700" };
    case "pending":
      return { text: "offen", cls: "bg-amber-100 text-amber-700" };
    case "rejected":
      return { text: "abgelehnt", cls: "bg-red-100 text-red-700" };
    case "deprecated":
      return { text: "veraltet", cls: "bg-slate-200 text-slate-600" };
    case null:
      // Private-Template-Version — kein Approval-Workflow, deshalb auch
      // kein Badge. Caller darf einfach nichts rendern.
      return null;
  }
}

/** Aggregations-Bewertung → Label + Klassen für das Template-Gesamt-Badge. */
export function overallBadgeStyle(
  status: TemplateOverallStatus,
): { text: string; cls: string } {
  switch (status) {
    case "awaiting_publish":
      return {
        text: "wartet auf Erst-Freigabe",
        cls: "bg-amber-100 text-amber-700",
      };
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
