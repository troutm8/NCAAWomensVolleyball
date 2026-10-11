/**
 * Tournament projection: who is in the 64-team field, who the 16 seeds are, and which
 * conference auto-bids are settled.
 *
 * Everything here is a projection derived from data we already store (RPI, the AVCA poll
 * and completed matches). The weights are deliberately simple and are published on the
 * /bracket page so the output can be argued with. Nothing in here is an NCAA product.
 */
import { and, desc, eq, ne, or } from "drizzle-orm";
import { db } from "@/db/client";
import { matches, rankings, teams, type Match, type Team } from "@/db/schema";
import { computeRecord, confName, type TeamRecord } from "./queries";
import { todayEastern } from "./season";
import { AUTO_BID_OVERRIDES, NO_AUTO_BID } from "./auto-bid-overrides";

/** 64-team field: one auto-bid per conference, the rest at-large. */
export const FIELD_SIZE = 64;
/** The committee seeds the top 16, who host the first two rounds. */
export const SEED_COUNT = 16;
/** Conference tournaments start around here; before it, a "champion" is just the leader. */
export const CONF_TOURNAMENT_START = "2026-11-18";
/** How many near-misses to list as the bubble. */
export const BUBBLE_SIZE = 8;

/** Weights of the composite score, in points. They sum to 100. */
export const WEIGHTS = { rpi: 45, poll: 20, quality: 25, avoid: 5, road: 5 } as const;

export type QualityRecord = { top25: [number, number]; top50: [number, number]; top100: [number, number] };

export type Resume = {
  team: Team;
  conf: string;
  confName: string;
  rpiRank: number | null;
  avcaRank: number | null;
  record: TeamRecord;
  quality: QualityRecord;
  /** Losses to teams outside the RPI top 100, and the worst one. */
  badLosses: number;
  worstLossRpi: number | null;
  roadNeutral: [number, number];
  last10: ("W" | "L")[];
  score: number;
  components: { rpi: number; poll: number; quality: number; avoid: number; road: number };
};

export type BidStatus = "clinched" | "underway" | "projected" | "override";

export type ConferenceBid = {
  conf: string;
  confName: string;
  status: BidStatus;
  /** The projected or actual automatic qualifier. Null only if a conference has no results. */
  team: Resume | null;
  /** Conference matches still to be played, i.e. how open the bid still is. */
  pending: number;
  /** Date of the last scheduled conference match: when the bid will be settled. */
  decidesOn: string | null;
  note: string | null;
};

export type FieldEntry = {
  resume: Resume;
  /** 1–16 for seeded teams, null for the rest of the field. */
  seed: number | null;
  /** Position in the overall projected ranking, 1-based. */
  overall: number;
  bid: "auto" | "at-large";
  bidStatus: BidStatus | null;
};

export type Bracketology = {
  field: FieldEntry[];
  seeds: FieldEntry[];
  bubble: Resume[];
  bids: ConferenceBid[];
  atLargeCount: number;
  rpiAsOf: string | null;
  avcaAsOf: string | null;
  rpiTotal: number;
  /** True once the real field exists and projecting is no longer the point. */
  selectionDone: boolean;
};

export type BracketologyInput = {
  teams: Team[];
  finals: Match[];
  /** Matches not yet final (used to tell a finished conference tournament from one underway). */
  upcoming: Match[];
  rpiRank: Map<string, number>;
  avcaRank: Map<string, number>;
  rpiTotal: number;
  rpiAsOf: string | null;
  avcaAsOf: string | null;
  today: string;
};

function clamp01(n: number): number {
  return Math.max(0, Math.min(1, n));
}

function bucketOf(rank: number | null | undefined): 25 | 50 | 100 | 150 | 999 {
  if (rank == null) return 999;
  if (rank <= 25) return 25;
  if (rank <= 50) return 50;
  if (rank <= 100) return 100;
  if (rank <= 150) return 150;
  return 999;
}

/**
 * One team's resume. `ms` must be that team's finished matches in chronological order;
 * opponent quality is measured by the opponent's *current* RPI rank, which is how the
 * committee's own "record vs RPI top 25/50" tables work.
 */
export function buildResume(
  team: Team,
  ms: Match[],
  rpiRank: Map<string, number>,
  avcaRank: Map<string, number>,
  rpiTotal: number,
): Resume {
  const record = computeRecord(team.slug, ms);
  const quality: QualityRecord = { top25: [0, 0], top50: [0, 0], top100: [0, 0] };
  const roadNeutral: [number, number] = [0, 0];
  const results: ("W" | "L")[] = [];
  let badLosses = 0;
  let worstLossRpi: number | null = null;
  let softLosses = 0;

  for (const m of ms) {
    if (m.state !== "final" || m.homeSets == null || m.awaySets == null) continue;
    const isHome = m.homeSlug === team.slug;
    const oppSlug = isHome ? m.awaySlug : m.homeSlug;
    const won = (isHome ? m.homeSets : m.awaySets) > (isHome ? m.awaySets : m.homeSets);
    results.push(won ? "W" : "L");
    const oppRpi = rpiRank.get(oppSlug) ?? null;
    const bucket = bucketOf(oppRpi);
    const i = won ? 0 : 1;
    if (bucket === 25) quality.top25[i]++;
    if (bucket <= 50) quality.top50[i]++;
    if (bucket <= 100) quality.top100[i]++;
    if (!won && bucket > 100) {
      badLosses++;
      if (bucket === 150) softLosses += 0.5;
      else softLosses += 1;
      if (worstLossRpi == null || (oppRpi ?? rpiTotal) > worstLossRpi) worstLossRpi = oppRpi ?? rpiTotal;
    }
    if (!isHome || m.neutral) roadNeutral[won ? 0 : 1]++;
  }

  const rpi = rpiRank.get(team.slug) ?? null;
  const avca = avcaRank.get(team.slug) ?? null;
  const rnGames = roadNeutral[0] + roadNeutral[1];

  const components = {
    rpi: rpi ? WEIGHTS.rpi * clamp01(1 - (rpi - 1) / Math.max(1, rpiTotal - 1)) : 0,
    poll: avca ? WEIGHTS.poll * clamp01((26 - avca) / 25) : 0,
    quality:
      WEIGHTS.quality *
      clamp01((3 * quality.top25[0] + 2 * (quality.top50[0] - quality.top25[0]) + (quality.top100[0] - quality.top50[0])) / 15),
    avoid: WEIGHTS.avoid * clamp01(1 - softLosses / 3),
    // A team that has not left home yet gets the neutral half-credit rather than a zero.
    road: rnGames ? WEIGHTS.road * (roadNeutral[0] / rnGames) : WEIGHTS.road / 2,
  };

  return {
    team,
    conf: team.conferenceSlug ?? "independent",
    confName: confName(team.conferenceSlug, team.conferenceName),
    rpiRank: rpi,
    avcaRank: avca,
    record,
    quality,
    badLosses,
    worstLossRpi,
    roadNeutral,
    last10: results.slice(-10),
    score: Object.values(components).reduce((a, b) => a + b, 0),
    components,
  };
}

/** Projected ranking order: composite score, then RPI, then name. */
export function compareResumes(a: Resume, b: Resume): number {
  return (
    b.score - a.score ||
    (a.rpiRank ?? Number.MAX_SAFE_INTEGER) - (b.rpiRank ?? Number.MAX_SAFE_INTEGER) ||
    a.team.shortName.localeCompare(b.team.shortName)
  );
}

/** Conference-tournament order: conference record, then composite score. */
function compareInConference(a: Resume, b: Resume): number {
  const pct = (r: Resume) => {
    const g = r.record.confWins + r.record.confLosses;
    return g ? r.record.confWins / g : 0;
  };
  return pct(b) - pct(a) || compareResumes(a, b);
}

/**
 * Settle one conference's automatic bid.
 *
 * The automatic qualifier is the conference tournament champion, and in every conference
 * the tournament final is the last conference match on the schedule. So: if a conference
 * has conference matches left to play, the bid is still open and we project the leader; once
 * none are left, the winner of the last conference match played is the champion.
 */
export function conferenceBid(
  conf: string,
  members: Resume[],
  finals: Match[],
  upcoming: Match[],
  today: string,
): ConferenceBid {
  const bySlug = new Map(members.map((r) => [r.team.slug, r]));
  const name = members[0]?.confName ?? confName(conf);
  const override = AUTO_BID_OVERRIDES.find((o) => o.conf === conf);
  const pendingMatches = upcoming.filter((m) => m.conferenceMatch && m.gameDate >= today && bySlug.has(m.homeSlug) && bySlug.has(m.awaySlug));
  const pending = pendingMatches.length;
  const decidesOn = pending ? pendingMatches.map((m) => m.gameDate).sort().at(-1)! : null;

  if (override) {
    return {
      conf,
      confName: name,
      status: "override",
      team: bySlug.get(override.team) ?? null,
      pending,
      decidesOn,
      note: override.note,
    };
  }

  const confFinals = finals
    .filter((m) => m.conferenceMatch && bySlug.has(m.homeSlug) && bySlug.has(m.awaySlug))
    .sort((a, b) => a.gameDate.localeCompare(b.gameDate) || (a.startTime?.getTime() ?? 0) - (b.startTime?.getTime() ?? 0));
  const last = confFinals[confFinals.length - 1];
  const leader = [...members].sort(compareInConference)[0] ?? null;

  // Only a match inside the tournament window can be a tournament final. Conference
  // tournaments are not on ncaa.com's schedule until the brackets are drawn, so a
  // conference can briefly look finished in mid-November when it has only ended its
  // regular season — claiming a champion there would crown whoever happened to win last.
  const inWindow = !!last && last.gameDate >= CONF_TOURNAMENT_START;
  if (last && !pending && inWindow) {
    const winner = (last.homeSets ?? 0) > (last.awaySets ?? 0) ? last.homeSlug : last.awaySlug;
    return {
      conf,
      confName: name,
      status: "clinched",
      team: bySlug.get(winner) ?? leader,
      pending: 0,
      decidesOn: null,
      note: `Won the last conference match of the season, ${last.gameDate}.`,
    };
  }
  if (inWindow && pending) {
    return {
      conf,
      confName: name,
      status: "underway",
      team: leader,
      pending,
      decidesOn,
      note: `Conference tournament in progress, ${pending} match${pending === 1 ? "" : "es"} left.`,
    };
  }
  return {
    conf,
    confName: name,
    status: "projected",
    team: leader,
    pending,
    decidesOn,
    note: pending ? null : "Conference tournament not on the schedule yet.",
  };
}

export function buildBracketology(input: BracketologyInput): Bracketology {
  const { teams: allTeams, finals, upcoming, rpiRank, avcaRank, rpiTotal, today } = input;

  const byTeam = new Map<string, Match[]>();
  for (const m of finals) {
    byTeam.set(m.homeSlug, [...(byTeam.get(m.homeSlug) ?? []), m]);
    byTeam.set(m.awaySlug, [...(byTeam.get(m.awaySlug) ?? []), m]);
  }

  const resumes = allTeams
    .filter((t) => t.isD1 && (byTeam.get(t.slug)?.length ?? 0) > 0)
    .map((t) => buildResume(t, byTeam.get(t.slug) ?? [], rpiRank, avcaRank, rpiTotal));

  // Conferences with at least two members award an automatic bid; a lone "independent"
  // bucket does not.
  const byConf = new Map<string, Resume[]>();
  for (const r of resumes) {
    if (r.conf === "independent") continue;
    byConf.set(r.conf, [...(byConf.get(r.conf) ?? []), r]);
  }
  const bids = [...byConf.entries()]
    .filter(([conf, members]) => members.length >= 2 && !NO_AUTO_BID.includes(conf))
    .map(([conf, members]) => conferenceBid(conf, members, finals, upcoming, today))
    .sort((a, b) => a.confName.localeCompare(b.confName));

  const autoSlugs = new Map<string, BidStatus>();
  for (const b of bids) if (b.team) autoSlugs.set(b.team.team.slug, b.status);

  const atLargeSlots = Math.max(0, FIELD_SIZE - autoSlugs.size);
  const pool = resumes.filter((r) => !autoSlugs.has(r.team.slug)).sort(compareResumes);
  const atLarge = pool.slice(0, atLargeSlots);
  const bubble = pool.slice(atLargeSlots, atLargeSlots + BUBBLE_SIZE);

  const chosen = [...resumes.filter((r) => autoSlugs.has(r.team.slug)), ...atLarge].sort(compareResumes);
  const field: FieldEntry[] = chosen.map((resume, i) => ({
    resume,
    seed: i < SEED_COUNT ? i + 1 : null,
    overall: i + 1,
    bid: autoSlugs.has(resume.team.slug) ? "auto" : "at-large",
    bidStatus: autoSlugs.get(resume.team.slug) ?? null,
  }));

  return {
    field,
    seeds: field.slice(0, SEED_COUNT),
    bubble,
    bids,
    atLargeCount: atLarge.length,
    rpiAsOf: input.rpiAsOf,
    avcaAsOf: input.avcaAsOf,
    rpiTotal,
    selectionDone: today >= "2026-11-29",
  };
}

async function latestRankMap(poll: "rpi" | "avca"): Promise<{ asOf: string | null; map: Map<string, number>; total: number }> {
  const d = await db();
  const [latest] = await d
    .select({ asOf: rankings.asOf })
    .from(rankings)
    .where(eq(rankings.poll, poll))
    .orderBy(desc(rankings.fetchedDate), desc(rankings.id))
    .limit(1);
  if (!latest) return { asOf: null, map: new Map(), total: 0 };
  const rows = await d
    .select({ slug: rankings.teamSlug, rank: rankings.rank })
    .from(rankings)
    .where(and(eq(rankings.poll, poll), eq(rankings.asOf, latest.asOf)));
  const map = new Map<string, number>();
  for (const r of rows) if (r.slug) map.set(r.slug, r.rank);
  return { asOf: latest.asOf, map, total: rows.length };
}

/** Load everything the projection needs and run it. */
export async function getBracketology(today = todayEastern()): Promise<Bracketology> {
  const d = await db();
  const [allTeams, finals, upcoming, rpi, avca] = await Promise.all([
    d.select().from(teams),
    d.select().from(matches).where(eq(matches.state, "final")).orderBy(matches.gameDate, matches.startTime),
    d.select().from(matches).where(ne(matches.state, "final")).orderBy(matches.gameDate, matches.startTime),
    latestRankMap("rpi"),
    latestRankMap("avca"),
  ]);
  return buildBracketology({
    teams: allTeams,
    finals,
    upcoming,
    rpiRank: rpi.map,
    avcaRank: avca.map,
    rpiTotal: rpi.total || allTeams.filter((t) => t.isD1).length,
    rpiAsOf: rpi.asOf,
    avcaAsOf: avca.asOf,
    today,
  });
}

/** Resume for one team, for the team page. */
export async function getTeamResume(slug: string): Promise<Resume | null> {
  const d = await db();
  const [team] = await d.select().from(teams).where(eq(teams.slug, slug));
  if (!team) return null;
  const ms = await d
    .select()
    .from(matches)
    .where(and(eq(matches.state, "final"), or(eq(matches.homeSlug, slug), eq(matches.awaySlug, slug))))
    .orderBy(matches.gameDate, matches.startTime);
  const [rpi, avca] = await Promise.all([latestRankMap("rpi"), latestRankMap("avca")]);
  return buildResume(team, ms, rpi.map, avca.map, rpi.total || 348);
}
