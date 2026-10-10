/** Prints ncaa.com teams without an ESPN link, with candidate ESPN teams, plus low-confidence links. */
import fs from "node:fs";
import { isNull } from "drizzle-orm";
import { getDb } from "@/db/client";
import { teams } from "@/db/schema";
import { tokenOverlap } from "@/ingest/names";
import { fetchTeams } from "@/ingest/sources/espn";
import { fetchRankingTable } from "@/ingest/sources/ncaa";

async function main() {
  const espn = await fetchTeams();
  const rpi = (await fetchRankingTable("rpi")).data.map((r) => r["School"]);
  const h = await getDb();
  const unmatched = await h.db.select().from(teams).where(isNull(teams.espnId));
  const cw = fs.readFileSync("data/team-crosswalk.csv", "utf8").split("\n").filter(Boolean);
  const usedIds = new Set(cw.slice(1).map((l) => l.split(",")[2]));
  console.log("unmatched:", unmatched.length, "| of which in RPI (D1):", unmatched.filter((t) => rpi.includes(t.shortName)).length);
  for (const t of unmatched) {
    const d1 = rpi.includes(t.shortName) ? "D1" : "  ";
    const cands = espn
      .filter((e) => !usedIds.has(e.id))
      .map((e) => ({
        e,
        s: Math.max(tokenOverlap(t.shortName, e.location ?? ""), tokenOverlap(t.shortName, e.displayName ?? ""), tokenOverlap(t.slug.replace(/-/g, " "), e.displayName ?? "")),
      }))
      .sort((a, b) => b.s - a.s)
      .slice(0, 3)
      .map((c) => `${c.e.id}:${c.e.displayName}(${c.s.toFixed(2)})`);
    console.log(`${d1} ${t.slug.padEnd(22)} ${t.shortName.padEnd(22)} ${(t.conferenceSlug ?? "-").padEnd(14)}`, cands.join(" | "));
  }
  console.log("\n-- low-confidence fuzzy links:");
  for (const l of cw.slice(1)) {
    const [slug, short, , name, method] = l.split(",");
    if (method?.startsWith("fuzzy") && Number(method.split(":")[1]) < 0.75) console.log(slug.padEnd(22), short.padEnd(22), "->", name, method);
  }
  console.log("\n-- unused ESPN teams:", espn.filter((e) => !usedIds.has(e.id)).map((e) => `${e.id}:${e.displayName}`).join(" | "));
  await h.close();
}
main();
