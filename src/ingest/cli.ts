/**
 * Ingestion CLI.
 *
 *   pnpm ingest scores [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--date YYYY-MM-DD]
 *   pnpm ingest today                      # yesterday, today and tomorrow
 *   pnpm ingest teams [--rebuild]          # link ncaa.com teams to ESPN (logos)
 *   pnpm ingest boxscores [--team slug] [--conference slug] [--limit N] [--refresh]
 *   pnpm ingest rankings [--poll avca|rpi|committee]
 *   pnpm ingest stats
 *   pnpm ingest backfill                   # full season: scores, teams, rankings, stats, boxscores
 *   pnpm ingest nightly                    # last 3 days + next 7 days of scores, rankings, stats, new boxscores
 */
import { eq } from "drizzle-orm";
import { getDb } from "@/db/client";
import { ingestRuns } from "@/db/schema";
import { SEASON_END, SEASON_START, addDays, dateRange, isValidYmd, todayEastern } from "@/lib/season";
import { ingestScores } from "./jobs/scores";
import { linkTeams } from "./jobs/teams";
import { ingestBoxscores } from "./jobs/boxscores";
import { ingestRankings } from "./jobs/rankings";
import { ingestStats } from "./jobs/stats";
import { log } from "./jobs/common";

function parseArgs(argv: string[]) {
  const [job, ...rest] = argv;
  const flags: Record<string, string | true> = {};
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = rest[i + 1];
      if (next && !next.startsWith("--")) {
        flags[key] = next;
        i++;
      } else flags[key] = true;
    }
  }
  return { job, flags };
}

function str(v: string | true | undefined): string | undefined {
  return typeof v === "string" ? v : undefined;
}

async function main() {
  const { job, flags } = parseArgs(process.argv.slice(2));
  if (!job) {
    console.error("usage: pnpm ingest <scores|today|teams|boxscores|rankings|stats|backfill|nightly> [flags]");
    process.exit(2);
  }
  const holder = await getDb();
  const db = holder.db;
  const [run] = await db.insert(ingestRuns).values({ job, args: JSON.stringify(flags) }).returning({ id: ingestRuns.id });
  const today = todayEastern();
  let rows = 0;
  try {
    switch (job) {
      case "scores": {
        const date = str(flags.date);
        const from = str(flags.from) ?? date ?? addDays(today, -1);
        const to = str(flags.to) ?? date ?? today;
        if (!isValidYmd(from) || !isValidYmd(to)) throw new Error("bad --from/--to/--date");
        rows = await ingestScores(db, [...dateRange(from, to)]);
        break;
      }
      case "today":
        rows = await ingestScores(db, [addDays(today, -1), today, addDays(today, 1)]);
        break;
      case "teams":
        rows = await linkTeams(db, { rebuild: flags.rebuild === true });
        break;
      case "boxscores":
        rows = await ingestBoxscores(db, {
          team: str(flags.team),
          conference: str(flags.conference),
          limit: flags.limit ? Number(flags.limit) : undefined,
          refresh: flags.refresh === true,
        });
        break;
      case "rankings": {
        const poll = str(flags.poll) as "avca" | "rpi" | "committee" | undefined;
        rows = await ingestRankings(db, poll ? [poll] : undefined);
        break;
      }
      case "stats":
        rows = await ingestStats(db);
        break;
      case "backfill": {
        const from = str(flags.from) ?? SEASON_START;
        const to = str(flags.to) ?? SEASON_END;
        rows += await ingestScores(db, [...dateRange(from, to)]);
        await linkTeams(db);
        rows += await ingestScores(db, [...dateRange(from, to)]); // second pass attaches ESPN set scores
        rows += await ingestRankings(db);
        rows += await ingestStats(db);
        rows += await ingestBoxscores(db, { limit: flags.limit ? Number(flags.limit) : undefined });
        break;
      }
      case "nightly": {
        rows += await ingestScores(db, [...dateRange(addDays(today, -3), addDays(today, 7))]); // recent results + upcoming week
        rows += await ingestRankings(db);
        rows += await ingestStats(db);
        rows += await ingestBoxscores(db);
        break;
      }
      default:
        throw new Error(`unknown job ${job}`);
    }
    await db.update(ingestRuns).set({ finishedAt: new Date(), ok: true, rows }).where(eq(ingestRuns.id, run.id));
    log(`${job}: done, ${rows} rows`);
  } catch (err) {
    await db
      .update(ingestRuns)
      .set({ finishedAt: new Date(), ok: false, rows, error: (err as Error).stack ?? String(err) })
      .where(eq(ingestRuns.id, run.id));
    console.error(err);
    process.exitCode = 1;
  } finally {
    await holder.close();
  }
}

main();
