export const DISPLAY_TZ = process.env.NEXT_PUBLIC_DISPLAY_TZ ?? "America/Los_Angeles";

export function fmtTime(d: Date | string | null | undefined, tz = DISPLAY_TZ): string {
  if (!d) return "TBA";
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit", timeZoneName: "short" }).format(dt);
}

export function fmtDateTime(d: Date | string | null | undefined, tz = DISPLAY_TZ): string {
  if (!d) return "TBA";
  const dt = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  }).format(dt);
}

/** Format a YYYY-MM-DD calendar date without time-zone shifting. */
export function fmtYmd(ymd: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", month: "short", day: "numeric" }): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Intl.DateTimeFormat("en-US", { timeZone: "UTC", ...opts }).format(new Date(Date.UTC(y, m - 1, d)));
}

export function fmtYmdLong(ymd: string): string {
  return fmtYmd(ymd, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

export function pct(n: number | string | null | undefined, digits = 3): string {
  if (n == null || n === "") return "—";
  const v = Number(n);
  if (!Number.isFinite(v)) return "—";
  const s = v.toFixed(digits);
  return v < 0 ? `-${s.slice(2)}` : s.replace(/^0/, "");
}

export function num(n: number | string | null | undefined, digits = 2): string {
  if (n == null || n === "") return "—";
  const v = Number(n);
  return Number.isFinite(v) ? v.toFixed(digits) : "—";
}

export function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function daysUntil(ymd: string, today: string): number {
  return Math.round((Date.parse(ymd) - Date.parse(today)) / 86_400_000);
}
