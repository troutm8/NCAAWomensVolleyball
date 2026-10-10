import Link from "next/link";
import { Card, Empty } from "@/components/Card";
import { LiveScoreboard } from "@/components/LiveScoreboard";
import { MatchRow } from "@/components/MatchRow";
import { TeamLogo } from "@/components/TeamLogo";
import { TeamName } from "@/components/TeamName";
import { fmtDateTime, fmtYmd, daysUntil } from "@/lib/format";
import {
  computeRecord,
  confName,
  getFeaturedTeam,
  getLatestRanking,
  getMatch,
  getMatchesByDate,
  getTeamCurrentRanks,
  getTeamMatches,
} from "@/lib/queries";
import { FEATURED_TEAM, MILESTONES, todayEastern } from "@/lib/season";
import { matchView, sortForFeatured, teamView } from "@/lib/views";

export default async function HomePage() {
  const today = todayEastern();
  const featured = await getFeaturedTeam();
  if (!featured) {
    return (
      <Empty>
        No data yet. Run <code>pnpm ingest backfill</code> to load the season.
      </Empty>
    );
  }
  const [teamMatches, ranks, todays, avca, rpi] = await Promise.all([
    getTeamMatches(FEATURED_TEAM),
    getTeamCurrentRanks(FEATURED_TEAM),
    getMatchesByDate(today),
    getLatestRanking("avca"),
    getLatestRanking("rpi"),
  ]);
  const record = computeRecord(FEATURED_TEAM, teamMatches);
  const finals = teamMatches.filter((m) => m.state === "final");
  const lastMatch = finals[finals.length - 1] ?? null;
  const liveMatch = teamMatches.find((m) => m.state === "live") ?? null;
  const nextMatch = teamMatches.find((m) => m.state === "pre" && m.gameDate >= today) ?? null;
  const lastDetail = lastMatch ? await getMatch(lastMatch.id) : null;
  const tv = teamView(featured);
  const todayViews = sortForFeatured(todays.map(matchView), FEATURED_TEAM);
  const upcoming = teamMatches.filter((m) => m.state === "pre" && m.gameDate >= today).slice(0, 5);
  const avcaRank = ranks.avca?.rank;

  const topPerformers = lastDetail
    ? lastDetail.players
        .filter((p) => p.teamSlug === FEATURED_TEAM)
        .sort((a, b) => Number(b.points ?? 0) - Number(a.points ?? 0))
        .slice(0, 3)
    : [];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="flex flex-wrap items-center gap-5 rounded-xl border border-line bg-card p-5 shadow-sm">
        <TeamLogo team={tv} size={72} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">
            {avcaRank && avcaRank <= 25 && <span className="mr-2 text-muted">#{avcaRank}</span>}
            {featured.shortName} {featured.nickname}
          </h1>
          <p className="text-sm text-muted">
            {confName(featured.conferenceSlug, featured.conferenceName)} · {record.wins}-{record.losses} overall · {record.confWins}-{record.confLosses} conference · streak{" "}
            {record.streak}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-4 text-center sm:grid-cols-5">
          <Stat label="AVCA" value={ranks.avca ? `#${ranks.avca.rank}` : "NR"} />
          <Stat label="RPI" value={ranks.rpi ? `#${ranks.rpi.rank}` : "—"} />
          <Stat label="vs Top 25" value={`${record.vsRanked[0]}-${record.vsRanked[1]}`} />
          <Stat label="Home" value={`${record.home[0]}-${record.home[1]}`} />
          <Stat label="Away" value={`${record.away[0]}-${record.away[1]}`} />
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Next / live match */}
        <Card title={liveMatch ? "Live now" : "Next match"}>
          {liveMatch || nextMatch ? (
            <FeaturedMatch m={matchView(liveMatch ?? nextMatch!)} today={today} />
          ) : (
            <Empty>No upcoming match scheduled.</Empty>
          )}
          {upcoming.length > 1 && (
            <ul className="mt-3 space-y-1 border-t border-line pt-3 text-sm">
              {upcoming.slice(1).map((m) => {
                const opp = m.homeSlug === FEATURED_TEAM ? m.away : m.home;
                const oppRank = m.homeSlug === FEATURED_TEAM ? m.awayRank : m.homeRank;
                return (
                  <li key={m.id} className="flex items-center justify-between gap-2">
                    <span className="text-muted">{fmtYmd(m.gameDate)}</span>
                    <TeamName team={teamView(opp)} rank={oppRank} size={18} />
                    <span className="text-xs text-muted">{m.homeSlug === FEATURED_TEAM ? "Home" : m.neutral ? "Neutral" : "Away"}</span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        {/* Last result */}
        <Card title="Last result" action={lastMatch && <Link href={`/matches/${lastMatch.id}`} className="text-xs hover:underline">Box score →</Link>}>
          {lastMatch ? (
            <>
              <MatchRow m={matchView(lastMatch)} featured={FEATURED_TEAM} />
              {topPerformers.length > 0 && (
                <ul className="mt-3 space-y-1 text-sm">
                  {topPerformers.map((p) => (
                    <li key={p.id} className="flex justify-between">
                      <span>
                        {p.firstName} {p.lastName} <span className="text-muted">{p.position}</span>
                      </span>
                      <span className="text-muted tabular">
                        {p.kills ?? 0} K · {p.digs ?? 0} D · {Number(p.totalBlocks ?? 0)} B · {p.assists ?? 0} A
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <Empty>No results yet.</Empty>
          )}
        </Card>

        {/* Milestones */}
        <Card title="Season milestones">
          <ul className="space-y-2 text-sm">
            {MILESTONES.filter((ms) => ms.date >= today).map((ms) => {
              const d = daysUntil(ms.date, today);
              return (
                <li key={ms.date} className="flex items-baseline justify-between gap-2">
                  <span>{ms.label}</span>
                  <span className="shrink-0 text-muted">
                    {fmtYmd(ms.date, { month: "short", day: "numeric" })} · {d === 0 ? "today" : `${d}d`}
                  </span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>

      {/* Today's scoreboard */}
      <Card title={`Today · ${fmtYmd(today, { weekday: "long", month: "long", day: "numeric" })}`} action={<Link href={`/scores?date=${today}`} className="text-xs hover:underline">All scores →</Link>}>
        {todayViews.length ? <LiveScoreboard matches={todayViews.slice(0, 12)} date={today} featured={FEATURED_TEAM} /> : <Empty>No matches today.</Empty>}
        {todayViews.length > 12 && (
          <p className="pt-2 text-right text-xs">
            <Link href={`/scores?date=${today}`} className="hover:underline">
              {todayViews.length - 12} more matches today →
            </Link>
          </p>
        )}
      </Card>

      {/* Polls */}
      <div className="grid gap-6 md:grid-cols-2">
        <RankList title="AVCA Coaches Poll" poll="avca" data={avca} featured={FEATURED_TEAM} />
        <RankList title="NCAA RPI" poll="rpi" data={rpi} featured={FEATURED_TEAM} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular">{value}</dd>
    </div>
  );
}

function FeaturedMatch({ m, today }: { m: ReturnType<typeof matchView>; today: string }) {
  const isHome = m.home.slug === FEATURED_TEAM;
  const opp = isHome ? m.away : m.home;
  const oppRank = isHome ? m.awayRank : m.homeRank;
  const d = daysUntil(m.gameDate, today);
  return (
    <div>
      <div className="flex items-center gap-3">
        <TeamLogo team={opp} size={44} />
        <div>
          <div className="text-xs uppercase tracking-wide text-muted">{m.neutral ? "vs" : isHome ? "vs" : "at"}</div>
          <TeamName team={opp} rank={oppRank} bold size={0} />
        </div>
      </div>
      <p className="mt-2 text-sm">{m.state === "live" ? <span className="font-semibold text-live">{m.period ?? "In progress"}</span> : fmtDateTime(m.startTime)}</p>
      <p className="text-xs text-muted">
        {d === 0 ? "Today" : d === 1 ? "Tomorrow" : `In ${d} days`}
        {m.venue ? ` · ${m.venue}` : ""}
        {m.broadcast ? ` · ${m.broadcast}` : ""}
        {m.conferenceMatch ? " · Conference" : ""}
      </p>
      {m.state === "live" && (
        <p className="mt-1 text-lg font-bold tabular">
          {m.away.abbr} {m.awaySets ?? 0} – {m.homeSets ?? 0} {m.home.abbr}
        </p>
      )}
    </div>
  );
}

function RankList({
  title,
  poll,
  data,
  featured,
}: {
  title: string;
  poll: "avca" | "rpi";
  data: Awaited<ReturnType<typeof getLatestRanking>>;
  featured: string;
}) {
  if (!data) return <Card title={title}><Empty>Not loaded yet.</Empty></Card>;
  const top = data.rows.slice(0, 10);
  const mine = data.rows.find((r) => r.teamSlug === featured);
  const rows = mine && mine.rank > 10 ? [...top, mine] : top;
  return (
    <Card title={title} action={<Link href={`/rankings?poll=${poll}`} className="text-xs hover:underline">Full table →</Link>}>
      <p className="mb-2 text-xs text-muted">{data.asOf}</p>
      <table className="data w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.rank} className={r.teamSlug === featured ? "bg-soft font-semibold" : ""}>
              <td className="r w-8 tabular">{r.rank}</td>
              <td>{r.team ? <TeamName team={teamView(r.team)} size={20} /> : r.teamName}</td>
              <td className="r text-muted tabular">{r.record}</td>
              <td className="r text-muted tabular">
                {r.prevRank != null && r.prevRank !== r.rank ? (r.prevRank > r.rank ? <span className="text-win">▲{r.prevRank - r.rank}</span> : <span className="text-loss">▼{r.rank - r.prevRank}</span>) : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
