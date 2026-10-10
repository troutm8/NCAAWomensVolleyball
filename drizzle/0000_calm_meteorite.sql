CREATE TABLE "ingest_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job" text NOT NULL,
	"args" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"ok" boolean,
	"rows" integer,
	"error" text
);
--> statement-breakpoint
CREATE TABLE "match_player_stats" (
	"id" serial PRIMARY KEY NOT NULL,
	"match_id" text NOT NULL,
	"team_slug" text NOT NULL,
	"first_name" text NOT NULL,
	"last_name" text NOT NULL,
	"position" text,
	"number" integer,
	"starter" boolean DEFAULT false NOT NULL,
	"sets" integer,
	"points" numeric(6, 1),
	"kills" integer,
	"attack_errors" integer,
	"attack_attempts" integer,
	"hit_pct" numeric(5, 3),
	"assists" integer,
	"service_aces" integer,
	"service_errors" integer,
	"digs" integer,
	"reception_errors" integer,
	"block_solos" integer,
	"block_assists" integer,
	"total_blocks" numeric(6, 1)
);
--> statement-breakpoint
CREATE TABLE "match_team_stats" (
	"match_id" text NOT NULL,
	"team_slug" text NOT NULL,
	"points" integer,
	"kills" integer,
	"attack_errors" integer,
	"attack_attempts" integer,
	"hit_pct" numeric(5, 3),
	"assists" integer,
	"service_aces" integer,
	"service_errors" integer,
	"digs" integer,
	"reception_errors" integer,
	"block_solos" integer,
	"block_assists" integer,
	"total_blocks" numeric(6, 1),
	"blocking_errors" integer,
	"ball_handling_errors" integer,
	CONSTRAINT "match_team_stats_match_id_team_slug_pk" PRIMARY KEY("match_id","team_slug")
);
--> statement-breakpoint
CREATE TABLE "matches" (
	"id" text PRIMARY KEY NOT NULL,
	"game_date" date NOT NULL,
	"start_time" timestamp with time zone,
	"home_slug" text NOT NULL,
	"away_slug" text NOT NULL,
	"home_sets" integer,
	"away_sets" integer,
	"state" text NOT NULL,
	"period" text,
	"home_rank" integer,
	"away_rank" integer,
	"home_conf_slug" text,
	"away_conf_slug" text,
	"conference_match" boolean DEFAULT false NOT NULL,
	"neutral" boolean,
	"venue" text,
	"broadcast" text,
	"espn_event_id" text,
	"set_scores" jsonb,
	"boxscore_loaded" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "rankings" (
	"id" serial PRIMARY KEY NOT NULL,
	"poll" text NOT NULL,
	"as_of" text NOT NULL,
	"fetched_date" date NOT NULL,
	"rank" integer NOT NULL,
	"team_name" text NOT NULL,
	"team_slug" text,
	"record" text,
	"prev_rank" integer,
	"points" integer,
	"first_place_votes" integer,
	"conference" text,
	"home_record" text,
	"road_record" text,
	"neutral_record" text
);
--> statement-breakpoint
CREATE TABLE "stat_leaders" (
	"id" serial PRIMARY KEY NOT NULL,
	"scope" text NOT NULL,
	"stat_id" integer NOT NULL,
	"category" text NOT NULL,
	"as_of" text NOT NULL,
	"fetched_date" date NOT NULL,
	"rank" integer NOT NULL,
	"player_name" text,
	"team_name" text NOT NULL,
	"team_slug" text,
	"class_year" text,
	"position" text,
	"sets" integer,
	"value" numeric(8, 3),
	"raw" jsonb NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teams" (
	"slug" text PRIMARY KEY NOT NULL,
	"ncaa_id" integer,
	"short_name" text NOT NULL,
	"full_name" text,
	"nickname" text,
	"char6" text,
	"conference_slug" text,
	"conference_name" text,
	"espn_id" text,
	"espn_name" text,
	"abbreviation" text,
	"logo_url" text,
	"color" text,
	"is_d1" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_player_stats" ADD CONSTRAINT "match_player_stats_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_player_stats" ADD CONSTRAINT "match_player_stats_team_slug_teams_slug_fk" FOREIGN KEY ("team_slug") REFERENCES "public"."teams"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_team_stats" ADD CONSTRAINT "match_team_stats_match_id_matches_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."matches"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_team_stats" ADD CONSTRAINT "match_team_stats_team_slug_teams_slug_fk" FOREIGN KEY ("team_slug") REFERENCES "public"."teams"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_home_slug_teams_slug_fk" FOREIGN KEY ("home_slug") REFERENCES "public"."teams"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matches" ADD CONSTRAINT "matches_away_slug_teams_slug_fk" FOREIGN KEY ("away_slug") REFERENCES "public"."teams"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "rankings" ADD CONSTRAINT "rankings_team_slug_teams_slug_fk" FOREIGN KEY ("team_slug") REFERENCES "public"."teams"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stat_leaders" ADD CONSTRAINT "stat_leaders_team_slug_teams_slug_fk" FOREIGN KEY ("team_slug") REFERENCES "public"."teams"("slug") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "mps_match_idx" ON "match_player_stats" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "mps_team_idx" ON "match_player_stats" USING btree ("team_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "mps_unique" ON "match_player_stats" USING btree ("match_id","team_slug","last_name","first_name","number");--> statement-breakpoint
CREATE INDEX "matches_date_idx" ON "matches" USING btree ("game_date");--> statement-breakpoint
CREATE INDEX "matches_home_idx" ON "matches" USING btree ("home_slug");--> statement-breakpoint
CREATE INDEX "matches_away_idx" ON "matches" USING btree ("away_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "rankings_unique" ON "rankings" USING btree ("poll","as_of","rank");--> statement-breakpoint
CREATE INDEX "rankings_team_idx" ON "rankings" USING btree ("team_slug");--> statement-breakpoint
CREATE UNIQUE INDEX "stat_leaders_unique" ON "stat_leaders" USING btree ("scope","stat_id","as_of","rank");