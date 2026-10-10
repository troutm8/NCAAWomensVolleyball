import Link from "next/link";
import { Card, Empty } from "@/components/Card";
import { LiveScoreboard } from "@/components/LiveScoreboard";
import { fmtYmdLong } from "@/lib/format";
import { confName, getMatchesByDate } from "@/lib/queries";
import { FEATURED_TEAM, addDays, isValidYmd, todayEastern } from "@/lib/season";
import { matchView, sortForFeatured } from "@/lib/views";

export const metadata = { title: "Scores" };

export default async function ScoresPage({ searchParams }: { searchParams: Promise<{ date?: string; conf?: string; ranked?: string }> }) {
  const sp = await searchParams;
  const today = todayEastern();
  const date = isValidYmd(sp.date) ? sp.date : today;
  const all = (await getMatchesByDate(date)).map(matchView);
  const confs = [...new Set(all.flatMap((m) => [m.home.conf, m.away.conf]).filter((c): c is string => !!c))].sort();
  let shown = all;
  if (sp.conf) shown = shown.filter((m) => m.home.conf === sp.conf || m.away.conf === sp.conf);
  if (sp.ranked) shown = shown.filter((m) => (m.homeRank && m.homeRank <= 25) || (m.awayRank && m.awayRank <= 25));
  shown = sortForFeatured(shown, FEATURED_TEAM);
  const qs = (d: string) => `/scores?date=${d}${sp.conf ? `&conf=${sp.conf}` : ""}${sp.ranked ? "&ranked=1" : ""}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <Link href={qs(addDays(date, -1))} className="rounded-md border border-line px-3 py-1 text-sm hover:bg-soft">
          ← Prev
        </Link>
        <h1 className="text-xl font-bold">{fmtYmdLong(date)}</h1>
        <Link href={qs(addDays(date, 1))} className="rounded-md border border-line px-3 py-1 text-sm hover:bg-soft">
          Next →
        </Link>
        {date !== today && (
          <Link href={qs(today)} className="text-sm text-muted hover:underline">
            Today
          </Link>
        )}
        <form className="ml-auto flex items-center gap-2 text-sm" action="/scores">
          <input type="date" name="date" defaultValue={date} className="rounded-md border border-line bg-card px-2 py-1" />
          <select name="conf" defaultValue={sp.conf ?? ""} className="rounded-md border border-line bg-card px-2 py-1">
            <option value="">All conferences</option>
            {confs.map((c) => (
              <option key={c} value={c}>
                {confName(c)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-1">
            <input type="checkbox" name="ranked" value="1" defaultChecked={!!sp.ranked} /> Ranked only
          </label>
          <button className="rounded-md bg-cardinal px-3 py-1 text-white">Go</button>
        </form>
      </div>
      <Card>
        {shown.length ? <LiveScoreboard matches={shown} date={date} featured={FEATURED_TEAM} /> : <Empty>No matches{sp.conf || sp.ranked ? " match the filters" : ""} on this day.</Empty>}
        <p className="pt-2 text-xs text-muted">{shown.length} of {all.length} matches shown.</p>
      </Card>
    </div>
  );
}
