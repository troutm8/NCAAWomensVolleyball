import { z } from "zod";
import { fetchJson } from "../http";

export const NCAA_API_BASE = (process.env.NCAA_API_BASE ?? "https://ncaa-api.henrygd.me").replace(/\/$/, "");
const SPORT = "volleyball-women/d1";

const side = z.object({
  score: z.string(),
  names: z.object({ char6: z.string(), short: z.string(), seo: z.string(), full: z.string().optional() }),
  winner: z.boolean().optional(),
  rank: z.string().optional(),
  conferences: z.array(z.object({ conferenceName: z.string().optional(), conferenceSeo: z.string().optional() })).optional(),
});

export const scoreboardGame = z.object({
  gameID: z.string(),
  away: side,
  home: side,
  finalMessage: z.string().optional(),
  title: z.string().optional(),
  url: z.string().optional(),
  network: z.string().optional(),
  startTime: z.string().optional(),
  startTimeEpoch: z.string().optional(),
  gameState: z.enum(["pre", "live", "final"]).or(z.string()),
  startDate: z.string().optional(), // MM/DD/YYYY
  currentPeriod: z.string().optional(),
  bracketId: z.string().optional(),
  bracketRound: z.string().optional(),
});

export const scoreboardSchema = z.object({
  updated_at: z.string().optional(),
  games: z.array(z.object({ game: scoreboardGame })),
});
export type NcaaGame = z.infer<typeof scoreboardGame>;

export const tableSchema = z.object({
  sport: z.string().optional(),
  title: z.string().optional(),
  updated: z.string().optional(),
  page: z.number().optional(),
  pages: z.number().optional(),
  data: z.array(z.record(z.string(), z.string())),
});
export type NcaaTable = z.infer<typeof tableSchema>;

const playerStat = z.object({
  firstName: z.string(),
  lastName: z.string(),
  position: z.string().nullable().optional(),
  number: z.coerce.number().nullable().optional(),
  gamesPlayed: z.string().nullable().optional(),
  ballHandlingErrors: z.string().nullable().optional(),
  points: z.string().nullable().optional(),
  kills: z.string().nullable().optional(),
  attackErrors: z.string().nullable().optional(),
  attackAttempts: z.string().nullable().optional(),
  hittingPercentage: z.string().nullable().optional(),
  assists: z.string().nullable().optional(),
  serviceAces: z.string().nullable().optional(),
  serviceErrors: z.string().nullable().optional(),
  digs: z.string().nullable().optional(),
  receptionErrors: z.string().nullable().optional(),
  blockSolos: z.string().nullable().optional(),
  blockAssists: z.string().nullable().optional(),
  blockingErrors: z.string().nullable().optional(),
  totalBlocks: z.string().nullable().optional(),
  starter: z.boolean().nullable().optional(),
  participated: z.boolean().nullable().optional(),
});

const teamStat = z.object({
  points: z.string().nullable().optional(),
  kills: z.string().nullable().optional(),
  attackErrors: z.string().nullable().optional(),
  attackAttempts: z.string().nullable().optional(),
  hittingPercentage: z.string().nullable().optional(),
  assists: z.string().nullable().optional(),
  serviceAces: z.string().nullable().optional(),
  serviceErrors: z.string().nullable().optional(),
  digs: z.string().nullable().optional(),
  receptionErrors: z.string().nullable().optional(),
  blockSolos: z.string().nullable().optional(),
  blockAssists: z.string().nullable().optional(),
  blockingErrors: z.string().nullable().optional(),
  totalBlocks: z.string().nullable().optional(),
  ballHandlingErrors: z.string().nullable().optional(),
});

export const boxscoreSchema = z.object({
  contestId: z.coerce.number(),
  status: z.string().nullable().optional(),
  period: z.string().nullable().optional(),
  teams: z.array(
    z.object({
      isHome: z.boolean(),
      teamId: z.coerce.number(),
      seoname: z.string(),
      name6Char: z.string().nullable().optional(),
      nameFull: z.string().nullable().optional(),
      nameShort: z.string().nullable().optional(),
      teamName: z.string().nullable().optional(),
      color: z.string().nullable().optional(),
    }),
  ),
  teamBoxscore: z.array(
    z.object({
      teamId: z.coerce.number(),
      playerStats: z.array(playerStat).optional().default([]),
      teamStats: teamStat.nullable().optional(),
    }),
  ),
});
export type NcaaBoxscore = z.infer<typeof boxscoreSchema>;

export async function fetchScoreboard(ymd: string): Promise<z.infer<typeof scoreboardSchema>> {
  const [y, m, d] = ymd.split("-");
  const raw = await fetchJson(`${NCAA_API_BASE}/scoreboard/${SPORT}/${y}/${m}/${d}/all-conf`);
  return scoreboardSchema.parse(raw);
}

export const RANKING_PATHS = {
  rpi: "ncaa-womens-volleyball-rpi",
  avca: "avca-coaches",
  committee: "di-committees-top-10",
} as const;

export async function fetchRankingTable(poll: keyof typeof RANKING_PATHS): Promise<NcaaTable> {
  const raw = await fetchJson(`${NCAA_API_BASE}/rankings/${SPORT}/${RANKING_PATHS[poll]}`);
  return tableSchema.parse(raw);
}

export const INDIVIDUAL_STATS: Record<number, string> = {
  1: "Hitting Percentage",
  2: "Kills Per Set",
  3: "Assists Per Set",
  42: "Aces Per Set",
  43: "Blocks Per Set",
  44: "Digs Per Set",
};
export const TEAM_STATS: Record<number, string> = {
  45: "Hitting Percentage",
  46: "Kills Per Set",
  47: "Assists Per Set",
  48: "Aces Per Set",
  49: "Blocks Per Set",
  50: "Digs Per Set",
};

export async function fetchStatTable(scope: "individual" | "team", statId: number, page = 1): Promise<NcaaTable> {
  const q = page > 1 ? `?page=${page}` : "";
  const raw = await fetchJson(`${NCAA_API_BASE}/stats/${SPORT}/current/${scope}/${statId}${q}`);
  return tableSchema.parse(raw);
}

export async function fetchBoxscore(gameId: string): Promise<NcaaBoxscore> {
  const raw = await fetchJson(`${NCAA_API_BASE}/game/${gameId}/boxscore`);
  return boxscoreSchema.parse(raw);
}

/** ncaa.com writes dates as MM/DD/YYYY; return YYYY-MM-DD. */
export function ncaaDateToYmd(s: string | undefined): string | null {
  if (!s) return null;
  const m = s.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[1]}-${m[2]}` : null;
}
