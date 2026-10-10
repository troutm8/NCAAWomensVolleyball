import { and, desc, eq, inArray, or, sql } from "drizzle-orm";
import { db } from "@/db/client";
import {
  ingestRuns,
  matchPlayerStats,
  matchTeamStats,
  matches,
  rankings,
  statLeaders,
  teams,
  type Match,
  type Poll,
  type Ranking,
  type Team,
} from "@/db/schema";
import { FEATURED_TEAM } from "./season";

export type MatchWithTeams = Match & { home: Team; away: Team };

const CONF_NAMES: Record<string, string> = {
  acc: "ACC",
  "big-ten": "Big Ten",
  "big-12": "Big 12",
  sec: "SEC",
  "big-east": "Big East",
  "pac-12": "Pac-12",
  wcc: "WCC",
  "mountain-west": "Mountain West",
  "big-west": "Big West",
  "american": "American",
  "atlantic-10": "Atlantic 10",
  mvc: "MVC",
  mac: "MAC",
  "sun-belt": "Sun Belt",
  cusa: "CUSA",
  "ivy-league": "Ivy League",
  "big-sky": "Big Sky",
  "big-south": "Big South",
  caa: "CAA",
  horizon: "Horizon",
  meac: "MEAC",
  swac: "SWAC",
  nec: "NEC",
  ovc: "OVC",
  patriot: "Patriot",
  socon: "SoCon",
  southland: "Southland",
  "summit-league": "Summit League",
  uac: "UAC",
  asun: "ASUN",
  "america-east": "America East",
  "metro-atlantic": "MAAC",
  maac: "MAAC",
  wac: "WAC",
};

export function confName(slug: string | null | undefined, fromDb?: string | null): string {
  if (fromDb) return fromDb;
  if (!slug) return "Independent";
  return CONF_NAMES[slug] ?? slug.split("-").map((w) => w[0]?.toUpperCase() + w.slice(1)).join(" ");
}

export async function getAllTeams(): Promise<Team[]> {
  const d = await db();
  return d.select().from(teams).orderBy(teams.shortName);
}

export async function getTeam(slug: string): Promise<Team | null> {
  const d = await db();
  const [t] = await d.select().from(teams).where(eq(teams.slug, slug));
  return t ?? null;
}

export async function getFeaturedTeam(): Promise<Team | null> {
  return getTeam(FEATURED_TEAM);
}

async function attachTeams(rows: Match[]): Promise<MatchWithTeams[]> {
  if (!rows.length) return [];
  const d = await db();
  const slugs = [...new Set(rows.flatMap((m) => [m.homeSlug, m.awaySlug]))];
  const ts = await d.select().from(teams).where(inArray(teams.slug, slugs));
  const bySlug = new Map(ts.map((t) => [t.slug, t]));
  return rows.map((m) => ({ ...m, home: bySlug.get(m.homeSlug)!, away: bySlug.get(m.awaySlug)! }));
}

export async function getMatchesByDate(ymd: string): Promise<MatchWithTeams[]> {
  const d = await db();
  const rows = await d.select().from(matches).where(eq(matches.gameDate, ymd)).orderBy(matches.startTime, matches.id);
  return attachTeams(rows);
}

export async function getTeamMatches(slug: string): Promise<MatchWithTeams[]> {
  const d = await db();
  const rows = await d
    .select()
    .from(matches)
    .where(or(eq(matches.homeSlug, slug), eq(matches.awaySlug, slug)))
    .orderBy(matches.gameDate, matches.startTime);
  return attachTeams(rows);
}

export async function getMatch(id: string) {
  const d = await db();
  const [m] = await d.select().from(matches).where(eq(matches.id, id));
  if (!m) return null;
  const [withTeams] = await attachTeams([m]);
  const teamStats = await d.select().from(matchTeamStats).where(eq(matchTeamStats.matchId, id));
  const players = await d
    .select()
    .from(matchPlayerStats)
    .where(eq(matchPlayerStats.matchId, id))
    .orderBy(desc(matchPlayerStats.starter), desc(matchPlayerStats.kills), matchPlayerStats.lastName);
  return { match: withTeams, teamStats, players };
}

export type TeamRecord = {
  wins: number;
  losses: number;
  confWins: number;
  confLosses: number;
  home: [number, number];
  away: [number, number];
  neutral: [number, number];
  setsWon: number;
  setsLost: number;
  streak: string;
  last5: ("W" | "L")[];
  vsRanked: [number, number];
};

/** Derive a team's record from its finished matches (chronological input). */
export function computeRecord(slug: string, ms: Match[]): TeamRecord {
  const r: TeamRecord = {
    wins: 0,
    losses: 0,
    confWins: 0,
    confLosses: 0,
    home: [0, 0],
    away: [0, 0],
    neutral: [0, 0],
    setsWon: 0,
    setsLost: 0,
    streak: "—",
    last5: [],
    vsRanked: [0, 0],
  };
  const results: ("W" | "L")[] = [];
  for (const m of ms) {
    if (m.state !== "final" || m.homeSets == null || m.awaySets == null) continue;
    const isHome = m.homeSlug === slug;
    const mine = isHome ? m.homeSets : m.awaySets;
    const theirs = isHome ? m.awaySets : m.homeSets;
    const oppRank = isHome ? m.awayRank : m.homeRank;
    const won = mine > theirs;
    results.push(won ? "W" : "L");
    r.setsWon += mine;
    r.setsLost += theirs;
    if (won) r.wins++;
    else r.losses++;
    if (m.conferenceMatch) won ? r.confWins++ : r.confLosses++;
    const bucket = m.neutral ? r.neutral : isHome ? r.home : r.away;
    bucket[won ? 0 : 1]++;
    if (oppRank && oppRank <= 25) r.vsRanked[won ? 0 : 1]++;
  }
  r.last5 = results.slice(-5);
  if (results.length) {
    const last = results[results.length - 1];
    let n = 0;
    for (let i = results.length - 1; i >= 0 && results[i] === last; i--) n++;
    r.streak = `${last}${n}`;
  }
  return r;
}

export async function getLatestRanking(poll: Poll): Promise<{ asOf: string; rows: (Ranking & { team: Team | null })[] } | null> {
  const d = await db();
  const [latest] = await d
    .select({ asOf: rankings.asOf, fetchedDate: rankings.fetchedDate })
    .from(rankings)
    .where(eq(rankings.poll, poll))
    .orderBy(desc(rankings.fetchedDate), desc(rankings.id))
    .limit(1);
  if (!latest) return null;
  const rows = await d
    .select()
    .from(rankings)
    .where(and(eq(rankings.poll, poll), eq(rankings.asOf, latest.asOf)))
    .orderBy(rankings.rank);
  const slugs = rows.map((r) => r.teamSlug).filter((s): s is string => !!s);
  const ts = slugs.length ? await d.select().from(teams).where(inArray(teams.slug, slugs)) : [];
  const bySlug = new Map(ts.map((t) => [t.slug, t]));
  return { asOf: latest.asOf, rows: rows.map((r) => ({ ...r, team: r.teamSlug ? (bySlug.get(r.teamSlug) ?? null) : null })) };
}

export async function getTeamRankHistory(slug: string, poll: Poll): Promise<{ asOf: string; fetchedDate: string; rank: number }[]> {
  const d = await db();
  return d
    .select({ asOf: rankings.asOf, fetchedDate: rankings.fetchedDate, rank: rankings.rank })
    .from(rankings)
    .where(and(eq(rankings.poll, poll), eq(rankings.teamSlug, slug)))
    .orderBy(rankings.fetchedDate, rankings.id);
}

export async function getTeamCurrentRanks(slug: string): Promise<Record<Poll, (Ranking & { total: number }) | null>> {
  const out: Record<Poll, (Ranking & { total: number }) | null> = { avca: null, rpi: null, committee: null };
  for (const poll of ["avca", "rpi", "committee"] as Poll[]) {
    const latest = await getLatestRanking(poll);
    const row = latest?.rows.find((r) => r.teamSlug === slug);
    out[poll] = row ? { ...row, total: latest!.rows.length } : null;
  }
  return out;
}

export type StandingRow = {
  team: Team;
  record: TeamRecord;
  confPct: number;
  overallPct: number;
};

export async function getStandings(): Promise<{ conf: string; name: string; rows: StandingRow[] }[]> {
  const d = await db();
  const allTeams = await d.select().from(teams);
  const finals = await d.select().from(matches).where(eq(matches.state, "final")).orderBy(matches.gameDate, matches.startTime);
  const byTeam = new Map<string, Match[]>();
  for (const m of finals) {
    byTeam.set(m.homeSlug, [...(byTeam.get(m.homeSlug) ?? []), m]);
    byTeam.set(m.awaySlug, [...(byTeam.get(m.awaySlug) ?? []), m]);
  }
  const groups = new Map<string, StandingRow[]>();
  for (const t of allTeams) {
    if (!t.conferenceSlug) continue;
    const record = computeRecord(t.slug, byTeam.get(t.slug) ?? []);
    const confGames = record.confWins + record.confLosses;
    const games = record.wins + record.losses;
    const row: StandingRow = {
      team: t,
      record,
      confPct: confGames ? record.confWins / confGames : 0,
      overallPct: games ? record.wins / games : 0,
    };
    groups.set(t.conferenceSlug, [...(groups.get(t.conferenceSlug) ?? []), row]);
  }
  const confNameFromDb = new Map<string, string>();
  for (const t of allTeams) if (t.conferenceSlug && t.conferenceName) confNameFromDb.set(t.conferenceSlug, t.conferenceName);
  const out = [...groups.entries()].map(([conf, rows]) => ({
    conf,
    name: confName(conf, confNameFromDb.get(conf)),
    rows: rows.sort((a, b) => b.confPct - a.confPct || b.record.confWins - a.record.confWins || b.overallPct - a.overallPct || a.team.shortName.localeCompare(b.team.shortName)),
  }));
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getStatLeaders(scope: "individual" | "team", statId: number, limit = 100) {
  const d = await db();
  const [latest] = await d
    .select({ asOf: statLeaders.asOf, category: statLeaders.category })
    .from(statLeaders)
    .where(and(eq(statLeaders.scope, scope), eq(statLeaders.statId, statId)))
    .orderBy(desc(statLeaders.fetchedDate), desc(statLeaders.id))
    .limit(1);
  if (!latest) return null;
  const rows = await d
    .select()
    .from(statLeaders)
    .where(and(eq(statLeaders.scope, scope), eq(statLeaders.statId, statId), eq(statLeaders.asOf, latest.asOf)))
    .orderBy(statLeaders.rank)
    .limit(limit);
  return { asOf: latest.asOf, category: latest.category, rows };
}

export async function getTeamStatLeaderRows(slug: string) {
  const d = await db();
  const rows = await d
    .select()
    .from(statLeaders)
    .where(eq(statLeaders.teamSlug, slug))
    .orderBy(statLeaders.scope, statLeaders.statId, desc(statLeaders.fetchedDate), statLeaders.rank);
  // keep only the latest as_of per (scope, statId)
  const seen = new Map<string, string>();
  return rows.filter((r) => {
    const k = `${r.scope}/${r.statId}`;
    if (!seen.has(k)) seen.set(k, r.asOf);
    return seen.get(k) === r.asOf;
  });
}

export type SeasonTeamStats = {
  matches: number;
  sets: number;
  kills: number;
  attackErrors: number;
  attackAttempts: number;
  assists: number;
  aces: number;
  serviceErrors: number;
  digs: number;
  blocks: number;
  oppKills: number;
  oppErrors: number;
  oppAttempts: number;
};

export async function getTeamSeasonStats(slug: string): Promise<SeasonTeamStats | null> {
  const d = await db();
  const own = await d
    .select({ m: matches, s: matchTeamStats })
    .from(matchTeamStats)
    .innerJoin(matches, eq(matches.id, matchTeamStats.matchId))
    .where(eq(matchTeamStats.teamSlug, slug));
  if (!own.length) return null;
  const ids = own.map((r) => r.m.id);
  const opp = await d
    .select()
    .from(matchTeamStats)
    .where(and(inArray(matchTeamStats.matchId, ids), sql`${matchTeamStats.teamSlug} <> ${slug}`));
  const agg: SeasonTeamStats = {
    matches: own.length,
    sets: 0,
    kills: 0,
    attackErrors: 0,
    attackAttempts: 0,
    assists: 0,
    aces: 0,
    serviceErrors: 0,
    digs: 0,
    blocks: 0,
    oppKills: 0,
    oppErrors: 0,
    oppAttempts: 0,
  };
  for (const { m, s } of own) {
    agg.sets += (m.homeSets ?? 0) + (m.awaySets ?? 0);
    agg.kills += s.kills ?? 0;
    agg.attackErrors += s.attackErrors ?? 0;
    agg.attackAttempts += s.attackAttempts ?? 0;
    agg.assists += s.assists ?? 0;
    agg.aces += s.serviceAces ?? 0;
    agg.serviceErrors += s.serviceErrors ?? 0;
    agg.digs += s.digs ?? 0;
    agg.blocks += Number(s.totalBlocks ?? 0);
  }
  for (const s of opp) {
    agg.oppKills += s.kills ?? 0;
    agg.oppErrors += s.attackErrors ?? 0;
    agg.oppAttempts += s.attackAttempts ?? 0;
  }
  return agg;
}

export type PlayerSeason = {
  name: string;
  position: string | null;
  number: number | null;
  matches: number;
  sets: number;
  kills: number;
  errors: number;
  attempts: number;
  assists: number;
  aces: number;
  digs: number;
  blocks: number;
  points: number;
};

export async function getTeamPlayerSeason(slug: string): Promise<PlayerSeason[]> {
  const d = await db();
  const rows = await d.select().from(matchPlayerStats).where(eq(matchPlayerStats.teamSlug, slug));
  const by = new Map<string, PlayerSeason>();
  for (const p of rows) {
    const key = `${p.lastName}|${p.firstName}`;
    const cur =
      by.get(key) ??
      {
        name: `${p.firstName} ${p.lastName}`.trim(),
        position: p.position,
        number: p.number,
        matches: 0,
        sets: 0,
        kills: 0,
        errors: 0,
        attempts: 0,
        assists: 0,
        aces: 0,
        digs: 0,
        blocks: 0,
        points: 0,
      };
    cur.matches++;
    cur.sets += p.sets ?? 0;
    cur.kills += p.kills ?? 0;
    cur.errors += p.attackErrors ?? 0;
    cur.attempts += p.attackAttempts ?? 0;
    cur.assists += p.assists ?? 0;
    cur.aces += p.serviceAces ?? 0;
    cur.digs += p.digs ?? 0;
    cur.blocks += Number(p.totalBlocks ?? 0);
    cur.points += Number(p.points ?? 0);
    by.set(key, cur);
  }
  return [...by.values()].sort((a, b) => b.points - a.points);
}

export async function getLastIngest(): Promise<Date | null> {
  const d = await db();
  const [r] = await d.select({ t: ingestRuns.finishedAt }).from(ingestRuns).where(eq(ingestRuns.ok, true)).orderBy(desc(ingestRuns.finishedAt)).limit(1);
  return r?.t ?? null;
}

export async function getMatchesInRange(from: string, to: string): Promise<MatchWithTeams[]> {
  const d = await db();
  const rows = await d
    .select()
    .from(matches)
    .where(and(sql`${matches.gameDate} >= ${from}`, sql`${matches.gameDate} <= ${to}`))
    .orderBy(matches.gameDate, matches.startTime);
  return attachTeams(rows);
}
