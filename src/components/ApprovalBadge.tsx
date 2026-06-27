// Einheitliches Approval-Badge. Wir haben drei Stellen, die das vorher mit
// jeweils eigenem `switch` gemacht haben (TemplateOwnerDetailDialog,
// UpgradeVersionDialog, AppStore). Konsolidiert hier, damit Farben und Labels
// nicht auseinanderlaufen.
//
// `status` akzeptiert sowohl die rohen Enum-Werte aus dem Backend
// (`pending`/`approved`/...) als auch die abgeleiteten Aggregat-Werte
// (`active`/`empty`/...). So kann das Template-Card-Badge dieselbe Komponente
// nutzen wie die Versionszeile.

import { Check, ShieldCheck, ShieldQuestion, X, Clock, Archive } from "lucide-react";
import { Badge } from "./ui/badge";
import {
  badgeStyle,
  overallBadgeStyle,
  type TemplateOverallStatus,
} from "../lib/template-status";
import type { TemplateVersionApprovalStatus } from "../api/templates";

type Variant = "version" | "overall";

interface Props {
  status: TemplateVersionApprovalStatus | TemplateOverallStatus;
  /** "version" zeigt die rohe Enum-Anzeige (pending/approved/rejected/deprecated),
   *  "overall" zeigt die aggregierte Template-Bewertung. Default: "version". */
  variant?: Variant;
  showIcon?: boolean;
  className?: string;
  /** Optionaler Hover-Text. Praktisch für Reject-Badges, an denen wir den
   *  `rejection_reason` zeigen wollen, ohne die Versionszeile umzubauen. */
  tooltip?: string | null;
}

function pickIcon(status: Props["status"]) {
  switch (status) {
    case "approved":
    case "active":
      return ShieldCheck;
    case "pending":
      return ShieldQuestion;
    case "rejected":
      return X;
    case "deprecated":
      return Archive;
    case "empty":
      return Clock;
    default:
      return Check;
  }
}

export function ApprovalBadge({
  status,
  variant = "version",
  showIcon = true,
  className,
  tooltip,
}: Props) {
  // Variant-Erkennung: die beiden Wertesätze überschneiden sich nicht außer bei
  // "approved", aber Aufrufer übergeben explizit, was sie meinen — wir nehmen
  // das ernst und routen entsprechend.
  let label: string;
  let cls: string;
  if (variant === "overall") {
    const s = overallBadgeStyle(status as TemplateOverallStatus);
    label = s.text;
    cls = s.cls;
  } else {
    // Private-Template-Versionen haben approval_status === null und brauchen
    // gar kein Badge — wir rendern nichts statt einen Platzhalter.
    const s = badgeStyle(status as TemplateVersionApprovalStatus);
    if (s === null) return null;
    label = s.text;
    cls = s.cls;
  }

  const Icon = pickIcon(status);

  return (
    <Badge
      className={`${cls} hover:${cls} ${className ?? ""}`.trim()}
      title={tooltip ?? undefined}
    >
      {showIcon && <Icon className="w-3 h-3 mr-1" />}
      {label}
    </Badge>
  );
}
