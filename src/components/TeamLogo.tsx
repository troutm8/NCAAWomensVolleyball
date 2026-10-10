import type { TeamView } from "@/lib/views";

export function TeamLogo({ team, size = 28, className = "" }: { team: Pick<TeamView, "name" | "logo" | "abbr">; size?: number; className?: string }) {
  if (team.logo) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={team.logo} alt="" width={size} height={size} className={`shrink-0 object-contain ${className}`} loading="lazy" />;
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full bg-soft text-[10px] font-semibold text-muted ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      {team.abbr.slice(0, 3)}
    </span>
  );
}
