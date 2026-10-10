import { describe, expect, it } from "vitest";
import { computeRecord } from "./queries";
import type { Match } from "@/db/schema";

const base = { startTime: null, period: null, homeRank: null, awayRank: null, homeConfSlug: null, awayConfSlug: null, venue: null, broadcast: null, espnEventId: null, setScores: null, boxscoreLoaded: false, updatedAt: new Date() };
const m = (o: Partial<Match> & Pick<Match, "id" | "homeSlug" | "awaySlug" | "homeSets" | "awaySets">): Match => ({
  gameDate: "2026-09-01",
  state: "final",
  conferenceMatch: false,
  neutral: false,
  ...base,
  ...o,
});

describe("computeRecord", () => {
  it("counts wins, losses, splits, streak and last 5", () => {
    const ms = [
      m({ id: "1", homeSlug: "stanford", awaySlug: "a", homeSets: 3, awaySets: 0 }),
      m({ id: "2", homeSlug: "b", awaySlug: "stanford", homeSets: 3, awaySets: 2, awayRank: 3, homeRank: 1 }),
      m({ id: "3", homeSlug: "stanford", awaySlug: "c", homeSets: 3, awaySets: 1, conferenceMatch: true }),
      m({ id: "4", homeSlug: "d", awaySlug: "stanford", homeSets: 0, awaySets: 3, neutral: true, conferenceMatch: true }),
      m({ id: "5", homeSlug: "stanford", awaySlug: "e", homeSets: null, awaySets: null, state: "pre" }),
    ];
    const r = computeRecord("stanford", ms);
    expect([r.wins, r.losses]).toEqual([3, 1]);
    expect([r.confWins, r.confLosses]).toEqual([2, 0]);
    expect(r.home).toEqual([2, 0]);
    expect(r.away).toEqual([0, 1]);
    expect(r.neutral).toEqual([1, 0]);
    expect(r.vsRanked).toEqual([0, 1]);
    expect(r.streak).toBe("W2");
    expect(r.last5).toEqual(["W", "L", "W", "W"]);
    expect([r.setsWon, r.setsLost]).toEqual([11, 4]);
  });
});
