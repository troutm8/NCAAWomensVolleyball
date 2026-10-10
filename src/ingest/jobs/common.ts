import { eq } from "drizzle-orm";
import type { Db } from "@/db/client";
import { teams } from "@/db/schema";
import { normalizeName, tokenOverlap } from "../names";

export type TeamIndex = {
  bySlug: Map<string, typeof teams.$inferSelect>;
  byNorm: Map<string, string>;
  byEspnId: Map<string, string>;
  resolve: (name: string) => string | null;
};

/** Load every team and build lookups for linking names from rankings and stat tables. */
export async function loadTeamIndex(db: Db): Promise<TeamIndex> {
  const rows = await db.select().from(teams);
  const bySlug = new Map<string, typeof teams.$inferSelect>();
  const byNorm = new Map<string, string>();
  const byEspnId = new Map<string, string>();
  for (const t of rows) {
    bySlug.set(t.slug, t);
    byNorm.set(normalizeName(t.shortName), t.slug);
    if (t.fullName) byNorm.set(normalizeName(t.fullName), t.slug);
    if (t.espnName) byNorm.set(normalizeName(t.espnName), t.slug);
    if (t.espnId) byEspnId.set(t.espnId, t.slug);
  }
  const cache = new Map<string, string | null>();
  const resolve = (name: string): string | null => {
    if (cache.has(name)) return cache.get(name)!;
    const norm = normalizeName(name);
    let hit: string | null = byNorm.get(norm) ?? null;
    if (!hit) {
      let best = 0;
      let bestSlug: string | null = null;
      let ties = 0;
      for (const t of rows) {
        const s = tokenOverlap(name, t.shortName);
        if (s > best) {
          best = s;
          bestSlug = t.slug;
          ties = 0;
        } else if (s === best && s > 0) ties++;
      }
      hit = best >= 0.75 && ties === 0 ? bestSlug : null;
    }
    cache.set(name, hit);
    return hit;
  };
  return { bySlug, byNorm, byEspnId, resolve };
}

export async function upsertTeamStub(
  db: Db,
  t: { slug: string; shortName: string; char6?: string | null; conferenceSlug?: string | null },
) {
  await db
    .insert(teams)
    .values({ slug: t.slug, shortName: t.shortName, char6: t.char6 ?? null, conferenceSlug: t.conferenceSlug ?? null })
    .onConflictDoUpdate({
      target: teams.slug,
      set: {
        shortName: t.shortName,
        ...(t.char6 ? { char6: t.char6 } : {}),
        ...(t.conferenceSlug ? { conferenceSlug: t.conferenceSlug } : {}),
        updatedAt: new Date(),
      },
    });
}

export async function getTeam(db: Db, slug: string) {
  const [t] = await db.select().from(teams).where(eq(teams.slug, slug));
  return t ?? null;
}

export const log = (...args: unknown[]) => console.log(new Date().toISOString(), ...args);
