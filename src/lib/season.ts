export const SEASON_YEAR = 2026;
/** First calendar day we scan for matches (US Eastern). */
export const SEASON_START = "2026-08-21";
/** Championship match date. */
export const SEASON_END = "2026-12-20";
export const FEATURED_TEAM = process.env.FEATURED_TEAM ?? "stanford";

export const MILESTONES: { date: string; label: string }[] = [
  { date: "2026-11-29", label: "Selection show" },
  { date: "2026-12-03", label: "First round begins" },
  { date: "2026-12-10", label: "Regionals begin" },
  { date: "2026-12-17", label: "National semifinals, San Antonio" },
  { date: "2026-12-20", label: "National championship, San Antonio" },
];

const ET = "America/New_York";

/** YYYY-MM-DD for an instant, in US Eastern time (how ncaa.com dates its scoreboard). */
export function easternDate(d: Date): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: ET,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}`;
}

export function todayEastern(): string {
  return easternDate(new Date());
}

export function addDays(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + n));
  return dt.toISOString().slice(0, 10);
}

export function* dateRange(from: string, to: string): Generator<string> {
  for (let d = from; d <= to; d = addDays(d, 1)) yield d;
}

export function isValidYmd(s: string | undefined): s is string {
  return !!s && /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));
}
