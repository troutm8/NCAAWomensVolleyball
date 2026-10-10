import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

/** One row per program. Keyed by the ncaa.com slug (e.g. "stanford"). */
export const teams = pgTable("teams", {
  slug: text("slug").primaryKey(),
  ncaaId: integer("ncaa_id"),
  shortName: text("short_name").notNull(),
  fullName: text("full_name"),
  nickname: text("nickname"),
  char6: text("char6"),
  conferenceSlug: text("conference_slug"),
  conferenceName: text("conference_name"),
  espnId: text("espn_id"),
  espnName: text("espn_name"),
  abbreviation: text("abbreviation"),
  logoUrl: text("logo_url"),
  color: text("color"),
  isD1: boolean("is_d1").notNull().default(true),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type SetScore = { home: number; away: number };

export const matches = pgTable(
  "matches",
  {
    id: text("id").primaryKey(), // ncaa.com gameID
    /** Local (US Eastern) calendar date as ncaa.com lists it. */
    gameDate: date("game_date").notNull(),
    startTime: timestamp("start_time", { withTimezone: true }),
    homeSlug: text("home_slug").notNull().references(() => teams.slug),
    awaySlug: text("away_slug").notNull().references(() => teams.slug),
    homeSets: integer("home_sets"),
    awaySets: integer("away_sets"),
    state: text("state").notNull(), // pre | live | final
    period: text("period"),
    homeRank: integer("home_rank"),
    awayRank: integer("away_rank"),
    homeConfSlug: text("home_conf_slug"),
    awayConfSlug: text("away_conf_slug"),
    conferenceMatch: boolean("conference_match").notNull().default(false),
    neutral: boolean("neutral"),
    venue: text("venue"),
    broadcast: text("broadcast"),
    espnEventId: text("espn_event_id"),
    setScores: jsonb("set_scores").$type<SetScore[]>(),
    boxscoreLoaded: boolean("boxscore_loaded").notNull().default(false),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("matches_date_idx").on(t.gameDate),
    index("matches_home_idx").on(t.homeSlug),
    index("matches_away_idx").on(t.awaySlug),
  ],
);

export const matchTeamStats = pgTable(
  "match_team_stats",
  {
    matchId: text("match_id").notNull().references(() => matches.id),
    teamSlug: text("team_slug").notNull().references(() => teams.slug),
    points: integer("points"),
    kills: integer("kills"),
    attackErrors: integer("attack_errors"),
    attackAttempts: integer("attack_attempts"),
    hitPct: numeric("hit_pct", { precision: 5, scale: 3 }),
    assists: integer("assists"),
    serviceAces: integer("service_aces"),
    serviceErrors: integer("service_errors"),
    digs: integer("digs"),
    receptionErrors: integer("reception_errors"),
    blockSolos: integer("block_solos"),
    blockAssists: integer("block_assists"),
    totalBlocks: numeric("total_blocks", { precision: 6, scale: 1 }),
    blockingErrors: integer("blocking_errors"),
    ballHandlingErrors: integer("ball_handling_errors"),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.teamSlug] })],
);

export const matchPlayerStats = pgTable(
  "match_player_stats",
  {
    id: serial("id").primaryKey(),
    matchId: text("match_id").notNull().references(() => matches.id),
    teamSlug: text("team_slug").notNull().references(() => teams.slug),
    firstName: text("first_name").notNull(),
    lastName: text("last_name").notNull(),
    position: text("position"),
    number: integer("number"),
    starter: boolean("starter").notNull().default(false),
    sets: integer("sets"),
    points: numeric("points", { precision: 6, scale: 1 }),
    kills: integer("kills"),
    attackErrors: integer("attack_errors"),
    attackAttempts: integer("attack_attempts"),
    hitPct: numeric("hit_pct", { precision: 5, scale: 3 }),
    assists: integer("assists"),
    serviceAces: integer("service_aces"),
    serviceErrors: integer("service_errors"),
    digs: integer("digs"),
    receptionErrors: integer("reception_errors"),
    blockSolos: integer("block_solos"),
    blockAssists: integer("block_assists"),
    totalBlocks: numeric("total_blocks", { precision: 6, scale: 1 }),
  },
  (t) => [
    index("mps_match_idx").on(t.matchId),
    index("mps_team_idx").on(t.teamSlug),
    uniqueIndex("mps_unique").on(t.matchId, t.teamSlug, t.lastName, t.firstName, t.number),
  ],
);

export type Poll = "avca" | "rpi" | "committee";

export const rankings = pgTable(
  "rankings",
  {
    id: serial("id").primaryKey(),
    poll: text("poll").$type<Poll>().notNull(),
    /** Upstream label, e.g. "Through Games OCT. 4, 2026". */
    asOf: text("as_of").notNull(),
    fetchedDate: date("fetched_date").notNull(),
    rank: integer("rank").notNull(),
    teamName: text("team_name").notNull(),
    teamSlug: text("team_slug").references(() => teams.slug),
    record: text("record"),
    prevRank: integer("prev_rank"),
    points: integer("points"),
    firstPlaceVotes: integer("first_place_votes"),
    conference: text("conference"),
    homeRecord: text("home_record"),
    roadRecord: text("road_record"),
    neutralRecord: text("neutral_record"),
  },
  (t) => [
    uniqueIndex("rankings_unique").on(t.poll, t.asOf, t.teamName),
    index("rankings_team_idx").on(t.teamSlug),
  ],
);

export const statLeaders = pgTable(
  "stat_leaders",
  {
    id: serial("id").primaryKey(),
    scope: text("scope").$type<"individual" | "team">().notNull(),
    statId: integer("stat_id").notNull(),
    category: text("category").notNull(),
    asOf: text("as_of").notNull(),
    fetchedDate: date("fetched_date").notNull(),
    rank: integer("rank").notNull(),
    playerName: text("player_name"),
    teamName: text("team_name").notNull(),
    teamSlug: text("team_slug").references(() => teams.slug),
    classYear: text("class_year"),
    position: text("position"),
    sets: integer("sets"),
    value: numeric("value", { precision: 8, scale: 3 }),
    raw: jsonb("raw").$type<Record<string, string>>().notNull(),
  },
  (t) => [index("stat_leaders_lookup").on(t.scope, t.statId, t.asOf)],
);

export const ingestRuns = pgTable("ingest_runs", {
  id: serial("id").primaryKey(),
  job: text("job").notNull(),
  args: text("args"),
  startedAt: timestamp("started_at", { withTimezone: true }).notNull().defaultNow(),
  finishedAt: timestamp("finished_at", { withTimezone: true }),
  ok: boolean("ok"),
  rows: integer("rows"),
  error: text("error"),
});

export type Team = typeof teams.$inferSelect;
export type Match = typeof matches.$inferSelect;
export type Ranking = typeof rankings.$inferSelect;
export type StatLeader = typeof statLeaders.$inferSelect;
export type MatchTeamStat = typeof matchTeamStats.$inferSelect;
export type MatchPlayerStat = typeof matchPlayerStats.$inferSelect;
