// Remote-Versionen-Check gegen die öffentliche GitHub-API. Wir fragen ohne
// Auth-Token, weil das Installation-Token im Backend liegt — funktioniert
// daher nur für öffentliche Repos. Für private Repos liefert die API 404
// (oder 200 ohne sinnvolle Daten); das fangen wir explizit ab.
//
// Was wir prüfen:
//   1. /repos/{owner}/{repo}/tags        → letzte N Tags (Releases & v-Tags)
//   2. /repos/{owner}/{repo}/commits/{ref}  → aktueller HEAD-Commit
//                                              auf dem im Template gespeicherten
//                                              Branch (oder default_branch)
//
// Aus den Treffern entfernen wir alles, dessen Commit-SHA bereits in der
// Versionsliste des Templates vorhanden ist — dann bleibt das übrig, was
// neu importiert werden könnte. Die Reihenfolge ist „Tags zuerst, HEAD
// danach", weil Tags die semantisch sauberere Quelle für „neue Version"
// sind.
//
// Rate-Limit: anonyme Calls sind auf 60 req/h pro IP limitiert. Pro Klick
// fragen wir maximal 3 Endpoints ab; das reicht für realistische Nutzung
// problemlos.

import { parseGithubUrl, type ParsedGithubUrl } from "./github-url";

const GITHUB_API = "https://api.github.com";

export type RemoteCandidate = {
  /** Anzeigename: Tag-Name (`v1.2.0`) oder „HEAD auf main". */
  label: string;
  /** Vollständiger Commit-SHA — wird zum Vergleich mit DB benutzt. */
  commit_sha: string;
  /** Kategorie für UI-Badges. */
  kind: "tag" | "head";
  /** Optional: Datum des Commits (ISO). */
  committed_at: string | null;
  /** Ref, den wir später ans Backend zur Import-URL durchreichen — bei
   *  Tags der Tag-Name, beim HEAD entweder der Branch oder, wenn wir
   *  Branch-Naming-Konflikte vermeiden wollen, der volle SHA. */
  ref_for_import: string;
};

export type RemoteCheckResult = {
  parsed: ParsedGithubUrl;
  /** Ref, gegen den wir tatsächlich abgefragt haben (Branch-Name nach
   *  Auflösung von `default_branch`). Wird im UI angezeigt. */
  resolved_ref: string | null;
  candidates: RemoteCandidate[];
};

export class RemoteCheckError extends Error {
  constructor(
    message: string,
    public readonly kind:
      | "not_found"     // Repo existiert nicht oder ist privat
      | "rate_limited"  // 403 mit X-RateLimit-Remaining: 0
      | "network"
      | "parse"
      | "unknown",
  ) {
    super(message);
  }
}

async function ghFetch(path: string): Promise<Response> {
  let resp: Response;
  try {
    resp = await fetch(`${GITHUB_API}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
      },
    });
  } catch (err) {
    throw new RemoteCheckError(
      `Network error talking to GitHub: ${err instanceof Error ? err.message : err}`,
      "network",
    );
  }

  if (resp.status === 404) {
    throw new RemoteCheckError(
      "Repository not found or private (anonymous access only).",
      "not_found",
    );
  }
  if (resp.status === 403) {
    const remaining = resp.headers.get("x-ratelimit-remaining");
    if (remaining === "0") {
      throw new RemoteCheckError(
        "GitHub API rate limit reached (60 requests / hour for anonymous calls).",
        "rate_limited",
      );
    }
  }
  if (!resp.ok) {
    throw new RemoteCheckError(
      `GitHub returned HTTP ${resp.status}`,
      "unknown",
    );
  }
  return resp;
}

/** Holt das Repo-Meta (für `default_branch`). */
async function fetchRepoMeta(owner: string, repo: string): Promise<{
  default_branch: string;
}> {
  const resp = await ghFetch(`/repos/${owner}/${repo}`);
  return resp.json();
}

async function fetchTags(
  owner: string,
  repo: string,
): Promise<Array<{ name: string; commit: { sha: string; url: string } }>> {
  // Wir nehmen die ersten 30 — das deckt für die typischen Lecturer-Repos
  // alles ab und hält den Payload klein.
  const resp = await ghFetch(`/repos/${owner}/${repo}/tags?per_page=30`);
  return resp.json();
}

async function fetchCommit(
  owner: string,
  repo: string,
  ref: string,
): Promise<{ sha: string; commit: { author: { date: string } | null } }> {
  const resp = await ghFetch(
    `/repos/${owner}/${repo}/commits/${encodeURIComponent(ref)}`,
  );
  return resp.json();
}

/**
 * Holt Tags + HEAD-Commit für das per `repoUrl` referenzierte Repo und
 * gibt alle zurück, deren Commit-SHA noch NICHT in `existingCommitShas`
 * vorkommt.
 *
 * @param repoUrl    Wert aus `template.repo_url` (das hat das Backend beim
 *                   Erst-Import gespeichert).
 * @param existingCommitShas Set aller bereits importierten SHAs.
 */
export async function fetchRemoteCandidates(
  repoUrl: string,
  existingCommitShas: Set<string>,
): Promise<RemoteCheckResult> {
  let parsed: ParsedGithubUrl;
  try {
    parsed = parseGithubUrl(repoUrl);
  } catch (err) {
    throw new RemoteCheckError(
      err instanceof Error ? err.message : "Invalid GitHub URL",
      "parse",
    );
  }

  const { owner, repo, ref } = parsed;

  // Default-Branch nur dann auflösen, wenn der Repo-URL-String selbst keinen
  // Ref hat — sonst sparen wir uns den Roundtrip.
  let resolvedRef = ref;
  if (!resolvedRef) {
    const meta = await fetchRepoMeta(owner, repo);
    resolvedRef = meta.default_branch;
  }

  // Tags und HEAD parallel holen — sind unabhängig voneinander.
  const [tagsResult, headResult] = await Promise.allSettled([
    fetchTags(owner, repo),
    fetchCommit(owner, repo, resolvedRef),
  ]);

  const seen = new Set<string>();
  const candidates: RemoteCandidate[] = [];

  if (tagsResult.status === "fulfilled") {
    for (const tag of tagsResult.value) {
      const sha = tag.commit?.sha;
      if (!sha) continue;
      if (existingCommitShas.has(sha)) continue;
      if (seen.has(sha)) continue;
      seen.add(sha);
      candidates.push({
        label: tag.name,
        commit_sha: sha,
        kind: "tag",
        committed_at: null,
        ref_for_import: tag.name,
      });
    }
  }

  if (headResult.status === "fulfilled") {
    const head = headResult.value;
    if (head.sha && !existingCommitShas.has(head.sha) && !seen.has(head.sha)) {
      seen.add(head.sha);
      candidates.push({
        label: `HEAD auf ${resolvedRef}`,
        commit_sha: head.sha,
        kind: "head",
        committed_at: head.commit?.author?.date ?? null,
        // HEAD darf nicht über den Branch-Namen reingeholt werden — dann
        // hätte das Backend keinen stabilen Anker und ein späterer Klick
        // würde wieder denselben Commit ziehen. Stattdessen pinnen wir auf
        // den SHA.
        ref_for_import: head.sha,
      });
    }
  }

  // Wenn beide gescheitert sind und es war 404, dann ist das Repo
  // wahrscheinlich privat — eskalieren.
  if (
    tagsResult.status === "rejected" &&
    headResult.status === "rejected"
  ) {
    const err =
      tagsResult.reason instanceof RemoteCheckError
        ? tagsResult.reason
        : headResult.reason instanceof RemoteCheckError
          ? headResult.reason
          : new RemoteCheckError("Both tags and HEAD failed", "unknown");
    throw err;
  }

  return {
    parsed: { ...parsed, ref: resolvedRef },
    resolved_ref: resolvedRef,
    candidates,
  };
}
