import { z } from "zod";
import { fetchJson } from "../http";

export const ESPN_BASE = "https://site.api.espn.com/apis/site/v2/sports/volleyball/womens-college-volleyball";

const logo = z.object({ href: z.string(), rel: z.array(z.string()).optional() });

const teamRef = z.object({
  id: z.string(),
  location: z.string().optional(),
  name: z.string().optional(),
  nickname: z.string().optional(),
  displayName: z.string().optional(),
  shortDisplayName: z.string().optional(),
  abbreviation: z.string().optional(),
  color: z.string().optional(),
  logo: z.string().optional(),
  logos: z.array(logo).optional(),
});

const competitor = z.object({
  id: z.string(),
  homeAway: z.enum(["home", "away"]),
  winner: z.boolean().optional(),
  team: teamRef,
  score: z.string().optional(),
  linescores: z.array(z.object({ value: z.number().optional(), displayValue: z.string().optional() })).optional(),
  curatedRank: z.object({ current: z.number().optional() }).optional(),
  records: z.array(z.object({ type: z.string().optional(), summary: z.string().optional() })).optional(),
});

export const espnEvent = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string().optional(),
  shortName: z.string().optional(),
  competitions: z
    .array(
      z.object({
        id: z.string(),
        date: z.string().optional(),
        neutralSite: z.boolean().optional(),
        conferenceCompetition: z.boolean().optional(),
        venue: z
          .object({
            fullName: z.string().optional(),
            address: z.object({ city: z.string().optional(), state: z.string().optional() }).optional(),
          })
          .optional(),
        competitors: z.array(competitor),
        status: z.object({
          period: z.number().optional(),
          type: z.object({
            state: z.string(),
            completed: z.boolean(),
            description: z.string().optional(),
            detail: z.string().optional(),
            shortDetail: z.string().optional(),
          }),
        }),
        broadcasts: z.array(z.object({ names: z.array(z.string()).optional() })).optional(),
      }),
    )
    .min(1),
});
export type EspnEvent = z.infer<typeof espnEvent>;

export const scoreboardSchema = z.object({ events: z.array(espnEvent) });

export const rankingsSchema = z.object({
  rankings: z.array(
    z.object({
      name: z.string().optional(),
      shortName: z.string().optional(),
      occurrence: z.object({ displayValue: z.string().optional(), number: z.number().optional() }).optional(),
      date: z.string().optional(),
      lastUpdated: z.string().optional(),
      ranks: z.array(
        z.object({
          current: z.number(),
          previous: z.number().optional(),
          points: z.number().optional(),
          firstPlaceVotes: z.number().optional(),
          trend: z.string().optional(),
          recordSummary: z.string().optional(),
          team: teamRef,
        }),
      ),
    }),
  ),
});

export const teamsSchema = z.object({
  sports: z.array(
    z.object({
      leagues: z.array(z.object({ teams: z.array(z.object({ team: teamRef })) })),
    }),
  ),
});

export async function fetchScoreboard(ymd: string) {
  const raw = await fetchJson(`${ESPN_BASE}/scoreboard?dates=${ymd.replace(/-/g, "")}&limit=400`);
  return scoreboardSchema.parse(raw);
}

export async function fetchRankings() {
  return rankingsSchema.parse(await fetchJson(`${ESPN_BASE}/rankings`));
}

export async function fetchTeams() {
  const parsed = teamsSchema.parse(await fetchJson(`${ESPN_BASE}/teams?limit=500`));
  return parsed.sports[0]?.leagues[0]?.teams.map((t) => t.team) ?? [];
}

export function defaultLogo(t: z.infer<typeof teamRef>): string | null {
  if (t.logo) return t.logo;
  const l = t.logos?.find((x) => x.rel?.includes("default")) ?? t.logos?.[0];
  return l?.href ?? null;
}

/** Set scores as [{home, away}] from an ESPN competition, or null if not available. */
export function setScoresOf(ev: EspnEvent): { home: number; away: number }[] | null {
  const comp = ev.competitions[0];
  const home = comp.competitors.find((c) => c.homeAway === "home");
  const away = comp.competitors.find((c) => c.homeAway === "away");
  if (!home?.linescores?.length || !away?.linescores?.length) return null;
  const n = Math.min(home.linescores.length, away.linescores.length);
  const out: { home: number; away: number }[] = [];
  for (let i = 0; i < n; i++) {
    const h = home.linescores[i].value ?? Number(home.linescores[i].displayValue);
    const a = away.linescores[i].value ?? Number(away.linescores[i].displayValue);
    if (!Number.isFinite(h) || !Number.isFinite(a)) break;
    out.push({ home: h, away: a });
  }
  return out.length ? out : null;
}
