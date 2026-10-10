import { notFound } from "next/navigation";
import { Card, Empty } from "@/components/Card";
import { TeamLogo } from "@/components/TeamLogo";
import { TeamName } from "@/components/TeamName";
import { fmtDateTime, num, pct } from "@/lib/format";
import { getMatch } from "@/lib/queries";
import { FEATURED_TEAM } from "@/lib/season";
import { teamView } from "@/lib/views";
import type { MatchPlayerStat, MatchTeamStat } from "@/db/schema";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const d = await getMatch((await params).id);
  return { title: d ? `${d.match.away.shortName} at ${d.match.home.shortName}` : "Match" };
}

const TEAM_ROWS: { label: string; get: (s: MatchTeamStat) => string }[] = [
  { label: "Kills", get: (s) => String(s.kills ?? "—") },
  { label: "Attack errors", get: (s) => String(s.attackErrors ?? "—") },
  { label: "Attempts", get: (s) => String(s.attackAttempts ?? "—") },
  { label: "Hitting %", get: (s) => pct(s.hitPct) },
  { label: "Assists", get: (s) => String(s.assists ?? "—") },
  { label: "Aces", get: (s) => String(s.serviceAces ?? "—") },
  { label: "Service errors", get: (s) => String(s.serviceErrors ?? "—") },
  { label: "Digs", get: (s) => String(s.digs ?? "—") },
  { label: "Blocks", get: (s) => num(s.totalBlocks, 1) },
  { label: "Reception errors", get: (s) => String(s.receptionErrors ?? "—") },
];

export default async function MatchPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const data = await getMatch(id);
  if (!data) notFound();
  const { match: m, teamStats, players } = data;
  const home = teamView(m.home);
  const away = teamView(m.away);
  const hs = teamStats.find((s) => s.teamSlug === m.homeSlug);
  const as = teamStats.find((s) => s.teamSlug === m.awaySlug);
  const homeWon = m.state === "final" && (m.homeSets ?? 0) > (m.awaySets ?? 0);

  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-line bg-card p-5 shadow-sm">
        <p className="text-xs text-muted">
          {fmtDateTime(m.startTime)}
          {m.venue ? ` · ${m.venue}` : ""}
          {m.broadcast ? ` · ${m.broadcast}` : ""}
          {m.conferenceMatch ? " · Conference match" : ""}
          {m.neutral ? " · Neutral site" : ""}
        </p>
        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-4">
          <Side team={away} rank={m.awayRank} sets={m.awaySets} won={m.state === "final" && !homeWon} />
          <div className="text-center text-sm text-muted">{m.state === "final" ? "Final" : m.state === "live" ? <span className="text-live">{m.period}</span> : "vs"}</div>
          <Side team={home} rank={m.homeRank} sets={m.homeSets} won={homeWon} right />
        </div>
        {m.setScores && m.setScores.length > 0 && (
          <table className="data mt-4 w-auto text-sm">
            <thead>
              <tr>
                <th></th>
                {m.setScores.map((_, i) => (
                  <th key={i} className="r">
                    Set {i + 1}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>{away.name}</td>
                {m.setScores.map((s, i) => (
                  <td key={i} className={`r tabular ${s.away > s.home ? "font-semibold" : "text-muted"}`}>
                    {s.away}
                  </td>
                ))}
              </tr>
              <tr>
                <td>{home.name}</td>
                {m.setScores.map((s, i) => (
                  <td key={i} className={`r tabular ${s.home > s.away ? "font-semibold" : "text-muted"}`}>
                    {s.home}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        )}
      </section>

      {teamStats.length === 0 ? (
        <Card>
          <Empty>{m.state === "final" ? "Box score not loaded yet." : "Box score will appear after the match."}</Empty>
        </Card>
      ) : (
        <>
          <Card title="Team stats">
            <table className="data w-full max-w-xl text-sm">
              <thead>
                <tr>
                  <th className="r">{away.abbr}</th>
                  <th className="text-center"></th>
                  <th>{home.abbr}</th>
                </tr>
              </thead>
              <tbody>
                {TEAM_ROWS.map((row) => (
                  <tr key={row.label}>
                    <td className="r tabular">{as ? row.get(as) : "—"}</td>
                    <td className="text-center text-muted">{row.label}</td>
                    <td className="tabular">{hs ? row.get(hs) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <div className="grid gap-6 lg:grid-cols-2">
            <PlayerTable team={away} players={players.filter((p) => p.teamSlug === m.awaySlug)} />
            <PlayerTable team={home} players={players.filter((p) => p.teamSlug === m.homeSlug)} />
          </div>
        </>
      )}
    </div>
  );
}

function Side({ team, rank, sets, won, right = false }: { team: ReturnType<typeof teamView>; rank: number | null; sets: number | null; won: boolean; right?: boolean }) {
  return (
    <div className={`flex items-center gap-3 ${right ? "flex-row-reverse text-right" : ""}`}>
      <TeamLogo team={team} size={56} />
      <div>
        <TeamName team={team} rank={rank} bold size={0} featured={team.slug === FEATURED_TEAM} />
        <div className={`text-3xl tabular ${won ? "font-bold" : "text-muted"}`}>{sets ?? ""}</div>
      </div>
    </div>
  );
}

function PlayerTable({ team, players }: { team: ReturnType<typeof teamView>; players: MatchPlayerStat[] }) {
  return (
    <Card title={<span className="inline-flex items-center gap-2"><TeamLogo team={team} size={18} />{team.name}</span>}>
      {players.length === 0 ? (
        <Empty>No player stats.</Empty>
      ) : (
        <div className="overflow-x-auto">
          <table className="data w-full text-sm">
            <thead>
              <tr>
                <th>Player</th>
                <th className="r">S</th>
                <th className="r">K</th>
                <th className="r">E</th>
                <th className="r">TA</th>
                <th className="r">Pct</th>
                <th className="r">A</th>
                <th className="r">SA</th>
                <th className="r">D</th>
                <th className="r">BS</th>
                <th className="r">BA</th>
                <th className="r">Pts</th>
              </tr>
            </thead>
            <tbody>
              {players.map((p) => (
                <tr key={p.id} className={p.starter ? "" : "text-muted"}>
                  <td>
                    <span className="mr-1 tabular text-muted">{p.number ?? ""}</span>
                    {p.firstName} {p.lastName} <span className="text-muted">{p.position}</span>
                  </td>
                  <td className="r tabular">{p.sets ?? ""}</td>
                  <td className="r tabular">{p.kills ?? 0}</td>
                  <td className="r tabular">{p.attackErrors ?? 0}</td>
                  <td className="r tabular">{p.attackAttempts ?? 0}</td>
                  <td className="r tabular">{pct(p.hitPct)}</td>
                  <td className="r tabular">{p.assists ?? 0}</td>
                  <td className="r tabular">{p.serviceAces ?? 0}</td>
                  <td className="r tabular">{p.digs ?? 0}</td>
                  <td className="r tabular">{p.blockSolos ?? 0}</td>
                  <td className="r tabular">{p.blockAssists ?? 0}</td>
                  <td className="r tabular">{num(p.points, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
