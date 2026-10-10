import { and, eq, inArray, or } from "drizzle-orm";
import type { Db } from "@/db/client";
import { matchPlayerStats, matchTeamStats, matches, teams } from "@/db/schema";
import * as ncaa from "../sources/ncaa";
import { HttpError } from "../http";
import { parseIntOrNull, parseNumOrNull } from "../names";
import { log } from "./common";

const numStr = (s: string | null | undefined) => {
  const n = parseNumOrNull(s);
  return n == null ? null : String(n);
};

export async function ingestBoxscore(db: Db, matchId: string): Promise<boolean> {
  let box: ncaa.NcaaBoxscore;
  try {
    box = await ncaa.fetchBoxscore(matchId);
  } catch (err) {
    if (err instanceof HttpError && err.status === 404) {
      await db.update(matches).set({ boxscoreLoaded: true }).where(eq(matches.id, matchId));
      log(`boxscore ${matchId}: not available (404)`);
      return false;
    }
    throw err;
  }
  const slugByTeamId = new Map<number, string>();
  for (const t of box.teams) {
    slugByTeamId.set(t.teamId, t.seoname);
    await db
      .update(teams)
      .set({
        ncaaId: t.teamId,
        ...(t.nameFull ? { fullName: t.nameFull } : {}),
        ...(t.teamName ? { nickname: t.teamName } : {}),
        ...(t.color ? { color: t.color } : {}),
      })
      .where(eq(teams.slug, t.seoname));
  }
  await db.delete(matchPlayerStats).where(eq(matchPlayerStats.matchId, matchId));
  await db.delete(matchTeamStats).where(eq(matchTeamStats.matchId, matchId));
  for (const tb of box.teamBoxscore) {
    const slug = slugByTeamId.get(tb.teamId);
    if (!slug) continue;
    const ts = tb.teamStats;
    if (ts) {
      await db.insert(matchTeamStats).values({
        matchId,
        teamSlug: slug,
        points: parseIntOrNull(ts.points),
        kills: parseIntOrNull(ts.kills),
        attackErrors: parseIntOrNull(ts.attackErrors),
        attackAttempts: parseIntOrNull(ts.attackAttempts),
        hitPct: numStr(ts.hittingPercentage),
        assists: parseIntOrNull(ts.assists),
        serviceAces: parseIntOrNull(ts.serviceAces),
        serviceErrors: parseIntOrNull(ts.serviceErrors),
        digs: parseIntOrNull(ts.digs),
        receptionErrors: parseIntOrNull(ts.receptionErrors),
        blockSolos: parseIntOrNull(ts.blockSolos),
        blockAssists: parseIntOrNull(ts.blockAssists),
        totalBlocks: numStr(ts.totalBlocks),
        blockingErrors: parseIntOrNull(ts.blockingErrors),
        ballHandlingErrors: parseIntOrNull(ts.ballHandlingErrors),
      });
    }
    const players = tb.playerStats.filter((p) => p.participated !== false || parseIntOrNull(p.gamesPlayed));
    if (players.length) {
      await db.insert(matchPlayerStats).values(
        players.map((p) => ({
          matchId,
          teamSlug: slug,
          firstName: p.firstName.trim(),
          lastName: p.lastName.trim(),
          position: p.position ?? null,
          number: p.number ?? null,
          starter: !!p.starter,
          sets: parseIntOrNull(p.gamesPlayed),
          points: numStr(p.points),
          kills: parseIntOrNull(p.kills),
          attackErrors: parseIntOrNull(p.attackErrors),
          attackAttempts: parseIntOrNull(p.attackAttempts),
          hitPct: numStr(p.hittingPercentage),
          assists: parseIntOrNull(p.assists),
          serviceAces: parseIntOrNull(p.serviceAces),
          serviceErrors: parseIntOrNull(p.serviceErrors),
          digs: parseIntOrNull(p.digs),
          receptionErrors: parseIntOrNull(p.receptionErrors),
          blockSolos: parseIntOrNull(p.blockSolos),
          blockAssists: parseIntOrNull(p.blockAssists),
          totalBlocks: numStr(p.totalBlocks),
        })),
      );
    }
  }
  await db.update(matches).set({ boxscoreLoaded: true }).where(eq(matches.id, matchId));
  return true;
}

/** Load box scores for finished matches that do not have one yet. */
export async function ingestBoxscores(
  db: Db,
  opts: { team?: string; conference?: string; limit?: number; refresh?: boolean } = {},
): Promise<number> {
  const conds = [eq(matches.state, "final")];
  if (!opts.refresh) conds.push(eq(matches.boxscoreLoaded, false));
  if (opts.team) conds.push(or(eq(matches.homeSlug, opts.team), eq(matches.awaySlug, opts.team))!);
  if (opts.conference) {
    const confTeams = (await db.select({ slug: teams.slug }).from(teams).where(eq(teams.conferenceSlug, opts.conference))).map((t) => t.slug);
    conds.push(or(inArray(matches.homeSlug, confTeams), inArray(matches.awaySlug, confTeams))!);
  }
  const pending = await db
    .select({ id: matches.id, gameDate: matches.gameDate })
    .from(matches)
    .where(and(...conds))
    .orderBy(matches.gameDate);
  const list = opts.limit ? pending.slice(0, opts.limit) : pending;
  log(`boxscores: ${list.length} to load`);
  let n = 0;
  let failures = 0;
  for (const m of list) {
    try {
      if (await ingestBoxscore(db, m.id)) n++;
    } catch (err) {
      failures++;
      log(`boxscore ${m.id} (${m.gameDate}) failed:`, (err as Error).message);
      if (failures > 25) throw new Error("too many box score failures; stopping");
    }
    if (n % 50 === 0 && n > 0) log(`boxscores: ${n} loaded`);
  }
  return n;
}
