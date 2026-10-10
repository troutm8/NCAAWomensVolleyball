import { and, eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { statLeaders } from "@/db/schema";
import * as ncaa from "../sources/ncaa";
import { parseIntOrNull, parseNumOrNull } from "../names";
import { loadTeamIndex, log } from "./common";
import { todayEastern } from "@/lib/season";

async function ingestStatTable(db: Db, scope: "individual" | "team", statId: number, maxPages: number) {
  const first = await ncaa.fetchStatTable(scope, statId, 1);
  const pages = Math.min(first.pages ?? 1, maxPages);
  const tables = [first];
  for (let p = 2; p <= pages; p++) tables.push(await ncaa.fetchStatTable(scope, statId, p));
  const asOf = (first.updated ?? "").trim() || `fetched ${todayEastern()}`;
  const category = first.title ?? (scope === "team" ? ncaa.TEAM_STATS[statId] : ncaa.INDIVIDUAL_STATS[statId]) ?? String(statId);
  const idx = await loadTeamIndex(db);
  const rows = [];
  for (const t of tables) {
    for (const r of t.data) {
      const keys = Object.keys(r);
      const rank = parseIntOrNull(r["Rank"]);
      if (!rank) continue;
      const teamName = (r["Team"] ?? "").trim();
      const valueKey = keys[keys.length - 1];
      rows.push({
        scope,
        statId,
        category,
        asOf,
        fetchedDate: todayEastern(),
        rank,
        playerName: scope === "individual" ? (r["Name"] ?? "").trim() : null,
        teamName,
        teamSlug: teamName ? idx.resolve(teamName) : null,
        classYear: r["Cl"] ?? null,
        position: r["Position"] ?? null,
        sets: parseIntOrNull(r["S"]),
        value: (() => {
          const v = parseNumOrNull(r[valueKey]);
          return v == null ? null : String(v);
        })(),
        raw: r,
      });
    }
  }
  await db.delete(statLeaders).where(and(eq(statLeaders.scope, scope), eq(statLeaders.statId, statId), eq(statLeaders.asOf, asOf)));
  for (let i = 0; i < rows.length; i += 100) await db.insert(statLeaders).values(rows.slice(i, i + 100));
  log(`stats ${scope}/${statId} ${category}: ${rows.length} rows (${asOf})`);
  return rows.length;
}

export async function ingestStats(db: Db): Promise<number> {
  let n = 0;
  for (const id of Object.keys(ncaa.INDIVIDUAL_STATS).map(Number)) {
    try {
      n += await ingestStatTable(db, "individual", id, 2);
    } catch (err) {
      log(`stats individual/${id} failed:`, (err as Error).message);
    }
  }
  for (const id of Object.keys(ncaa.TEAM_STATS).map(Number)) {
    try {
      n += await ingestStatTable(db, "team", id, 10);
    } catch (err) {
      log(`stats team/${id} failed:`, (err as Error).message);
    }
  }
  return n;
}
