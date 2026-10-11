import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import * as espn from "./sources/espn";
import * as ncaa from "./sources/ncaa";
import { normalizeName, stripVotes, tokenOverlap } from "./names";
import { isCurrentSeasonLabel } from "./jobs/rankings";

const fx = (name: string) => JSON.parse(fs.readFileSync(path.join(__dirname, "fixtures", name), "utf8"));

describe("ESPN payloads", () => {
  it("parses the scoreboard and extracts set scores", () => {
    const board = espn.scoreboardSchema.parse(fx("espn-scoreboard.json"));
    expect(board.events.length).toBeGreaterThan(0);
    const finished = board.events.find((e) => e.competitions[0].status.type.completed)!;
    const sets = espn.setScoresOf(finished)!;
    expect(sets.length).toBeGreaterThanOrEqual(3);
    expect(sets[0]).toEqual({ home: expect.any(Number), away: expect.any(Number) });
  });
  it("parses rankings", () => {
    const r = espn.rankingsSchema.parse(fx("espn-rankings.json"));
    expect(r.rankings[0].ranks[0].current).toBe(1);
    expect(r.rankings[0].ranks[0].team.id).toBeTruthy();
  });
  it("parses teams with a default logo", () => {
    const t = espn.teamsSchema.parse(fx("espn-teams.json")).sports[0].leagues[0].teams[0].team;
    expect(espn.defaultLogo(t)).toMatch(/^https:\/\//);
  });
});

describe("ncaa.com payloads", () => {
  it("parses a scoreboard with pre, live and final games", () => {
    const b = ncaa.scoreboardSchema.parse(fx("ncaa-scoreboard.json"));
    const states = new Set(b.games.map((g) => g.game.gameState));
    expect(states).toEqual(new Set(["pre", "live", "final"]));
    const live = b.games.find((g) => g.game.gameState === "live")!.game;
    expect(live.home.names.seo).toBeTruthy();
    expect(ncaa.ncaaDateToYmd(live.startDate)).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
  it("parses the RPI table with conference and splits", () => {
    const t = ncaa.tableSchema.parse(fx("ncaa-rpi.json"));
    expect(t.data[0]).toMatchObject({ Rank: "1", Conf: expect.any(String), Home: expect.stringMatching(/\d+-\d+/) });
  });
  it("parses a box score with player and team stats", () => {
    const b = ncaa.boxscoreSchema.parse(fx("ncaa-boxscore.json"));
    expect(b.teams).toHaveLength(2);
    expect(b.teamBoxscore[0].playerStats.length).toBeGreaterThan(5);
    expect(b.teamBoxscore[0].teamStats?.kills).toBeTruthy();
    // teams[].teamId is a string upstream, teamBoxscore[].teamId a number: both coerce
    expect(b.teams.map((t) => t.teamId)).toContain(b.teamBoxscore[0].teamId);
  });
  it("parses an individual stat table", () => {
    const t = ncaa.tableSchema.parse(fx("ncaa-stat-individual.json"));
    expect(Object.keys(t.data[0])).toContain("Pct.");
  });
});

describe("name matching", () => {
  it("normalizes abbreviations", () => {
    expect(normalizeName("Ark.-Pine Bluff")).toBe("arkansas pine bluff");
    expect(normalizeName("Southeast Mo. St.")).toBe("southeast mo state");
    expect(normalizeName("Texas A&M")).toBe("texas a and m");
  });
  it("strips first-place votes", () => {
    expect(stripVotes("Nebraska (47)")).toEqual({ name: "Nebraska", votes: 47 });
    expect(stripVotes("Pittsburgh")).toEqual({ name: "Pittsburgh", votes: null });
  });
  it("scores overlap", () => {
    expect(tokenOverlap("Stanford", "Stanford Cardinal")).toBeGreaterThan(0.4);
    expect(tokenOverlap("USC Upstate", "USC Trojans")).toBeLessThan(0.6);
  });
});

describe("isCurrentSeasonLabel", () => {
  it("accepts this season's labels and labels without a year", () => {
    expect(isCurrentSeasonLabel("Through Games Oct. 04 2026")).toBe(true);
    expect(isCurrentSeasonLabel("Through Games OCT. 4, 2026")).toBe(true);
    expect(isCurrentSeasonLabel("fetched 2026-10-11")).toBe(true);
    expect(isCurrentSeasonLabel("Through Games Oct. 4")).toBe(true);
  });
  it("rejects a table left over from last season", () => {
    // What ncaa.com served for the committee's top 16 through October 2026.
    expect(isCurrentSeasonLabel("Through Games OCT. 18, 2025")).toBe(false);
    expect(isCurrentSeasonLabel("Through Games Dec. 20 2027")).toBe(false);
  });
});
