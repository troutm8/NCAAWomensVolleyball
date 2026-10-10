/** Name normalization used to link team names across ncaa.com and ESPN. */

const REPLACEMENTS: [RegExp, string][] = [
  [/\(.*?\)/g, " "],
  [/&/g, " and "],
  [/\bst\.?\b/g, "state"],
  [/\buniv(ersity)?\b/g, " "],
  [/\bof\b/g, " "],
  [/\bthe\b/g, " "],
  [/\bcal\b/g, "california"],
  [/\bso\.?\b/g, "southern"],
  [/\bno\.?\b/g, "northern"],
  [/\bn\.?\b/g, "north"],
  [/\bs\.?\b/g, "south"],
  [/\be\.?\b/g, "east"],
  [/\bw\.?\b/g, "west"],
  [/\bfla\.?\b/g, "florida"],
  [/\bark\.?\b/g, "arkansas"],
  [/\bmiss\.?\b/g, "mississippi"],
  [/\bval\.?\b/g, "valley"],
  [/\bcaro\.?\b/g, "carolina"],
  [/\bwash\.?\b/g, "washington"],
  [/\btenn\.?\b/g, "tennessee"],
  [/\bky\.?\b/g, "kentucky"],
  [/\bga\.?\b/g, "georgia"],
  [/\bla\.?\b/g, "louisiana"],
  [/\bintl\.?\b/g, "international"],
  [/\bchristian\b/g, "christian"],
  [/\bam\b/g, "a and m"],
  [/\ba&m\b/g, "a and m"],
  [/[^a-z0-9 ]+/g, " "],
  [/\s+/g, " "],
];

export function normalizeName(name: string): string {
  let s = name.toLowerCase().trim();
  for (const [re, rep] of REPLACEMENTS) s = s.replace(re, rep);
  return s.trim();
}

export function tokens(name: string): Set<string> {
  return new Set(normalizeName(name).split(" ").filter(Boolean));
}

/** Jaccard-style overlap between two names' tokens. */
export function tokenOverlap(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (!ta.size || !tb.size) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  return inter / Math.max(ta.size, tb.size);
}

/** Strip the first-place-vote suffix from poll names like "Nebraska (47)". */
export function stripVotes(name: string): { name: string; votes: number | null } {
  const m = name.match(/^(.*?)\s*\((\d+)\)\s*$/);
  if (!m) return { name: name.trim(), votes: null };
  return { name: m[1].trim(), votes: Number(m[2]) };
}

export function parseIntOrNull(s: string | undefined | null): number | null {
  if (s == null) return null;
  const t = s.trim();
  if (t === "" || t === "-") return null;
  const n = Number.parseInt(t, 10);
  return Number.isFinite(n) ? n : null;
}

export function parseNumOrNull(s: string | undefined | null): number | null {
  if (s == null) return null;
  const t = s.trim();
  if (t === "" || t === "-") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}
