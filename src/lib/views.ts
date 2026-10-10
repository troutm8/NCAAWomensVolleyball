import type { Team } from "@/db/schema";
import type { MatchWithTeams } from "./queries";

export type TeamView = {
  slug: string;
  name: string;
  abbr: string;
  logo: string | null;
  espnId: string | null;
  conf: string | null;
};

export type MatchView = {
  id: string;
  gameDate: string;
  startTime: string | null;
  state: "pre" | "live" | "final" | string;
  period: string | null;
  homeSets: number | null;
  awaySets: number | null;
  setScores: { home: number; away: number }[] | null;
  home: TeamView;
  away: TeamView;
  homeRank: number | null;
  awayRank: number | null;
  conferenceMatch: boolean;
  neutral: boolean | null;
  venue: string | null;
  broadcast: string | null;
  espnEventId: string | null;
};

export function teamView(t: Team): TeamView {
  return {
    slug: t.slug,
    name: t.shortName,
    abbr: t.abbreviation ?? t.char6 ?? t.shortName.slice(0, 6).toUpperCase(),
    logo: t.logoUrl,
    espnId: t.espnId,
    conf: t.conferenceSlug,
  };
}

export function matchView(m: MatchWithTeams): MatchView {
  return {
    id: m.id,
    gameDate: m.gameDate,
    startTime: m.startTime ? m.startTime.toISOString() : null,
    state: m.state,
    period: m.period,
    homeSets: m.homeSets,
    awaySets: m.awaySets,
    setScores: m.setScores ?? null,
    home: teamView(m.home),
    away: teamView(m.away),
    homeRank: m.homeRank,
    awayRank: m.awayRank,
    conferenceMatch: m.conferenceMatch,
    neutral: m.neutral,
    venue: m.venue,
    broadcast: m.broadcast,
    espnEventId: m.espnEventId,
  };
}

/** Sort key: featured team first, then ranked matchups, then live, then by time. */
export function sortForFeatured(views: MatchView[], featured: string): MatchView[] {
  const score = (m: MatchView) => {
    let s = 0;
    if (m.home.slug === featured || m.away.slug === featured) s -= 1000;
    if (m.state === "live") s -= 100;
    const best = Math.min(m.homeRank ?? 99, m.awayRank ?? 99);
    if (best <= 25) s -= 50 - best;
    return s;
  };
  return [...views].sort((a, b) => score(a) - score(b) || (a.startTime ?? "").localeCompare(b.startTime ?? ""));
}
