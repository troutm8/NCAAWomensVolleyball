import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { rankings, teams, type Poll } from "@/db/schema";
import { inArray, notInArray } from "drizzle-orm";
import * as ncaa from "../sources/ncaa";
import { parseIntOrNull, stripVotes } from "../names";
import { loadTeamIndex, log } from "./common";
import { SEASON_YEAR, todayEastern } from "@/lib/season";

/** Case-insensitive lookup of a column in an ncaa.com table row. */
function col(row: Record<string, string>, ...names: string[]): string | undefined {
  const keys = Object.keys(row);
  for (const n of names) {
    const k = keys.find((x) => x.trim().toLowerCase() === n.toLowerCase());
    if (k) return row[k];
  }
  return undefined;
}

/**
 * Whether an upstream "updated" label belongs to the current season.
 *
 * ncaa.com leaves last season's table in place until the new one is published — the
 * committee's top 16 served "Through Games OCT. 18, 2025" well into October 2026 — and a
 * stale table looks exactly like a current one apart from the year in this label.
 * Labels without a year (e.g. "fetched 2026-10-11") are accepted.
 */
export function isCurrentSeasonLabel(asOf: string, seasonYear = SEASON_YEAR): boolean {
  const years = [...asOf.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => Number(m[0]));
  if (!years.length) return true;
  // The season spans one calendar year here; the championship is in December 2026.
  return years.some((y) => y === seasonYear);
}

export async function ingestRanking(db: Db, poll: Poll): Promise<number> {
  const table = await ncaa.fetchRankingTable(poll);
  const asOf = (table.updated ?? "").trim() || `fetched ${todayEastern()}`;
  if (!isCurrentSeasonLabel(asOf)) {
    // Drop anything a previous run stored from the stale table, then leave the poll empty
    // so the page says "not loaded yet" instead of showing last season as current.
    await db.delete(rankings).where(and(eq(rankings.poll, poll), eq(rankings.asOf, asOf)));
    log(`rankings ${poll}: skipped, upstream table is not from ${SEASON_YEAR} ("${asOf}")`);
    return 0;
  }
  const idx = await loadTeamIndex(db);
  const rows = [];
  for (const r of table.data) {
    const rank = parseIntOrNull(col(r, "rank"));
    const rawName = col(r, "school", "team") ?? "";
    if (!rank || !rawName.trim()) continue;
    const { name, votes } = stripVotes(rawName);
    const slug = idx.resolve(name);
    if (!slug) log(`rankings ${poll}: no team for "${name}"`);
    rows.push({
      poll,
      asOf,
      fetchedDate: todayEastern(),
      rank,
      teamName: name,
      teamSlug: slug,
      record: col(r, "record") ?? null,
      prevRank: parseIntOrNull(col(r, "previous rank", "prev")),
      points: parseIntOrNull(col(r, "total points", "points")),
      firstPlaceVotes: votes,
      conference: col(r, "conf", "conference") ?? null,
      homeRecord: col(r, "home") ?? null,
      roadRecord: col(r, "road") ?? null,
      neutralRecord: col(r, "neutral") ?? null,
    });
  }
  if (!rows.length) {
    log(`rankings ${poll}: empty table (${table.title})`);
    return 0;
  }
  await db.delete(rankings).where(and(eq(rankings.poll, poll), eq(rankings.asOf, asOf)));
  for (let i = 0; i < rows.length; i += 100) await db.insert(rankings).values(rows.slice(i, i + 100));
  if (poll === "rpi") {
    // The RPI table lists every Division I program: use it to flag D1 membership and conference names.
    const d1 = rows.map((r) => r.teamSlug).filter((s): s is string => !!s);
    if (d1.length > 300) {
      await db.update(teams).set({ isD1: true }).where(inArray(teams.slug, d1));
      await db.update(teams).set({ isD1: false }).where(notInArray(teams.slug, d1));
      for (const r of rows) if (r.teamSlug && r.conference) await db.update(teams).set({ conferenceName: r.conference }).where(eq(teams.slug, r.teamSlug));
    }
  }
  log(`rankings ${poll}: ${rows.length} rows (${asOf})`);
  return rows.length;
}

export async function ingestRankings(db: Db, polls: Poll[] = ["avca", "rpi", "committee"]): Promise<number> {
  let n = 0;
  for (const p of polls) {
    try {
      n += await ingestRanking(db, p);
    } catch (err) {
      log(`rankings ${p} failed:`, (err as Error).message);
    }
  }
  return n;
}
