import Link from "next/link";
import { notFound } from "next/navigation";
import { Card, Empty } from "@/components/Card";
import { MatchRow } from "@/components/MatchRow";
import { RankSparkline } from "@/components/Sparkline";
import { TeamLogo } from "@/components/TeamLogo";
import { TeamName } from "@/components/TeamName";
import { fmtYmd, num, pct } from "@/lib/format";
import {
  computeRecord,
  confName,
  getTeam,
  getTeamCurrentRanks,
  getTeamMatches,
  getTeamPlayerSeason,
  getTeamRankHistory,
  getTeamSeasonStats,
  getTeamStatLeaderRows,
} from "@/lib/queries";
import { getTeamResume } from "@/lib/bracketology";
import { FEATURED_TEAM, todayEastern } from "@/lib/season";
import { matchView, teamView } from "@/lib/views";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const t = await getTeam((await params).slug);
  return { title: t ? t.shortName : "Team" };
}

export default async function TeamPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const team = await getTeam(slug);
  if (!team) notFound();
  const today = todayEastern();
  const [ms, ranks, avcaHist, rpiHist, season, players, leaders, resume] = await Promise.all([
    getTeamMatches(slug),
    getTeamCurrentRanks(slug),
    getTeamRankHistory(slug, "avca"),
    getTeamRankHistory(slug, "rpi"),
    getTeamSeasonStats(slug),
    getTeamPlayerSeason(slug),
    getTeamStatLeaderRows(slug),
    getTeamResume(slug),
  ]);
  const record = computeRecord(slug, ms);
  const tv = teamView(team);
  const results = ms.filter((m) => m.state !== "pre" || m.gameDate < today);
  const upcoming = ms.filter((m) => m.state === "pre" && m.gameDate >= today);
  const sets = season?.sets || 0;
  const perSet = (n: number) => (sets ? num(n / sets) : "—");

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-5 rounded-xl border border-line bg-card p-5 shadow-sm">
        <TeamLogo team={tv} size={64} />
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold">
            {ranks.avca && <span className="mr-2 text-muted">#{ranks.avca.rank}</span>}
            {team.shortName} {team.nickname}
          </h1>
          <p className="text-sm text-muted">
            {confName(team.conferenceSlug, team.conferenceName)} · {record.wins}-{record.losses} ({record.confWins}-{record.confLosses}) · home {record.home.join("-")} · away {record.away.join("-")} · neutral{" "}
            {record.neutral.join("-")} · vs top 25 {record.vsRanked.join("-")} · sets {record.setsWon}-{record.setsLost}
          </p>
        </div>
        <dl className="grid grid-cols-3 gap-4 text-center">
          <Stat label="AVCA" value={ranks.avca ? `#${ranks.avca.rank}` : "NR"} />
          <Stat label="RPI" value={ranks.rpi ? `#${ranks.rpi.rank}` : "—"} />
          <Stat label="Streak" value={record.streak} />
        </dl>
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card title="Rank history" className="lg:col-span-1">
          {avcaHist.length < 2 && rpiHist.length < 2 ? (
            <Empty>History builds up as weekly polls are collected.</Empty>
          ) : (
            <div className="space-y-3 text-sm">
              {avcaHist.length >= 2 && (
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>AVCA</span>
                    <span>
                      {avcaHist[0].rank} → {avcaHist[avcaHist.length - 1].rank}
                    </span>
                  </div>
                  <div className="text-cardinal dark:text-red-300">
                    <RankSparkline ranks={avcaHist.map((h) => h.rank)} width={280} />
                  </div>
                </div>
              )}
              {rpiHist.length >= 2 && (
                <div>
                  <div className="mb-1 flex justify-between text-xs text-muted">
                    <span>RPI</span>
                    <span>
                      {rpiHist[0].rank} → {rpiHist[rpiHist.length - 1].rank}
                    </span>
                  </div>
                  <div className="text-muted">
                    <RankSparkline ranks={rpiHist.map((h) => h.rank)} width={280} max={50} />
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card title="Season stats" className="lg:col-span-2">
          {!season ? (
            <Empty>Box scores not loaded yet for this team.</Empty>
          ) : (
            <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
              <Stat label="Hitting %" value={pct((season.kills - season.attackErrors) / Math.max(1, season.attackAttempts))} />
              <Stat label="Opp hitting %" value={pct((season.oppKills - season.oppErrors) / Math.max(1, season.oppAttempts))} />
              <Stat label="Kills / set" value={perSet(season.kills)} />
              <Stat label="Blocks / set" value={perSet(season.blocks)} />
              <Stat label="Digs / set" value={perSet(season.digs)} />
              <Stat label="Aces / set" value={perSet(season.aces)} />
              <p className="col-span-3 text-xs text-muted sm:col-span-6">
                From {season.matches} box scores, {season.sets} sets.
              </p>
            </div>
          )}
        </Card>
      </div>

      {resume && resume.record.wins + resume.record.losses > 0 && (
        <Card
          title="Tournament resume"
          action={
            <Link href="/bracket" className="text-xs text-muted underline">
              Bracketology
            </Link>
          }
        >
          <div className="grid grid-cols-3 gap-3 text-center sm:grid-cols-6">
            <Stat label="vs RPI top 25" value={resume.quality.top25.join("-")} />
            <Stat label="vs RPI top 50" value={resume.quality.top50.join("-")} />
            <Stat label="vs RPI top 100" value={resume.quality.top100.join("-")} />
            <Stat label="Road + neutral" value={resume.roadNeutral.join("-")} />
            <Stat label="Losses outside 100" value={String(resume.badLosses)} />
            <Stat label="Resume score" value={num(resume.score, 1)} />
            <p className="col-span-3 text-xs text-muted sm:col-span-6">
              Opponent quality by current RPI. The score is the 100-point projection weight used on the bracket page.
            </p>
          </div>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Schedule and results">
          {results.length === 0 && upcoming.length === 0 ? (
            <Empty>No matches found.</Empty>
          ) : (
            <div>
              {[...results, ...upcoming].map((m) => (
                <div key={m.id} className="flex items-center gap-3">
                  <span className="w-16 shrink-0 text-xs text-muted">{fmtYmd(m.gameDate, { month: "short", day: "numeric" })}</span>
                  <div className="min-w-0 flex-1">
                    <MatchRow m={matchView(m)} featured={slug} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <div className="space-y-6">
          <Card title="Players">
            {players.length === 0 ? (
              <Empty>Player stats appear once box scores are loaded.</Empty>
            ) : (
              <div className="overflow-x-auto">
                <table className="data w-full text-sm">
                  <thead>
                    <tr>
                      <th>Player</th>
                      <th className="r">S</th>
                      <th className="r">K/S</th>
                      <th className="r">Hit%</th>
                      <th className="r">A/S</th>
                      <th className="r">D/S</th>
                      <th className="r">B/S</th>
                      <th className="r">Aces</th>
                      <th className="r">Pts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {players
                      .filter((p) => p.sets > 0)
                      .map((p) => (
                        <tr key={p.name}>
                          <td>
                            <span className="mr-1 text-muted tabular">{p.number ?? ""}</span>
                            {p.name} <span className="text-muted">{p.position}</span>
                          </td>
                          <td className="r tabular">{p.sets}</td>
                          <td className="r tabular">{num(p.kills / p.sets)}</td>
                          <td className="r tabular">{p.attempts ? pct((p.kills - p.errors) / p.attempts) : "—"}</td>
                          <td className="r tabular">{num(p.assists / p.sets)}</td>
                          <td className="r tabular">{num(p.digs / p.sets)}</td>
                          <td className="r tabular">{num(p.blocks / p.sets)}</td>
                          <td className="r tabular">{p.aces}</td>
                          <td className="r tabular">{num(p.points, 1)}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {leaders.length > 0 && (
            <Card title="National leaderboards">
              <ul className="space-y-1 text-sm">
                {leaders.map((l) => (
                  <li key={l.id} className="flex justify-between gap-2">
                    <span>
                      {l.scope === "individual" ? `${l.playerName} · ` : ""}
                      <Link href={`/stats?scope=${l.scope}&stat=${l.statId}`} className="hover:underline">
                        {l.category}
                      </Link>
                    </span>
                    <span className="shrink-0 text-muted tabular">
                      #{l.rank} · {l.value}
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      </div>
      {slug !== FEATURED_TEAM && (
        <p className="text-xs text-muted">
          <TeamName team={tv} size={16} /> page. <Link href="/" className="hover:underline">Back to Stanford →</Link>
        </p>
      )}
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
