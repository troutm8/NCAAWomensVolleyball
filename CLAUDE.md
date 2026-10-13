# Cardinal Volleyball 2026 — working notes

A personal dashboard for the 2026 NCAA Division I women's volleyball season, centred on
Stanford. Next.js 15 App Router, Postgres via Drizzle, server-rendered from the database.

- What it does and how to deploy it: [README.md](README.md).
- Why it is built this way, and what has been done so far: the build log at the end of
  [docs/PLAN.md](docs/PLAN.md). **Append to that log when you finish a piece of work** — it is
  the handoff between sessions and machines, and it records deviations from the original plan.

## Setting up a machine

```bash
npm install -g pnpm@10 --registry=https://registry.npmjs.org
pnpm install
pnpm db:migrate
pnpm dev                      # http://localhost:3000
```

Four things that will otherwise cost you an hour:

- **pnpm must be 10.** CI pins `version: 10` and the lockfile is v9. pnpm 12 silently
  upgrades the lockfile, after which CI's `pnpm install --frozen-lockfile` fails.
- **The `--registry` flag on the global install** is needed on a machine whose `~/.npmrc`
  points at a private registry (this author's does, at `npm.apple.com`). Project installs are
  fine without it because the repo carries its own `.npmrc`.
- **`package.json` allows esbuild's build script** via `pnpm.onlyBuiltDependencies`. pnpm 10
  blocks postinstall scripts by default, and tsx and vitest need esbuild's binary.
- **PGlite is single-process.** With no `DATABASE_URL`, the database is an embedded file in
  `.data/pglite` that exactly one process may open. Running an ingest job while `pnpm dev` is
  up has corrupted it before and cost a full rebuild. Stop the dev server first, or set
  `DATABASE_URL` to a real Postgres (Neon) where the restriction disappears.

Environment: `DATABASE_URL` (unset → PGlite), `NCAA_API_BASE`, `FEATURED_TEAM` (default
`stanford`), `NEXT_PUBLIC_DISPLAY_TZ` (default `America/Los_Angeles`). `.env` is gitignored.

Next.js loads `.env` on its own, but the tsx scripts do not — `db:migrate` and `ingest` pass
`--env-file-if-exists=.env` for that reason. Drop it and they silently write to PGlite while
appearing to succeed. An exported `DATABASE_URL` still wins over the file, which is how CI
supplies its secret. `db:migrate` prints `(postgres)` or `(pglite)`; trust that over
assumption.

The flag is on those two package scripts only. An ad-hoc `pnpm tsx scratch.ts` gets no `.env`
and will quietly read the stale local PGlite file instead of Neon — run throwaway scripts as
`pnpm tsx --env-file-if-exists=.env scratch.ts`, and have them print `kind` from `getDb()`
before you believe a number.

## Commands

```bash
pnpm dev | build | start
pnpm typecheck                # tsc --noEmit
pnpm test                     # vitest
pnpm db:migrate               # apply drizzle/ migrations
pnpm db:generate              # new migration from src/db/schema.ts

pnpm ingest today             # yesterday/today/tomorrow scores
pnpm ingest nightly           # recent results, next week, rankings, stats, new box scores
pnpm ingest backfill          # whole season, ~40 min, mostly box scores
pnpm ingest rankings [--poll avca|rpi|committee]
pnpm ingest boxscores [--team slug] [--limit N] [--refresh]
pnpm ingest teams [--rebuild] # rebuild the ncaa.com → ESPN crosswalk

node scripts/screenshots.mjs  # needs: pnpm playwright install chromium
```

Run `pnpm typecheck && pnpm test && pnpm build` before committing; CI runs exactly those.

## Layout

| Path | What lives there |
| --- | --- |
| `src/app` | Pages (server components, all `force-dynamic`) and `/api/live` |
| `src/components` | Small presentational pieces: `MatchRow`, `TeamName`, `Card`, `Sparkline` |
| `src/db` | Drizzle `schema.ts`, lazy `client.ts` (Postgres or PGlite), `migrate.ts` |
| `src/ingest` | `cli.ts`, `jobs/*`, `sources/{ncaa,espn}.ts` (Zod schemas), `fixtures/*` |
| `src/lib` | `queries.ts` (database reads), `bracketology.ts`, `views.ts`, `season.ts`, `format.ts` |
| `data` | `team-crosswalk.csv` and its hand-fix overrides |

## Conventions

- **Keep pure logic out of the database layer.** Scoring, records and projections are plain
  functions over rows (`computeRecord`, `buildResume`, `buildBracketology`, `conferenceBid`)
  and are unit-tested without a database. Only the loaders touch Drizzle.
- **Validate at the boundary.** Every external payload is parsed by a Zod schema in
  `src/ingest/sources/`, with a saved fixture in `src/ingest/fixtures/` so parser tests run
  offline. Upstream shape changes should fail loudly in ingestion, not silently in the UI.
- **Derive rather than store.** Standings, form, set ratio, season stats and tournament
  resumes are all computed from `matches` and `match_team_stats`. Neither feed exposes a
  parsable standings table, and derived values cannot drift.
- **Hand-fixes get a committed file, never a database edit.** `data/team-crosswalk-overrides.csv`
  for team identity; `src/lib/auto-bid-overrides.ts` for conference automatic bids.
- **Dates.** `matches.gameDate` is the US Eastern calendar date ncaa.com files a match under;
  timestamps are stored UTC and rendered in the viewer's zone. Use the helpers in
  `src/lib/season.ts` and `src/lib/format.ts` rather than `new Date()` arithmetic.
- **Teams are keyed by ncaa.com slug** (`stanford`). ESPN ids come from the crosswalk. Ingest
  refuses unknown teams and logs them rather than inventing rows.
- Plain Tailwind, no component library. Tables use `class="data"` from `globals.css`.

## The data sources, and how they misbehave

ncaa.com (via a [henrygd/ncaa-api](https://github.com/henrygd/ncaa-api) mirror) is the spine:
matches are keyed by its game id, and it supplies box scores, RPI, polls and stat leaders.
ESPN contributes set-by-set scores, venue, broadcast, logos and the live overlay. Both are
unofficial and undocumented. Expect:

- **ESPN box scores are empty shells** for this sport. Do not reach for them.
- **The public `ncaa-api.henrygd.me` is a rate-limited demo** and returns occasional 502s
  mid-run. Ingest jobs tolerate failures and are resumable — re-running `pnpm ingest boxscores`
  picks up whatever is still missing. Self-hosting the mirror and setting `NCAA_API_BASE` is
  the real fix.
- **Stale tables are served as if current.** ncaa.com left the 2025 committee top 16 up well
  into October 2026. `isCurrentSeasonLabel` in `src/ingest/jobs/rankings.ts` rejects any table
  whose "updated" label names a year other than the season year. Keep that guard in mind
  before trusting an `asOf` string.
- **RPI has tied ranks**, so `rankings` is unique on (poll, asOf, team), not on rank.

## Season calendar

Weekly AVCA poll (Mondays) and RPI update; committee top 16 reveals from late October;
conference tournaments late November; **selection show Sunday 29 November**; first and second
rounds 3–5 December; regionals 10–13 December; semifinals and final 17 and 20 December in San
Antonio. Constants live in `src/lib/season.ts`; `/bracket` projects the field until the real
one exists.
