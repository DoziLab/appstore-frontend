// GitHub-URL-Parser, der die im Backend (`github_import_service.parse_github_url`)
// akzeptierten URL-Formen lokal nachzieht. Das brauchen wir, wenn wir die im
// Template gespeicherte `repo_url` zerlegen wollen, ohne einen Roundtrip ans
// Backend zu machen — z.B. für den Remote-Versionen-Check, der gegen
// `api.github.com` läuft.
//
// Akzeptierte Formen:
//   https://github.com/{owner}/{repo}
//   https://github.com/{owner}/{repo}/tree/{ref}[/{path}]
//   https://github.com/{owner}/{repo}/blob/{ref}/{path}
//
// `.git`-Suffix wird abgeschnitten. Alles andere ist ein Fehler — bewusst
// strikt, damit wir nicht raten.

export type ParsedGithubUrl = {
  owner: string;
  repo: string;
  ref: string | null;
  /** Pfad-Suffix von `/tree/<ref>/<…>` oder `/blob/<ref>/<…>`, ohne führenden Slash. */
  path: string | null;
};

export function parseGithubUrl(url: string): ParsedGithubUrl {
  if (!url || typeof url !== "string") {
    throw new Error("github_url is required");
  }

  let parsed: URL;
  try {
    parsed = new URL(url.trim());
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  if (parsed.host !== "github.com" && parsed.host !== "www.github.com") {
    throw new Error(
      `Only github.com URLs are supported (got '${parsed.host || url}')`,
    );
  }

  const segments = parsed.pathname.split("/").filter(Boolean);
  if (segments.length < 2) {
    throw new Error(
      "GitHub URL must contain at least owner and repo: https://github.com/<owner>/<repo>",
    );
  }

  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/, "");
  let ref: string | null = null;
  let path: string | null = null;

  if (segments.length >= 4 && (segments[2] === "tree" || segments[2] === "blob")) {
    ref = decodeURIComponent(segments[3]);
    if (segments.length > 4) {
      path = segments.slice(4).map(decodeURIComponent).join("/");
    }
  } else if (segments.length > 2) {
    throw new Error(
      "Unsupported GitHub URL shape. Use repo root, .../tree/<ref>, or .../blob/<ref>/<path>.",
    );
  }

  return { owner, repo, ref, path };
}

/** Baut wieder eine `https://github.com/...`-URL aus den Bestandteilen
 *  zusammen. Für den Aufruf von `POST /templates/{id}/import-from-github`
 *  brauchen wir genau dieses Format — das Backend parst es identisch
 *  zurück.
 */
export function buildGithubUrl(parts: {
  owner: string;
  repo: string;
  ref?: string | null;
  path?: string | null;
}): string {
  const base = `https://github.com/${parts.owner}/${parts.repo}`;
  if (!parts.ref) return base;
  const refSeg = `tree/${encodeURIComponent(parts.ref)}`;
  if (!parts.path) return `${base}/${refSeg}`;
  const pathSeg = parts.path
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  return `${base}/${refSeg}/${pathSeg}`;
}
