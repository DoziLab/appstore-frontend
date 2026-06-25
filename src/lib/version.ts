// Vergleicht Versions-Strings tolerant: zerlegt in numerische Tokens
// (1.2.3, v1.0.0-rc1, 2024-06-01) und vergleicht element-weise. Nicht-
// numerische Tokens werden lexikografisch verglichen.
//
// Reicht hier nicht für strenges Semver, aber genug, um „neuer als"-
// Vergleiche für die UI-Upgrade-Liste zu machen. Bei Gleichstand zieht
// `created_at` als Tiebreaker (neuere Imports gelten als jüngere Version).
//
// Wir kennen die exakte Versionssprache des Lecturers nicht — das Backend
// macht keine Validierung. Daher: konservativ sein, aber mit deterministischem
// Verhalten für die typischen Fälle (semver, v-prefix, plain Datum).

function tokenize(v: string): Array<number | string> {
  // "v1.2.3-rc.1" → ["1","2","3","rc","1"] → [1,2,3,"rc",1]
  const cleaned = v.replace(/^v/i, "").trim();
  if (!cleaned) return [];
  return cleaned
    .split(/[.\-_+]+/)
    .filter(Boolean)
    .map((tok) => {
      const n = Number(tok);
      return Number.isFinite(n) && /^\d+$/.test(tok) ? n : tok.toLowerCase();
    });
}

/**
 * Returns -1 if `a < b`, 0 if equal, 1 if `a > b`. Numeric tokens beat
 * string tokens at the same position (1.0 > 1.0-rc1). Missing tail tokens
 * count as 0 for numerics ("1.0" === "1.0.0").
 */
export function compareVersions(a: string, b: string): -1 | 0 | 1 {
  const ta = tokenize(a);
  const tb = tokenize(b);
  const len = Math.max(ta.length, tb.length);

  for (let i = 0; i < len; i++) {
    const x = ta[i];
    const y = tb[i];

    if (x === undefined) return typeof y === "number" && y === 0 ? 0 : -1;
    if (y === undefined) return typeof x === "number" && x === 0 ? 0 : 1;

    if (typeof x === "number" && typeof y === "number") {
      if (x < y) return -1;
      if (x > y) return 1;
      continue;
    }

    if (typeof x === "number" && typeof y === "string") return 1;
    if (typeof x === "string" && typeof y === "number") return -1;

    const sx = String(x);
    const sy = String(y);
    if (sx < sy) return -1;
    if (sx > sy) return 1;
  }
  return 0;
}

/**
 * Wahr, wenn `candidate` strikt neuer als `current` ist. Bei Gleichstand in
 * der Versions-Notation entscheidet `created_at` (ISO-Timestamp) — neuer
 * Import gilt als neuer.
 */
export function isStrictlyNewer(
  candidate: { version: string; created_at: string },
  current: { version: string; created_at: string },
): boolean {
  const cmp = compareVersions(candidate.version, current.version);
  if (cmp !== 0) return cmp > 0;
  return Date.parse(candidate.created_at) > Date.parse(current.created_at);
}
