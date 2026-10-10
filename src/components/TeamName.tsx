import Link from "next/link";
import type { TeamView } from "@/lib/views";
import { TeamLogo } from "./TeamLogo";

export function RankBadge({ rank }: { rank: number | null | undefined }) {
  if (!rank || rank > 25) return null;
  return <span className="mr-1 text-xs font-semibold text-muted tabular">#{rank}</span>;
}

export function TeamName({
  team,
  rank,
  size = 24,
  bold = false,
  featured = false,
}: {
  team: TeamView;
  rank?: number | null;
  size?: number;
  bold?: boolean;
  featured?: boolean;
}) {
  return (
    <Link href={`/teams/${team.slug}`} className={`inline-flex items-center gap-2 hover:underline ${bold ? "font-semibold" : ""} ${featured ? "text-cardinal dark:text-red-300" : ""}`}>
      <TeamLogo team={team} size={size} />
      <span>
        <RankBadge rank={rank} />
        {team.name}
      </span>
    </Link>
  );
}
