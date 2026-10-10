import { and, eq, or } from "drizzle-orm";
import type { Db } from "@/db/client";
import { matches, teams } from "@/db/schema";
import * as ncaa from "../sources/ncaa";
import * as espn from "../sources/espn";
import { parseIntOrNull } from "../names";
import { loadTeamIndex, log, upsertTeamStub } from "./common";

function stateOf(s: string): "pre" | "live" | "final" {
  return s === "live" || s === "final" ? s : "pre";
}

/** Load one day's matches from ncaa.com, then attach ESPN set scores when the teams are linked. */
export async function ingestScoresForDate(db: Db, ymd: string): Promise<number> {
  const board = await ncaa.fetchScoreboard(ymd);
  let n = 0;
  for (const { game } of board.games) {
    const gameDate = ncaa.ncaaDateToYmd(game.startDate) ?? ymd;
    for (const side of [game.home, game.away]) {
      await upsertTeamStub(db, {
        slug: side.names.seo,
        shortName: side.names.short,
        char6: side.names.char6,
        conferenceSlug: side.conferences?.[0]?.conferenceSeo || null,
      });
    }
    const homeConf = game.home.conferences?.[0]?.conferenceSeo || null;
    const awayConf = game.away.conferences?.[0]?.conferenceSeo || null;
    const epoch = parseIntOrNull(game.startTimeEpoch);
    const row = {
      id: game.gameID,
      gameDate,
      startTime: epoch ? new Date(epoch * 1000) : null,
      homeSlug: game.home.names.seo,
      awaySlug: game.away.names.seo,
      homeSets: parseIntOrNull(game.home.score),
      awaySets: parseIntOrNull(game.away.score),
      state: stateOf(game.gameState),
      period: game.currentPeriod || null,
      homeRank: parseIntOrNull(game.home.rank),
      awayRank: parseIntOrNull(game.away.rank),
      homeConfSlug: homeConf,
      awayConfSlug: awayConf,
      conferenceMatch: !!homeConf && homeConf === awayConf,
      broadcast: game.network || null,
      updatedAt: new Date(),
    };
    await db
      .insert(matches)
      .values(row)
      .onConflictDoUpdate({ target: matches.id, set: row });
    n++;
  }

  await enrichFromEspn(db, ymd);
  return n;
}

/** Attach ESPN event ids, set-by-set scores, venue and broadcast to the day's matches. */
export async function enrichFromEspn(db: Db, ymd: string): Promise<number> {
  const idx = await loadTeamIndex(db);
  if (idx.byEspnId.size === 0) return 0;
  let board: Awaited<ReturnType<typeof espn.fetchScoreboard>>;
  try {
    board = await espn.fetchScoreboard(ymd);
  } catch (err) {
    log("espn scoreboard failed", ymd, (err as Error).message);
    return 0;
  }
  let n = 0;
  for (const ev of board.events) {
    const comp = ev.competitions[0];
    const home = comp.competitors.find((c) => c.homeAway === "home");
    const away = comp.competitors.find((c) => c.homeAway === "away");
    if (!home || !away) continue;
    const hs = idx.byEspnId.get(home.team.id);
    const as = idx.byEspnId.get(away.team.id);
    if (!hs || !as) continue;
    const found = await db
      .select({ id: matches.id, homeSlug: matches.homeSlug })
      .from(matches)
      .where(
        and(
          eq(matches.gameDate, ymd),
          or(
            and(eq(matches.homeSlug, hs), eq(matches.awaySlug, as)),
            and(eq(matches.homeSlug, as), eq(matches.awaySlug, hs)),
          ),
        ),
      );
    if (found.length !== 1) continue;
    const m = found[0];
    let sets = espn.setScoresOf(ev);
    if (sets && m.homeSlug !== hs) sets = sets.map((s) => ({ home: s.away, away: s.home }));
    const venueName = comp.venue?.fullName
      ? `${comp.venue.fullName}${comp.venue.address?.city ? ` (${comp.venue.address.city}${comp.venue.address.state ? `, ${comp.venue.address.state}` : ""})` : ""}`
      : null;
    const broadcast = comp.broadcasts?.flatMap((b) => b.names ?? []).join(", ") || null;
    await db
      .update(matches)
      .set({
        espnEventId: ev.id,
        ...(sets ? { setScores: sets } : {}),
        ...(venueName ? { venue: venueName } : {}),
        ...(broadcast ? { broadcast } : {}),
        ...(comp.neutralSite != null ? { neutral: comp.neutralSite } : {}),
      })
      .where(eq(matches.id, m.id));
    n++;
  }
  return n;
}

export async function ingestScores(db: Db, dates: string[]): Promise<number> {
  let total = 0;
  for (const d of dates) {
    const n = await ingestScoresForDate(db, d);
    log(`scores ${d}: ${n} matches`);
    total += n;
  }
  return total;
}

/** Slugs of teams that have an ESPN id, for diagnostics. */
export async function linkedTeamCount(db: Db) {
  const rows = await db.select({ slug: teams.slug, espnId: teams.espnId }).from(teams);
  return rows.filter((r) => r.espnId).length;
}
