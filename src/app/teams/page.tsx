import { Card } from "@/components/Card";
import { TeamName } from "@/components/TeamName";
import { confName, getAllTeams } from "@/lib/queries";
import { FEATURED_TEAM } from "@/lib/season";
import { teamView } from "@/lib/views";

export const metadata = { title: "Teams" };

export default async function TeamsPage() {
  const all = (await getAllTeams()).filter((t) => t.isD1 && t.conferenceSlug);
  const groups = new Map<string, typeof all>();
  for (const t of all) groups.set(t.conferenceSlug!, [...(groups.get(t.conferenceSlug!) ?? []), t]);
  const featuredConf = all.find((t) => t.slug === FEATURED_TEAM)?.conferenceSlug;
  const ordered = [...groups.entries()]
    .map(([slug, teams]) => ({ slug, name: confName(slug, teams[0].conferenceName), teams }))
    .sort((a, b) => (a.slug === featuredConf ? -1 : b.slug === featuredConf ? 1 : a.name.localeCompare(b.name)));
  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Division I teams</h1>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {ordered.map((g) => (
          <Card key={g.slug} title={`${g.name} (${g.teams.length})`}>
            <ul className="space-y-1 text-sm">
              {g.teams.map((t) => (
                <li key={t.slug}>
                  <TeamName team={teamView(t)} size={18} featured={t.slug === FEATURED_TEAM} />
                </li>
              ))}
            </ul>
          </Card>
        ))}
      </div>
    </div>
  );
}
