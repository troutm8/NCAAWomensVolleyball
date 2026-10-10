import Link from "next/link";
import type { MatchView } from "@/lib/views";
import { fmtTime } from "@/lib/format";
import { TeamName } from "./TeamName";

export function StatusText({ m }: { m: MatchView }) {
  if (m.state === "final") return <span className="text-xs font-semibold text-muted">Final{m.setScores && m.setScores.length === 5 ? " / 5" : ""}</span>;
  if (m.state === "live") return <span className="text-xs font-semibold text-live">{m.period ?? "Live"}</span>;
  return <span className="text-xs text-muted">{fmtTime(m.startTime)}</span>;
}

/** Set-by-set scores, listed away-home to match the row order. */
export function SetScores({ m }: { m: MatchView }) {
  if (!m.setScores?.length) return null;
  return (
    <span className="text-[11px] text-muted tabular">
      {m.setScores.map((s, i) => (
        <span key={i} className={`mr-2 ${s.away === s.home ? "" : ""}`}>
          {s.away}-{s.home}
        </span>
      ))}
    </span>
  );
}

/** One match as a compact block: away team on top, home on the bottom, set scores underneath. */
export function MatchRow({ m, featured, showDate = false }: { m: MatchView; featured?: string; showDate?: boolean }) {
  const homeWon = m.state === "final" && (m.homeSets ?? 0) > (m.awaySets ?? 0);
  const awayWon = m.state === "final" && (m.awaySets ?? 0) > (m.homeSets ?? 0);
  const isFeatured = (slug: string) => !!featured && slug === featured;
  return (
    <div className="border-b border-line py-2 last:border-b-0">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <TeamName team={m.away} rank={m.awayRank} bold={awayWon} featured={isFeatured(m.away.slug)} />
            <span className={`w-6 text-right text-sm tabular ${awayWon ? "font-bold" : "text-muted"}`}>{m.awaySets ?? ""}</span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <TeamName team={m.home} rank={m.homeRank} bold={homeWon} featured={isFeatured(m.home.slug)} />
            <span className={`w-6 text-right text-sm tabular ${homeWon ? "font-bold" : "text-muted"}`}>{m.homeSets ?? ""}</span>
          </div>
        </div>
        <div className="w-28 shrink-0 text-right sm:w-36">
          <Link href={`/matches/${m.id}`} className="block hover:underline">
            <StatusText m={m} />
          </Link>
          {showDate && <div className="text-xs text-muted">{m.gameDate}</div>}
          <div className="truncate text-[11px] text-muted">
            {m.neutral ? "Neutral" : "at " + m.home.abbr}
            {m.broadcast ? ` · ${m.broadcast}` : ""}
          </div>
        </div>
      </div>
      {m.setScores && m.setScores.length > 0 && (
        <div className="mt-0.5 pl-8">
          <SetScores m={m} />
        </div>
      )}
    </div>
  );
}
