import { Card } from "@/components/Card";
import { TeamName } from "@/components/TeamName";
import { getStandings } from "@/lib/queries";
import { FEATURED_TEAM } from "@/lib/season";
import { teamView } from "@/lib/views";

export const metadata = { title: "Standings" };

export default async function StandingsPage({ searchParams }: { searchParams: Promise<{ conf?: string }> }) {
  const sp = await searchParams;
  const all = await getStandings();
  const featuredConf = all.find((g) => g.rows.some((r) => r.team.slug === FEATURED_TEAM))?.conf;
  const ordered = [...all].sort((a, b) => (a.conf === featuredConf ? -1 : b.conf === featuredConf ? 1 : 0));
  const groups = sp.conf ? ordered.filter((g) => g.conf === sp.conf) : ordered;
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-xl font-bold">Conference standings</h1>
        <form action="/standings" className="text-sm">
          <select name="conf" defaultValue={sp.conf ?? ""} className="rounded-md border border-line bg-card px-2 py-1">
            <option value="">All conferences</option>
            {ordered.map((g) => (
              <option key={g.conf} value={g.conf}>
                {g.name}
              </option>
            ))}
          </select>{" "}
          <button className="rounded-md bg-cardinal px-3 py-1 text-white">Go</button>
        </form>
      </div>
      <p className="text-xs text-muted">Derived from completed matches on ncaa.com. Conference records count matches ncaa.com tags as conference play.</p>
      <div className="grid gap-4 lg:grid-cols-2">
        {groups.map((g) => (
          <Card key={g.conf} title={g.name}>
            <table className="data w-full text-sm">
              <thead>
                <tr>
                  <th>Team</th>
                  <th className="r">Conf</th>
                  <th className="r">Pct</th>
                  <th className="r">Overall</th>
                  <th className="r">Sets</th>
                  <th className="r">Strk</th>
                  <th className="r">Last 5</th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map(({ team, record, confPct }) => (
                  <tr key={team.slug} className={team.slug === FEATURED_TEAM ? "bg-soft font-semibold" : ""}>
                    <td>
                      <TeamName team={teamView(team)} size={20} />
                    </td>
                    <td className="r tabular">
                      {record.confWins}-{record.confLosses}
                    </td>
                    <td className="r tabular text-muted">{confPct.toFixed(3).replace(/^0/, "")}</td>
                    <td className="r tabular">
                      {record.wins}-{record.losses}
                    </td>
                    <td className="r tabular text-muted">
                      {record.setsWon}-{record.setsLost}
                    </td>
                    <td className={`r tabular ${record.streak.startsWith("W") ? "text-win" : record.streak.startsWith("L") ? "text-loss" : ""}`}>{record.streak}</td>
                    <td className="r tabular">
                      {record.last5.map((r, i) => (
                        <span key={i} className={r === "W" ? "text-win" : "text-loss"}>
                          {r}
                        </span>
                      ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        ))}
      </div>
    </div>
  );
}
