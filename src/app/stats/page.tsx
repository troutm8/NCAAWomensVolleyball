import Link from "next/link";
import { Card, Empty } from "@/components/Card";
import { TeamName } from "@/components/TeamName";
import { INDIVIDUAL_STATS, TEAM_STATS } from "@/ingest/sources/ncaa";
import { getAllTeams, getStatLeaders } from "@/lib/queries";
import { FEATURED_TEAM } from "@/lib/season";
import { teamView } from "@/lib/views";

export const metadata = { title: "Stat leaders" };

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ scope?: string; stat?: string }> }) {
  const sp = await searchParams;
  const scope = sp.scope === "team" ? "team" : "individual";
  const cats = scope === "team" ? TEAM_STATS : INDIVIDUAL_STATS;
  const statId = Number(sp.stat) && cats[Number(sp.stat)] ? Number(sp.stat) : Number(Object.keys(cats)[0]);
  const [data, teams] = await Promise.all([getStatLeaders(scope, statId, 100), getAllTeams()]);
  const bySlug = new Map(teams.map((t) => [t.slug, t]));
  const columns = data?.rows[0] ? Object.keys(data.rows[0].raw).filter((k) => !["Rank", "Name", "Team"].includes(k)) : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-bold">National leaders</h1>
        {(["individual", "team"] as const).map((s) => (
          <Link key={s} href={`/stats?scope=${s}`} className={`rounded-full border px-3 py-1 text-sm capitalize ${s === scope ? "border-cardinal bg-cardinal text-white" : "border-line hover:bg-soft"}`}>
            {s}
          </Link>
        ))}
      </div>
      <div className="flex flex-wrap gap-2 text-sm">
        {Object.entries(cats).map(([id, label]) => (
          <Link key={id} href={`/stats?scope=${scope}&stat=${id}`} className={`rounded-md border px-2 py-1 ${Number(id) === statId ? "border-cardinal font-semibold" : "border-line hover:bg-soft"}`}>
            {label}
          </Link>
        ))}
      </div>
      <Card title={data ? `${data.category} · ${data.asOf}` : undefined}>
        {!data ? (
          <Empty>Not loaded yet.</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="data w-full text-sm">
              <thead>
                <tr>
                  <th className="r">#</th>
                  {scope === "individual" && <th>Player</th>}
                  <th>Team</th>
                  {columns.map((c) => (
                    <th key={c} className="r">
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => {
                  const t = r.teamSlug ? bySlug.get(r.teamSlug) : undefined;
                  return (
                    <tr key={r.id} className={r.teamSlug === FEATURED_TEAM ? "bg-soft font-semibold" : ""}>
                      <td className="r tabular">{r.rank}</td>
                      {scope === "individual" && <td>{r.playerName}</td>}
                      <td>{t ? <TeamName team={teamView(t)} size={18} /> : r.teamName}</td>
                      {columns.map((c) => (
                        <td key={c} className="r tabular">
                          {r.raw[c]}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
