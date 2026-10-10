# Cardinal Volleyball 2026

A personal dashboard for the 2026 NCAA Division I women's volleyball season, centered on
Stanford: live scores, schedule and results, AVCA poll and RPI, conference standings,
box scores, national stat leaders, and the December tournament.

Plan and design notes: [docs/PLAN.md](docs/PLAN.md).

## How it works

- **Data sources** (unofficial, personal use): ncaa.com via the
  [henrygd/ncaa-api](https://github.com/henrygd/ncaa-api) JSON mirror for scores, box
  scores, RPI, polls and stat leaders; ESPN's site API for set-by-set live scores and logos.
- **Database**: Postgres. Locally an embedded [PGlite](https://pglite.dev) file in
  `.data/pglite` is used when `DATABASE_URL` is unset; in production point `DATABASE_URL`
  at a free Neon database.
- **Ingestion**: `pnpm ingest <job>` (see `src/ingest/cli.ts`). GitHub Actions runs it on a
  schedule (`.github/workflows/ingest.yml`): nightly full refresh, Monday rankings, and
  score refreshes every 20 minutes on match days.
- **Web app**: Next.js 15 App Router, server-rendered from the database. The home page and
  scores page overlay live set scores from `/api/live` while matches are in progress.

## Local development

```bash
pnpm install
cp .env.example .env          # optional; defaults work with PGlite
pnpm db:migrate
pnpm ingest backfill          # whole season: ~15 minutes, most of it box scores
pnpm dev                      # http://localhost:3000
```

Day to day:

```bash
pnpm ingest today             # yesterday + today scores, then live set scores from ESPN
pnpm ingest boxscores         # box scores for any finished match that lacks one
pnpm ingest rankings          # AVCA poll, RPI, committee top 16
pnpm ingest stats             # national individual and team leaders
pnpm ingest nightly           # all of the above for the last 3 days
```

Checks: `pnpm typecheck`, `pnpm test`, `pnpm build`.

## Team identity

ncaa.com and ESPN name teams differently. `data/team-crosswalk.csv` maps ncaa.com slugs
to ESPN ids and is committed; `data/team-crosswalk-overrides.csv` holds hand fixes.
Rebuild with `pnpm ingest teams --rebuild` and audit with `pnpm tsx scripts/audit-crosswalk.ts`.

## Deploying (cheap)

1. Create a free Postgres database on [Neon](https://neon.tech) and copy its connection string.
2. Add it as the `DATABASE_URL` secret in the GitHub repository (Settings → Secrets → Actions),
   then run the **Ingest data** workflow manually with job `backfill` once.
3. Import the repo in [Vercel](https://vercel.com) (hobby plan), set `DATABASE_URL` as an
   environment variable, and deploy. Optionally set `NEXT_PUBLIC_DISPLAY_TZ`
   (default `America/Los_Angeles`) and `FEATURED_TEAM` (default `stanford`).
4. Optional but recommended: self-host the ncaa-api mirror (it ships a Dockerfile) and set
   `NCAA_API_BASE` as a repository variable so ingestion does not depend on the public demo host.
