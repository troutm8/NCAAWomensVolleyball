# NCAA Women's Volleyball Dashboard — 2026 Season Plan

Written 2026-10-10. Status: Phase 0–2 built on 2026-10-10 (see "Build log" at the end);
Phases 3–4 in progress.

## 1. What we are building

A web dashboard that tracks the 2026 NCAA Division I women's volleyball season from
today through the national championship match on December 20, 2026. It answers, at a
glance: who is playing right now, who is winning, who is ranked, who is trending toward
the tournament, and how the bracket is playing out once it exists.

Assumptions made for this plan (change them and the plan adjusts):

- Decided 2026-10-10: a personal site, mostly for the owner's wife, centered on Stanford
  with the rest of Division I as context. Database-backed. Hosting kept under $10/month.
- Scope is all of Division I (359 teams on ESPN, 348 in the NCAA RPI). Other divisions
  are out of scope for v1.
- Personal / non-commercial project. The data sources below are unofficial and must not
  be resold or presented as licensed.
- One developer, part-time, with a hard deadline of the selection show on November 29.

## 2. The 2026 calendar the dashboard has to follow

| Date | Event | Dashboard implication |
|---|---|---|
| Every Monday, ~noon CT | AVCA Coaches Poll (Week 8 was Oct 5) | Rankings page refreshes weekly; keep history for movement charts |
| Weekly, Mon/Tue | NCAA RPI update (currently "through Oct 4") | RPI table refreshes weekly; keep history |
| Mid-Oct to mid-Nov | NCAA committee "Top 16" reveals (usually 3) | Committee page lights up when the 2026 reveal replaces the stale 2025 one |
| Late Nov | Conference tournaments (one-bid leagues) | Auto-bid tracker |
| Sun Nov 29 | Selection show, 64-team bracket | Bracket page goes live, bracketology switches off |
| Dec 3–5 | First and second rounds, campus sites | Bracket updates from scores |
| Dec 10–13 | Regionals, campus sites | same |
| Dec 17 and 20 | National semifinals and final, Alamodome, San Antonio | Final four mode |

Sources: ncaa.com road-to-the-championship page, Alamodome event listing, AVCA.

## 3. What goes on the dashboard

Ordered by priority. "MVP" items ship first; "v2" items follow once data is flowing.

### Home / Today (MVP)
- Live scoreboard for today: every D1 match, set-by-set scores, status (scheduled, in
  progress, final), start time in the viewer's local time zone.
- Ranked matchups pinned to the top, with AVCA rank badges.
- "Upset watch" strip: any match where a ranked team trails or lost.
- Top 10 of the AVCA poll and top 10 of RPI side by side.
- Countdown to the next milestone (next poll, committee reveal, selection show).

### Rankings (MVP)
- AVCA Top 25 with points, first-place votes, record, previous rank, and movement arrows.
- Full RPI table (all 348 teams) with record, conference, home/road/neutral splits,
  sortable and filterable by conference.
- Committee Top 16 once the first 2026 reveal is published.
- Comparison view: AVCA rank vs RPI rank per team, highlighting the biggest gaps
  (these are the bubble and seeding stories).
- Rank history sparkline per team across the season.

### Scores and schedule (MVP)
- Date picker (any day from August 28 onward), filter by conference or "ranked only".
- Per-match drilldown: set scores, team hitting %, kills, blocks, digs, aces, errors,
  and individual box score where ESPN provides one (coverage is good for major
  conferences, thin for small schools).

### Conference standings (v1, derived)
- Overall and conference records, win streak, set ratio, last-five form, per conference.
- Neither data feed returned a parsable standings table, so standings are computed from
  the match results we store. This is also more reliable than scraping.

### Team pages (v1)
- Logo, record, conference, current AVCA and RPI rank, rank history chart.
- Full schedule and results with set scores, split by home/away/neutral.
- Team stat profile (hitting %, opponent hitting %, kills/set, blocks/set, aces/set, digs/set)
  computed from stored box scores.
- Players who appear in national leaderboards.

### Stat leaders (v1)
- Individual national leaders: hitting %, kills/set, assists/set, digs/set, blocks/set,
  aces/set, points/set. The NCAA feed already returns these as ranked tables with class,
  height, and position.
- Team leaders: same categories at team level.

### Tournament (v2, but must exist by Nov 29)
- Bracketology before the selection show: projected 16 seeds and 64-team field using a
  transparent heuristic (RPI, AVCA rank, record vs top 50, conference auto-bids as
  conference tournaments resolve). Show the inputs, not just the output.
- Auto-bid tracker: 31 automatic qualifiers, which have been clinched.
- Live bracket after Nov 29, filled in from match results through Dec 20.

### Nice-to-have (v3)
- Player of the week feed, injury/news links.
- Email or push alert when a favorite team starts or finishes a match.
- Elo-style power rating computed from set results, compared to RPI and the poll.
- Shareable team "cards" as images.

## 4. Data sources (verified 2026-10-10)

All of these are unofficial, undocumented, and can change without notice. The
architecture below assumes they will break at some point and isolates them.

| Need | Source | Endpoint shape | Verified result |
|---|---|---|---|
| Live scores, set scores, status, ranks | ESPN site API | `site.api.espn.com/apis/site/v2/sports/volleyball/womens-college-volleyball/scoreboard?dates=YYYYMMDD&limit=300` | 123 matches for Oct 9, live in-progress set scores |
| AVCA poll | ESPN site API | `.../womens-college-volleyball/rankings` | Week 8 poll, 25 entries with records |
| Team directory and logos | ESPN site API | `.../womens-college-volleyball/teams?limit=500` | 359 teams, numeric ids, logo URLs |
| Team schedule and results | ESPN site API | `.../womens-college-volleyball/teams/{id}/schedule` | Nebraska: 29 events, season 2026 |
| Match box score | ESPN site API | `.../womens-college-volleyball/summary?event={id}` | Team stats present; player stats missing for some small-school matches |
| AVCA poll with points and votes | ncaa.com via henrygd/ncaa-api | `/rankings/volleyball-women/d1/avca-coaches` | 25 rows, points, first-place votes, previous rank |
| RPI with splits | ncaa.com via henrygd/ncaa-api | `/rankings/volleyball-women/d1/ncaa-womens-volleyball-rpi` | 348 rows, record, conf, home/road/neutral |
| Committee top 16 | ncaa.com via henrygd/ncaa-api | `/rankings/volleyball-women/d1/di-committees-top-10` | Still shows 2025 data; will flip when 2026 reveal posts |
| Individual stat leaders | ncaa.com via henrygd/ncaa-api | `/stats/volleyball-women/d1/current/individual/{statId}` | statId 1 = hitting %, 50 rows per page; enumerate other ids |
| Scores with conference tags | ncaa.com via henrygd/ncaa-api | `/scoreboard/volleyball-women/d1/YYYY/MM/DD/all-conf` | 122 games for Oct 9 with conference slugs |

Not working, do not plan on them: ESPN rosters (empty), ESPN standings (empty),
ncaa-api `/standings/volleyball-women/d1` and `/stats/.../team/{id}` (parse errors).

Two operational notes:

1. The public `ncaa-api.henrygd.me` host is rate-limited to 5 requests/second and is a
   demo. Self-host it (it is a small Bun service with a Dockerfile) so our ingestion does
   not depend on someone else's uptime.
2. ESPN and the NCAA use different team identifiers (ESPN numeric id vs NCAA seo slug,
   plus display-name differences like "Pitt" vs "Pittsburgh"). A one-time crosswalk table
   of ~360 rows is required and is the single most tedious task in the project. Build
   it with fuzzy matching, then hand-fix the remainder and commit it as a CSV.

## 5. Technology choices

### Recommended stack

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 15, App Router, TypeScript | Server components for data-heavy pages, route handlers for the live proxy, ISR for cheap caching, one language end to end |
| UI | Tailwind CSS + shadcn/ui | Fast to build tables, tabs, badges; dark mode free |
| Charts | Recharts (sparklines, rank history, form charts) | Simple API, React-native, good enough for line/bar; swap to visx only if needed |
| Tables | TanStack Table | Sorting/filtering 348-row RPI and leaderboards client-side |
| Database | Postgres (Neon free tier) + Drizzle ORM | Need history (rank movement, standings derivation, bracket); SQL makes standings and ratings trivial |
| Ingestion | TypeScript scripts in `packages/ingest`, run by GitHub Actions cron | Free, versioned, visible logs; minimum 5-minute cadence is fine for non-live data |
| Live scores | Next.js route handler proxying ESPN with 30-second cache; client polls it | No DB writes for live data; finals persisted by the nightly job |
| ncaa-api | Self-hosted container (Fly.io or Railway free/cheap tier) | Avoid the 5 rps public demo |
| Hosting | Vercel (hobby) | Zero-config for Next.js, cron available if GitHub Actions is not wanted |
| Validation | Zod schemas on every external payload | Upstream shape changes fail loudly in ingestion, not silently in the UI |
| Testing | Vitest for parsers/derivations, Playwright smoke test for key pages | Parsers are where bugs live |

### Alternatives considered

- **Static site, no database** (Astro or Next static export; GitHub Actions commits JSON
  snapshots into the repo). Cheapest and simplest, and viable for v1. Rejected as the
  primary plan because rank history, derived standings, and the bracket all want queries,
  and the JSON-in-git approach gets awkward by November. Keep as a fallback if the DB
  feels like overkill after Phase 1.
- **Python + Streamlit.** Fastest for a personal analytics notebook, weak for a polished
  public dashboard and for live score polling. Use Python only if the bracketology model
  becomes a serious modeling exercise; it can run as a separate job that writes to the
  same Postgres.
- **Supabase instead of Neon.** Equivalent; pick Supabase if you want auth and realtime
  subscriptions later (favorite-team alerts).

## 6. Data model (Postgres)

- `teams` (id, espn_id, ncaa_slug, name, short_name, conference_id, logo_url)
- `conferences` (id, name, slug, auto_bid_clinched_team_id)
- `matches` (id, espn_event_id, ncaa_game_id, date_utc, home_team_id, away_team_id,
  neutral, status, home_sets, away_sets, set_scores jsonb, venue, broadcast)
- `match_team_stats` (match_id, team_id, kills, errors, attacks, hit_pct, assists, aces,
  digs, blocks, points)
- `match_player_stats` (match_id, team_id, player_name, position, sets, kills, errors,
  attacks, assists, aces, digs, blocks)
- `rankings` (poll enum: avca | rpi | committee, week_label, as_of_date, team_id, rank,
  prev_rank, points, first_place_votes, record, home/road/neutral splits)
- `stat_leaders` (category, as_of_date, rank, player_name, team_id, class, position,
  value, raw jsonb)
- `bracket` (year, seed, region, team_id, slot, opponent_slot, winner_slot) populated Nov 29
- `ingest_runs` (source, started_at, finished_at, ok, row_count, error) for monitoring

Standings, form, set ratio, and team season stats are SQL views over `matches` and
`match_team_stats`, not stored tables.

## 7. Build steps

Dates assume a start on Oct 13 and a part-time pace. Each phase ends with something
deployed.

### Phase 0 — Scaffold (Oct 13–15)
1. `pnpm create next-app` with TypeScript, Tailwind, App Router; add shadcn/ui, Drizzle, Zod, Vitest.
2. Monorepo layout: `apps/web`, `packages/ingest`, `packages/db` (schema + migrations), `packages/shared` (types, team crosswalk).
3. Provision Neon Postgres; run first migration.
4. Deploy an empty app to Vercel so the pipeline exists from day one.
5. Deploy self-hosted ncaa-api container; point ingestion at it.

### Phase 1 — Data in (Oct 15–20)
6. Write Zod schemas for the six payloads in section 4. Save a raw fixture of each in `packages/ingest/fixtures` for tests.
7. Team crosswalk: pull ESPN teams and NCAA RPI, fuzzy-match names, hand-fix leftovers, commit `teams.csv`.
8. Ingest jobs: `teams`, `rankings:avca`, `rankings:rpi`, `rankings:committee`, `stat-leaders`, `scores:date` (backfill Aug 28 to today, then daily), `boxscore:event` (for every final match).
9. GitHub Actions: nightly full run at 03:00 CT; Monday 13:00 CT rankings run; every 15 minutes `scores:today` during 11:00–23:59 CT.
10. `ingest_runs` table plus a failing-run notification (GitHub Action failure email is enough).

### Phase 2 — MVP pages (Oct 20–Nov 1)
11. Home: live scoreboard component polling `/api/live` every 30 s; ranked matchups pinned; top-10 tiles; milestone countdown.
12. Rankings: AVCA table with movement; RPI table with TanStack sorting and conference filter; AVCA-vs-RPI gap view.
13. Scores: date picker, conference/ranked filters, match drilldown with box score.
14. Mobile layout pass; dark mode; share the link.

### Phase 3 — Teams, standings, stats (Nov 1–15)
15. SQL views for standings, form, set ratio, team season stats.
16. Conference standings page.
17. Team pages with schedule/results, rank history sparkline, stat profile.
18. Stat leaders pages (individual and team).

### Phase 4 — Tournament mode (Nov 15–29, hard deadline)
19. Committee Top 16 page (verify the 2026 reveal parses as soon as it posts, likely mid-late October; fix the parser then, not in November).
20. Auto-bid tracker fed by conference tournament results.
21. Bracketology: heuristic seed list with visible inputs; publish the method.
22. Bracket page: data entry script for the 64-team field on Nov 29 (the NCAA bracket JSON on ncaa.com is the likely source; have a manual CSV fallback ready), then auto-advance from match results.

### Phase 5 — Polish and Dec run (Dec 1–20)
23. Final-four mode on the home page.
24. Playwright smoke tests on the five main routes; fix anything the tournament traffic exposes.
25. Season archive: freeze the 2026 data so the dashboard can be reused for 2027 with a `season` parameter.

## 8. Risks and mitigations

| Risk | Likelihood | Mitigation |
|---|---|---|
| ESPN or ncaa.com changes payload shape | High over a season | Zod validation, fixtures, isolated adapters per source, raw payloads stored in object storage for replay |
| Public ncaa-api demo goes down or throttles | High | Self-host it from day one |
| Team identity mismatches corrupt standings | Medium | Crosswalk CSV reviewed by hand; ingestion refuses unknown teams and logs them |
| ESPN box scores missing for small schools | Certain | Show team stats from ncaa.com when ESPN lacks player rows; label gaps rather than hiding them |
| Committee reveal format differs from 2025 | Medium | Watch for the first reveal and fix the parser the same day |
| Time-zone errors on match times | Medium | Store UTC, render in viewer's zone, test with a Hawaii match |
| Terms-of-use exposure | Low for personal use | Keep it non-commercial, attribute sources, no redistribution API |

## 9. Decisions needed from you

1. Audience: public link for fans, or personal use? (Affects polish, auth, hosting tier.)
2. All of D1, or focus on one conference or team with national context? (A team-first
   layout is a different home page.)
3. Database or static-JSON v1? Recommendation is database; say so if you want cheaper.
4. Favorite team(s) to feature by default, if any.
5. Budget ceiling for hosting (plan assumes under $10/month).

## 10. Sources checked for this plan

- ncaa.com, Road to the championship (dates, 64-team field, Nov 29 selection show)
- Alamodome event page for the 2026 championship
- AVCA poll pages and ESPN rankings endpoint (Week 8 poll)
- henrygd/ncaa-api README and live probes of its endpoints
- Live probes of ESPN site API endpoints listed in section 4

## 11. Build log and deviations from the plan

**2026-10-10.** Phases 0, 1 and most of 2 and 3 were built in one session.

What changed versus the plan above, and why:

- **ncaa.com is the match spine, not ESPN.** ESPN's volleyball box scores turned out to be
  empty shells, while ncaa.com's `/game/{id}/boxscore` carries full player and team stats.
  Matches are therefore keyed by the ncaa.com game id, and ESPN contributes set-by-set
  scores, venue, broadcast, logos and the live overlay.
- **Single package, not a monorepo.** `src/db`, `src/ingest`, `src/lib`, `src/app` in one
  Next.js project is enough for a personal site.
- **PGlite locally, Neon in production.** Same Postgres dialect and migrations; no local
  database server needed. `DATABASE_URL` switches to the real Postgres.
- **No shadcn/ui or Recharts.** Plain Tailwind components and an inline SVG sparkline keep
  the dependency list short.
- **Standings are derived** from stored results, as planned, because neither feed exposes
  a parsable standings table.
- **RPI has tied ranks.** The rankings table is unique on (poll, as-of, team) rather than rank.

Data loaded locally on 2026-10-10 with `pnpm ingest backfill` (about 17 minutes): 4,823
matches (Aug 21 through Nov 28, including the full remaining schedule), 347 D1 teams linked
to ESPN (14 non-D1 exhibition opponents unlinked), AVCA Week 8, RPI through Oct 4, 12
stat-leader tables, and box scores for all 2,803 completed matches (66,966 player lines).

Lesson learned: PGlite is single-process. Running an ingest job while the dev server was
open corrupted the local database and it had to be rebuilt. With Neon this does not apply.

**2026-10-11.** Moved the work to a local Mac checkout and started Phase 4.

- **Bracketology and the auto-bid tracker are in**, on a new `/bracket` page:
  `src/lib/bracketology.ts` builds a resume per team (RPI rank, AVCA rank, record versus
  the current RPI top 25/50/100, losses outside the top 100, road and neutral record) and
  scores it out of 100 with published weights (RPI 45, poll 20, quality wins 25, bad-loss
  avoidance 5, road and neutral 5). Conference champions take the automatic bids, the
  best remaining resumes fill the field to 64, and the whole field is re-ranked to assign
  seeds 1–16. The page shows the inputs next to every team and publishes the method.
- **Automatic bids are derived, not hand-maintained.** A conference's bid is projected to
  its current leader until the conference has no conference matches left to play; at that
  point the winner of its last conference match is the champion, which is how every
  conference tournament final resolves. `src/lib/auto-bid-overrides.ts` is the hand-fix
  escape hatch for conferences that break that assumption, in the same spirit as
  `data/team-crosswalk-overrides.csv`.
- **Stale upstream tables are now rejected.** ncaa.com was still serving last season's
  committee top 16 ("Through Games OCT. 18, 2025") in October 2026, and the ingest was
  storing it as if it were current. `isCurrentSeasonLabel` in the rankings job skips any
  table whose "updated" label names a year other than the season year, and deletes rows a
  previous run stored from it, so the committee page reads "not loaded yet" until the real
  2026 reveal posts. Checked again on 2026-10-11: still 2025 data.
- **32 automatic bids in 2026, not 31.** Section 3 above assumed 31 automatic qualifiers,
  which was the 2025 number. The loaded data has 32 conferences fielding Division I
  volleyball — the Pac-12 is back to nine volleyball members (Boise St., Colorado St.,
  Fresno St., Gonzaga, Oregon St., San Diego St., Texas St., Utah St., Washington St.) —
  so the projected field splits 32 automatic and 32 at-large. The count is derived from the
  data rather than hardcoded. Automatic-qualification *eligibility* is in no feed, so
  `NO_AUTO_BID` in `src/lib/auto-bid-overrides.ts` can drop a conference's bid if one turns
  out not to qualify, and its slot goes to the next at-large.
- **Local toolchain notes for the Mac checkout.** `~/.npmrc` points at an internal registry,
  so the repo carries an `.npmrc` pinning the public one; `package.json` allows esbuild's
  build script (pnpm 10 blocks it by default and tsx and vitest need it).

Still to do, in order: deploy (Neon + Vercel + GitHub Actions secret); committee Top 16
parser check when the first 2026 reveal posts (guard is in, the reveal is not); bracket
page for Nov 29, fed by the real field; Playwright smoke tests in CI.

**2026-10-13.** Set up a second Mac and deployed the web app to Vercel.

- **Production is live at https://ncaa-womens-volleyball.vercel.app**, project
  `ncaa-womens-volleyball` on the Vercel account `tomcarroll-6406`, deployed from the CLI
  (`vercel deploy --prod`). `DATABASE_URL` is a production secret in Vercel pointing at the
  same Neon database the GitHub Actions ingest writes to, so the site and the scheduled
  ingests share one source of truth and nothing is backfilled twice.
- **Functions run in `iad1`.** `vercel.json` pins `regions` to `iad1` so the server-rendered
  pages sit in the same AWS region (us-east-1) as Neon. Verified on the live site: the
  `x-vercel-id` response header reads `sfo1::iad1::…`, edge in San Francisco, function in
  Virginia.
- **Git integration is connected.** `vercel git connect` first failed because the Vercel
  account had no GitHub login connection, and then because the Vercel GitHub App was not
  installed on the `troutm8` account. Both are dashboard-side grants; once GitHub was
  connected to the Vercel account and the app installed on the repository, `vercel git
  connect` succeeded and pushes to `main` deploy to production. The linked checkout keeps
  its project id in `.vercel/`, which the Vercel CLI added to `.gitignore` along with `.env*`.
- **Vercel project names must be lowercase**, so the project is `ncaa-womens-volleyball`
  (the package name) rather than the repository's `NCAAWomensVolleyball`. `vercel link`
  needs `--project ncaa-womens-volleyball` on a fresh checkout.
- Machine notes: this Mac has no `~/.npmrc`, so the `--registry` flag on the global pnpm
  install was harmless but unneeded. It runs Node 26 where CI pins 22; typecheck, tests
  and build all passed on 26.

**2026-10-13, later.** Playwright smoke tests in CI (plan step 24).

- **Eighteen tests in `e2e/smoke.spec.ts`**, one spec file, Chromium only: every route
  returns 200 with its heading; the featured team is on the home page, in the RPI table, in
  its conference standings and on the bracket; AVCA has exactly 25 rows; the committee poll
  renders either its table or the explicit "not loaded yet" state (it will flip when the
  2026 reveal posts); the bracket field is 64 with 16 seeds, 48 others, and automatic plus
  at-large bids summing to 64; the match page is reached by following the home page's
  "Box score" link rather than a hardcoded id; unknown team and match ids are 404s, not
  500s; the phone viewport has no horizontal overflow; and a freshness guard checks the
  footer's last-ingest stamp (3 days) and the RPI through-date (14 days).
- **Against live Neon, not a seeded PGlite.** The alternative was a hermetic seed from
  fixtures, which does not exist and would test synthetic pages. Assertions are therefore
  on structure and invariants, never on numbers or opponents that change weekly.
- **CI runs them after `pnpm build`** using `next start`, gated on the `DATABASE_URL`
  secret being present (exposed as `HAS_DATABASE` because `if:` cannot read secrets), so
  forks and outside pull requests still get typecheck, unit tests and build. Stale data
  fails only on `main` (`E2E_STRICT_FRESHNESS=1`); elsewhere it is a warning, so an
  ncaa-api outage does not block unrelated work. The HTML report uploads on failure.
- **Playwright pinned to 1.63.0** (from 1.58.2). Microsoft's browser CDN answered every
  build request from this Mac with `400 GatewayExceptionResponse` and the installer hung,
  while a complete Chromium 1243 (the 1.63 build) was already in
  `~/Library/Caches/ms-playwright` from another tool. Pinning to the version whose browser
  was on disk was the only way to run the suite locally; CI downloads its own browser.
- **Local runs use one worker.** Against `next dev`, parallel first requests race the
  compiler and it serves `__webpack_modules__[moduleId] is not a function` as a 500. The
  production server has no such problem, so CI keeps full parallelism. `PORT` is honoured
  so `CI=1 PORT=3001 pnpm test:e2e` reproduces CI beside a running dev server. Note that
  `next dev` overwrites the production build in `.next`; run `pnpm build` again before
  `next start`.

Still to do, in order: committee Top 16 parser check when the first 2026 reveal posts (guard
is in, the reveal is not); bracket page for Nov 29, fed by the real field.
