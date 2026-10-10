import Link from "next/link";
import { Card, Empty } from "@/components/Card";
import { TeamName } from "@/components/TeamName";
import { getLatestRanking } from "@/lib/queries";
import { FEATURED_TEAM } from "@/lib/season";
import { teamView } from "@/lib/views";
import type { Poll } from "@/db/schema";

export const metadata = { title: "Rankings" };

const POLLS: { key: Poll; label: string }[] = [
  { key: "avca", label: "AVCA Coaches Poll" },
  { key: "rpi", label: "NCAA RPI" },
  { key: "committee", label: "Committee Top 16" },
];

function Move({ rank, prev }: { rank: number; prev: number | null }) {
  if (prev == null) return <span className="text-muted">new</span>;
  if (prev === rank) return <span className="text-muted">–</span>;
  return prev > rank ? <span className="text-win">▲ {prev - rank}</span> : <span className="text-loss">▼ {rank - prev}</span>;
}

export default async function RankingsPage({ searchParams }: { searchParams: Promise<{ poll?: string }> }) {
  const sp = await searchParams;
  const poll = (POLLS.some((p) => p.key === sp.poll) ? sp.poll : "avca") as Poll;
  const [data, avca, rpi] = await Promise.all([getLatestRanking(poll), getLatestRanking("avca"), getLatestRanking("rpi")]);
  const rpiBySlug = new Map(rpi?.rows.map((r) => [r.teamSlug, r.rank]) ?? []);
  const avcaBySlug = new Map(avca?.rows.map((r) => [r.teamSlug, r.rank]) ?? []);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-bold">Rankings</h1>
        {POLLS.map((p) => (
          <Link key={p.key} href={`/rankings?poll=${p.key}`} className={`rounded-full border px-3 py-1 text-sm ${p.key === poll ? "border-cardinal bg-cardinal text-white" : "border-line hover:bg-soft"}`}>
            {p.label}
          </Link>
        ))}
      </div>
      <Card title={data ? data.asOf : undefined}>
        {!data ? (
          <Empty>This poll has not been loaded yet{poll === "committee" ? ". The committee's first 2026 reveal is expected in late October." : "."}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="data w-full text-sm">
              <thead>
                <tr>
                  <th className="r">#</th>
                  <th>Team</th>
                  <th className="r">Record</th>
                  {poll === "rpi" && (
                    <>
                      <th>Conf</th>
                      <th className="r">Home</th>
                      <th className="r">Road</th>
                      <th className="r">Neutral</th>
                      <th className="r">AVCA</th>
                    </>
                  )}
                  {poll === "avca" && (
                    <>
                      <th className="r">Points</th>
                      <th className="r">1st</th>
                      <th className="r">Prev</th>
                      <th className="r">Move</th>
                      <th className="r">RPI</th>
                    </>
                  )}
                  {poll === "committee" && (
                    <>
                      <th className="r">AVCA</th>
                      <th className="r">RPI</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.rank} className={r.teamSlug === FEATURED_TEAM ? "bg-soft font-semibold" : ""}>
                    <td className="r tabular">{r.rank}</td>
                    <td>{r.team ? <TeamName team={teamView(r.team)} size={20} /> : r.teamName}</td>
                    <td className="r tabular">{r.record ?? ""}</td>
                    {poll === "rpi" && (
                      <>
                        <td className="text-muted">{r.conference}</td>
                        <td className="r tabular text-muted">{r.homeRecord}</td>
                        <td className="r tabular text-muted">{r.roadRecord}</td>
                        <td className="r tabular text-muted">{r.neutralRecord}</td>
                        <td className="r tabular text-muted">{avcaBySlug.get(r.teamSlug) ?? ""}</td>
                      </>
                    )}
                    {poll === "avca" && (
                      <>
                        <td className="r tabular">{r.points ?? ""}</td>
                        <td className="r tabular text-muted">{r.firstPlaceVotes ?? ""}</td>
                        <td className="r tabular text-muted">{r.prevRank ?? ""}</td>
                        <td className="r tabular">
                          <Move rank={r.rank} prev={r.prevRank} />
                        </td>
                        <td className="r tabular text-muted">{rpiBySlug.get(r.teamSlug) ?? ""}</td>
                      </>
                    )}
                    {poll === "committee" && (
                      <>
                        <td className="r tabular text-muted">{avcaBySlug.get(r.teamSlug) ?? ""}</td>
                        <td className="r tabular text-muted">{rpiBySlug.get(r.teamSlug) ?? ""}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
