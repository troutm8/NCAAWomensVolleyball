import { describe, expect, it } from "vitest";
import { FIELD_SIZE, SEED_COUNT, buildBracketology, buildResume, conferenceBid } from "./bracketology";
import type { Match, Team } from "@/db/schema";

const baseMatch = {
  startTime: null,
  period: null,
  homeRank: null,
  awayRank: null,
  homeConfSlug: null,
  awayConfSlug: null,
  venue: null,
  broadcast: null,
  espnEventId: null,
  setScores: null,
  boxscoreLoaded: false,
  updatedAt: new Date(),
};

const m = (o: Partial<Match> & Pick<Match, "id" | "homeSlug" | "awaySlug" | "homeSets" | "awaySets">): Match => ({
  gameDate: "2026-09-01",
  state: "final",
  conferenceMatch: false,
  neutral: false,
  ...baseMatch,
  ...o,
});

const team = (slug: string, conf = "pac-12"): Team => ({
  slug,
  ncaaId: null,
  shortName: slug,
  fullName: null,
  nickname: null,
  char6: null,
  conferenceSlug: conf,
  conferenceName: null,
  espnId: null,
  espnName: null,
  abbreviation: null,
  logoUrl: null,
  color: null,
  isD1: true,
  updatedAt: new Date(),
});

/** RPI: rpi-1 is the best team, rpi-300 is a bad one. */
const rpi = new Map<string, number>([
  ["stanford", 5],
  ["rpi-1", 1],
  ["rpi-40", 40],
  ["rpi-80", 80],
  ["rpi-300", 300],
]);
const avca = new Map<string, number>([["stanford", 4]]);

describe("buildResume", () => {
  it("buckets wins and losses by the opponent's current RPI", () => {
    const ms = [
      m({ id: "1", homeSlug: "stanford", awaySlug: "rpi-1", homeSets: 3, awaySets: 1 }),
      m({ id: "2", homeSlug: "rpi-40", awaySlug: "stanford", homeSets: 1, awaySets: 3 }),
      m({ id: "3", homeSlug: "stanford", awaySlug: "rpi-80", homeSets: 3, awaySets: 0 }),
      m({ id: "4", homeSlug: "rpi-300", awaySlug: "stanford", homeSets: 3, awaySets: 2 }),
    ];
    const r = buildResume(team("stanford"), ms, rpi, avca, 348);
    expect(r.quality.top25).toEqual([1, 0]);
    expect(r.quality.top50).toEqual([2, 0]);
    expect(r.quality.top100).toEqual([3, 0]);
    expect(r.badLosses).toBe(1);
    expect(r.worstLossRpi).toBe(300);
    expect(r.roadNeutral).toEqual([1, 1]);
    expect(r.record.wins).toBe(3);
  });

  it("scores a strong resume above a weak one, and keeps components on the published scale", () => {
    const strong = buildResume(
      team("stanford"),
      [
        m({ id: "1", homeSlug: "stanford", awaySlug: "rpi-1", homeSets: 3, awaySets: 0 }),
        m({ id: "2", homeSlug: "rpi-40", awaySlug: "stanford", homeSets: 0, awaySets: 3 }),
      ],
      rpi,
      avca,
      348,
    );
    const weak = buildResume(
      team("rpi-300"),
      [m({ id: "3", homeSlug: "rpi-300", awaySlug: "rpi-80", homeSets: 0, awaySets: 3 })],
      rpi,
      avca,
      348,
    );
    expect(strong.score).toBeGreaterThan(weak.score);
    expect(strong.score).toBeLessThanOrEqual(100);
    expect(weak.score).toBeGreaterThanOrEqual(0);
    // Unranked in the poll contributes nothing rather than dragging the score negative.
    expect(weak.components.poll).toBe(0);
  });

  it("gives a team with no road or neutral matches half credit instead of zero", () => {
    const r = buildResume(
      team("stanford"),
      [m({ id: "1", homeSlug: "stanford", awaySlug: "rpi-80", homeSets: 3, awaySets: 0 })],
      rpi,
      avca,
      348,
    );
    expect(r.roadNeutral).toEqual([0, 0]);
    expect(r.components.road).toBe(2.5);
  });
});

describe("conferenceBid", () => {
  const members = ["a", "b"].map((s) =>
    buildResume(
      team(s, "big-west"),
      [m({ id: `r-${s}`, homeSlug: s, awaySlug: "rpi-80", homeSets: 3, awaySets: 0 })],
      rpi,
      avca,
      348,
    ),
  );

  it("projects the conference leader while matches remain", () => {
    const finals = [m({ id: "c1", homeSlug: "a", awaySlug: "b", homeSets: 3, awaySets: 0, conferenceMatch: true, gameDate: "2026-10-01" })];
    const upcoming = [
      m({ id: "c2", homeSlug: "b", awaySlug: "a", homeSets: null, awaySets: null, state: "pre", conferenceMatch: true, gameDate: "2026-11-20" }),
    ];
    const bid = conferenceBid("big-west", members, finals, upcoming, "2026-10-11");
    expect(bid.status).toBe("projected");
    expect(bid.team?.team.slug).toBe("a");
    expect(bid.pending).toBe(1);
  });

  it("clinches the bid for the winner of the last conference match once nothing is left", () => {
    const finals = [
      m({ id: "c1", homeSlug: "a", awaySlug: "b", homeSets: 3, awaySets: 0, conferenceMatch: true, gameDate: "2026-10-01" }),
      m({ id: "c2", homeSlug: "a", awaySlug: "b", homeSets: 1, awaySets: 3, conferenceMatch: true, gameDate: "2026-11-22", neutral: true }),
    ];
    const bid = conferenceBid("big-west", members, finals, [], "2026-11-23");
    expect(bid.status).toBe("clinched");
    expect(bid.team?.team.slug).toBe("b");
  });

  it("reports a tournament underway when late matches remain", () => {
    const finals = [m({ id: "c1", homeSlug: "a", awaySlug: "b", homeSets: 3, awaySets: 0, conferenceMatch: true, gameDate: "2026-11-20" })];
    const upcoming = [
      m({ id: "c2", homeSlug: "b", awaySlug: "a", homeSets: null, awaySets: null, state: "pre", conferenceMatch: true, gameDate: "2026-11-22" }),
    ];
    const bid = conferenceBid("big-west", members, finals, upcoming, "2026-11-21");
    expect(bid.status).toBe("underway");
    expect(bid.pending).toBe(1);
  });
});

describe("buildBracketology", () => {
  /** 40 conferences of 3 teams each: enough to fill a 64-team field with auto-bids plus at-larges. */
  function syntheticSeason() {
    const allTeams: Team[] = [];
    const finals: Match[] = [];
    const rpiRank = new Map<string, number>();
    let rank = 1;
    for (let c = 0; c < 40; c++) {
      const conf = `conf-${c}`;
      const slugs = [0, 1, 2].map((i) => `t-${c}-${i}`);
      for (const s of slugs) {
        allTeams.push(team(s, conf));
        rpiRank.set(s, rank++);
      }
      // Each team beats the next one in its conference, so index 0 is the leader.
      finals.push(
        m({ id: `${conf}-a`, homeSlug: slugs[0], awaySlug: slugs[1], homeSets: 3, awaySets: 0, conferenceMatch: true, gameDate: "2026-10-02" }),
        m({ id: `${conf}-b`, homeSlug: slugs[1], awaySlug: slugs[2], homeSets: 3, awaySets: 0, conferenceMatch: true, gameDate: "2026-10-03" }),
        m({ id: `${conf}-c`, homeSlug: slugs[0], awaySlug: slugs[2], homeSets: 3, awaySets: 0, conferenceMatch: true, gameDate: "2026-10-04" }),
      );
    }
    return { allTeams, finals, rpiRank };
  }

  it("fills exactly 64 slots: one auto-bid per conference plus the best at-larges", () => {
    const { allTeams, finals, rpiRank } = syntheticSeason();
    const b = buildBracketology({
      teams: allTeams,
      finals,
      upcoming: [m({ id: "left", homeSlug: "t-0-0", awaySlug: "t-0-1", homeSets: null, awaySets: null, state: "pre", conferenceMatch: true, gameDate: "2026-11-25" })],
      rpiRank,
      avcaRank: new Map(),
      rpiTotal: 120,
      rpiAsOf: "Through Games Oct. 04 2026",
      avcaAsOf: null,
      today: "2026-10-11",
    });
    expect(b.field).toHaveLength(FIELD_SIZE);
    expect(b.bids).toHaveLength(40);
    expect(b.field.filter((e) => e.bid === "auto")).toHaveLength(40);
    expect(b.atLargeCount).toBe(FIELD_SIZE - 40);
    expect(b.seeds).toHaveLength(SEED_COUNT);
    expect(b.seeds[0].seed).toBe(1);
    expect(b.bubble.length).toBeGreaterThan(0);
    // No team appears twice, and the field is ordered by the composite score.
    expect(new Set(b.field.map((e) => e.resume.team.slug)).size).toBe(FIELD_SIZE);
    const scores = b.field.map((e) => e.resume.score);
    expect([...scores].sort((x, y) => y - x)).toEqual(scores);
    // Nobody in the field is also listed on the bubble.
    const inField = new Set(b.field.map((e) => e.resume.team.slug));
    expect(b.bubble.some((r) => inField.has(r.team.slug))).toBe(false);
  });

  it("skips teams with no results and one-team conferences", () => {
    const allTeams = [team("played", "big-west"), team("alone", "solo"), team("never-played", "big-west"), team("opponent", "big-west")];
    const finals = [m({ id: "x", homeSlug: "played", awaySlug: "opponent", homeSets: 3, awaySets: 0, conferenceMatch: true })];
    const b = buildBracketology({
      teams: allTeams,
      finals,
      upcoming: [],
      rpiRank: new Map([["played", 1], ["opponent", 2]]),
      avcaRank: new Map(),
      rpiTotal: 4,
      rpiAsOf: null,
      avcaAsOf: null,
      today: "2026-10-11",
    });
    expect(b.field.map((e) => e.resume.team.slug).sort()).toEqual(["opponent", "played"]);
    expect(b.bids.map((x) => x.conf)).toEqual(["big-west"]);
  });
});

describe("conferenceBid, mid-November gap", () => {
  const members = ["a", "b"].map((s) =>
    buildResume(
      team(s, "big-west"),
      [m({ id: `g-${s}`, homeSlug: s, awaySlug: "rpi-80", homeSets: 3, awaySets: 0 })],
      rpi,
      avca,
      348,
    ),
  );

  it("does not crown a champion when only the regular season has finished", () => {
    // Conference tournaments are not on ncaa.com's schedule until the brackets are drawn,
    // so "nothing left to play" can mean "tournament not announced", not "we have a winner".
    const finals = [
      m({ id: "r1", homeSlug: "a", awaySlug: "b", homeSets: 3, awaySets: 0, conferenceMatch: true, gameDate: "2026-11-01" }),
      m({ id: "r2", homeSlug: "b", awaySlug: "a", homeSets: 3, awaySets: 0, conferenceMatch: true, gameDate: "2026-11-15" }),
    ];
    const bid = conferenceBid("big-west", members, finals, [], "2026-11-16");
    expect(bid.status).toBe("projected");
    expect(bid.team?.team.slug).toBe("a"); // the leader on conference record, not the last winner
    expect(bid.note).toMatch(/not on the schedule yet/);
  });
});
