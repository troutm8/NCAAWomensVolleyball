DROP INDEX "stat_leaders_unique";--> statement-breakpoint
DROP INDEX "rankings_unique";--> statement-breakpoint
CREATE INDEX "stat_leaders_lookup" ON "stat_leaders" USING btree ("scope","stat_id","as_of");--> statement-breakpoint
CREATE UNIQUE INDEX "rankings_unique" ON "rankings" USING btree ("poll","as_of","team_name");