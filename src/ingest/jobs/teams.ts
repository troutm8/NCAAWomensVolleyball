import fs from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { teams } from "@/db/schema";
import * as espn from "../sources/espn";
import { normalizeName, tokenOverlap } from "../names";
import { log } from "./common";

const CROSSWALK = path.join(process.cwd(), "data", "team-crosswalk.csv");
const OVERRIDES = path.join(process.cwd(), "data", "team-crosswalk-overrides.csv");

type Row = { slug: string; short_name: string; espn_id: string; espn_name: string; method: string };

function readCsv(file: string): Record<string, string>[] {
  if (!fs.existsSync(file)) return [];
  const lines = fs.readFileSync(file, "utf8").split(/\r?\n/).filter((l) => l.trim() && !l.startsWith("#"));
  const header = lines.shift()!.split(",");
  return lines.map((l) => {
    const cells = l.split(",");
    return Object.fromEntries(header.map((h, i) => [h.trim(), (cells[i] ?? "").trim()]));
  });
}

function writeCsv(file: string, rows: Row[]) {
  const header = "slug,short_name,espn_id,espn_name,method";
  const body = rows.map((r) => [r.slug, r.short_name, r.espn_id, r.espn_name, r.method].map((c) => c.replace(/,/g, " ")).join(","));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, [header, ...body].join("\n") + "\n");
}

/**
 * Link ncaa.com teams (already in the DB from scoreboards) to ESPN teams.
 * With rebuild=false the committed data/team-crosswalk.csv is authoritative and only
 * ESPN metadata (logo, colors) is refreshed. With rebuild=true the crosswalk is
 * recomputed by name matching, honoring data/team-crosswalk-overrides.csv.
 */
export async function linkTeams(db: Db, opts: { rebuild?: boolean } = {}): Promise<number> {
  const espnTeams = await espn.fetchTeams();
  const espnById = new Map(espnTeams.map((t) => [t.id, t]));
  const ncaaTeams = await db.select().from(teams);

  let rows: Row[];
  const existing = readCsv(CROSSWALK);
  if (!opts.rebuild && existing.length) {
    rows = existing as unknown as Row[];
  } else {
    const overrides = new Map(readCsv(OVERRIDES).map((r) => [r.slug, r.espn_id]));
    const used = new Set<string>();
    rows = [];
    const unmatched: string[] = [];
    // Pass 1: overrides + exact normalized matches.
    const byNorm = new Map<string, string[]>();
    for (const t of espnTeams) {
      for (const n of [t.location, t.displayName, t.shortDisplayName, t.nickname]) {
        if (!n) continue;
        const k = normalizeName(n);
        byNorm.set(k, [...(byNorm.get(k) ?? []), t.id]);
      }
    }
    const pending: typeof ncaaTeams = [];
    for (const t of ncaaTeams) {
      const ov = overrides.get(t.slug);
      if (ov) {
        if (ov !== "none") {
          rows.push({ slug: t.slug, short_name: t.shortName, espn_id: ov, espn_name: espnById.get(ov)?.displayName ?? "", method: "override" });
          used.add(ov);
        }
        continue;
      }
      const cands = [t.shortName, t.fullName ?? "", t.slug.replace(/-/g, " ")]
        .filter(Boolean)
        .flatMap((n) => byNorm.get(normalizeName(n)) ?? []);
      const uniq = [...new Set(cands)].filter((id) => !used.has(id));
      if (uniq.length === 1) {
        rows.push({ slug: t.slug, short_name: t.shortName, espn_id: uniq[0], espn_name: espnById.get(uniq[0])!.displayName ?? "", method: "exact" });
        used.add(uniq[0]);
      } else pending.push(t);
    }
    // Pass 2: fuzzy token overlap, unique best above threshold.
    for (const t of pending) {
      let best = 0;
      let bestId: string | null = null;
      let ties = 0;
      for (const e of espnTeams) {
        if (used.has(e.id)) continue;
        const s = Math.max(
          tokenOverlap(t.shortName, e.location ?? ""),
          tokenOverlap(t.shortName, e.displayName ?? ""),
          tokenOverlap(t.fullName ?? "", e.displayName ?? ""),
        );
        if (s > best) {
          best = s;
          bestId = e.id;
          ties = 0;
        } else if (s === best && s > 0) ties++;
      }
      if (bestId && best >= 0.5 && ties === 0) {
        rows.push({ slug: t.slug, short_name: t.shortName, espn_id: bestId, espn_name: espnById.get(bestId)!.displayName ?? "", method: `fuzzy:${best.toFixed(2)}` });
        used.add(bestId);
      } else unmatched.push(`${t.slug} (${t.shortName}${t.fullName ? ` / ${t.fullName}` : ""})`);
    }
    rows.sort((a, b) => a.slug.localeCompare(b.slug));
    writeCsv(CROSSWALK, rows);
    log(`crosswalk: ${rows.length} linked, ${unmatched.length} unmatched`);
    for (const u of unmatched) log("  unmatched:", u);
  }

  let n = 0;
  for (const r of rows) {
    const e = espnById.get(r.espn_id);
    if (!e) {
      log(`crosswalk: espn id ${r.espn_id} for ${r.slug} not in ESPN team list`);
      continue;
    }
    await db
      .update(teams)
      .set({
        espnId: e.id,
        espnName: e.displayName ?? null,
        abbreviation: e.abbreviation ?? null,
        logoUrl: espn.defaultLogo(e),
        color: e.color ? `#${e.color}` : undefined,
        nickname: e.name ?? undefined,
        updatedAt: new Date(),
      })
      .where(eq(teams.slug, r.slug));
    n++;
  }
  return n;
}
