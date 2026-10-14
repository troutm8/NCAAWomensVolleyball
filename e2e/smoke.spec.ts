/**
 * Smoke tests for the main routes, run against the production build and a live database
 * (Neon in CI). The data changes every day, so these assert structure and invariants —
 * headings, row counts the algorithm fixes, the featured team's presence — never specific
 * numbers or opponents. Stanford is the one fixed anchor, because FEATURED_TEAM pins it.
 */
import { test, expect, type Page } from "@playwright/test";

const FEATURED = "Stanford";
const SEASON_YEAR = 2026;
/** A Saturday early in the season with a full slate, long since final. */
const PAST_DATE = "2026-09-12";
/** Set by CI on main: stale data fails instead of warning. */
const STRICT_FRESHNESS = process.env.E2E_STRICT_FRESHNESS === "1";

const rows = (page: Page, table = "table.data") => page.locator(`${table} tbody tr`);

async function visit(page: Page, path: string, status = 200) {
  const res = await page.goto(path);
  expect(res, `${path} gave no response`).not.toBeNull();
  expect(res!.status(), `${path} status`).toBe(status);
}

test.describe("home", () => {
  test("shows the featured team, its next and last match, and today's slate", async ({ page }) => {
    await visit(page, "/");
    await expect(page.locator("h1")).toContainText(FEATURED);
    await expect(page.getByText(/\d+-\d+ overall · \d+-\d+ conference · streak/)).toBeVisible();
    await expect(page.getByRole("heading", { name: /^(Next match|Live now)$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Last result" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Box score/ })).toHaveAttribute("href", /^\/matches\/\d+$/);
    await expect(page.getByRole("heading", { name: /^Today · / })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Season milestones" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "AVCA Coaches Poll" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "NCAA RPI" })).toBeVisible();
  });

  test.describe("on a phone", () => {
    test.use({ viewport: { width: 390, height: 844 } });

    test("renders without horizontal overflow and keeps the nav reachable", async ({ page }) => {
      await visit(page, "/");
      await expect(page.locator("h1")).toContainText(FEATURED);
      for (const name of ["Scores", "Rankings", "Bracket"]) {
        await expect(page.locator("nav").getByRole("link", { name })).toBeVisible();
      }
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      expect(overflow, "page wider than the viewport").toBeLessThanOrEqual(0);
    });
  });
});

test.describe("scores", () => {
  test("defaults to today", async ({ page }) => {
    await visit(page, "/scores");
    await expect(page.locator("h1")).toHaveText(new RegExp(`^\\w+, \\w+ \\d+, ${SEASON_YEAR}$`));
    await expect(page.getByText(/\d+ of \d+ matches shown/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Prev/ })).toHaveAttribute("href", /\/scores\?date=\d{4}-\d{2}-\d{2}/);
  });

  test("lists a full day of final matches from earlier in the season", async ({ page }) => {
    await visit(page, `/scores?date=${PAST_DATE}`);
    await expect(page.locator("h1")).toHaveText(`Saturday, September 12, ${SEASON_YEAR}`);
    const summary = await page.getByText(/(\d+) of (\d+) matches shown/).textContent();
    const total = Number(summary?.match(/of (\d+) matches/)?.[1]);
    expect(total, "matches on a September Saturday").toBeGreaterThan(20);
    expect(await page.locator('a[href^="/matches/"]').count()).toBeGreaterThan(0);
  });
});

test.describe("rankings", () => {
  test("AVCA poll has exactly 25 rows", async ({ page }) => {
    await visit(page, "/rankings");
    await expect(page.locator("h1")).toHaveText("Rankings");
    await expect(rows(page)).toHaveCount(25);
    await expect(page.locator("table.data th", { hasText: "Points" })).toBeVisible();
  });

  test("RPI covers the whole division", async ({ page }) => {
    await visit(page, "/rankings?poll=rpi");
    expect(await rows(page).count()).toBeGreaterThan(300);
    await expect(rows(page).filter({ hasText: FEATURED })).toHaveCount(1);
  });

  test("committee top 16 is either loaded or explicitly not yet", async ({ page }) => {
    // Flips from the empty state to a 16-row table once ncaa.com posts the 2026 reveal and
    // the rankings job accepts it (see isCurrentSeasonLabel). Either state is fine; a blank
    // card or a 500 is not.
    await visit(page, "/rankings?poll=committee");
    const table = rows(page);
    if ((await table.count()) > 0) {
      await expect(table).toHaveCount(16);
    } else {
      await expect(page.getByText("This poll has not been loaded yet")).toBeVisible();
    }
  });
});

test.describe("standings", () => {
  test("shows every conference with the featured conference first", async ({ page }) => {
    await visit(page, "/standings");
    await expect(page.locator("h1")).toHaveText("Conference standings");
    expect(await page.locator("table.data").count()).toBeGreaterThanOrEqual(30);
    await expect(page.locator("table.data").first().locator("tbody tr", { hasText: FEATURED })).toHaveCount(1);
  });

  test("filters to one conference", async ({ page }) => {
    await visit(page, "/standings?conf=acc");
    await expect(page.locator("table.data")).toHaveCount(1);
    await expect(rows(page).filter({ hasText: FEATURED })).toHaveCount(1);
    await expect(page.locator("table.data th", { hasText: "Last 5" })).toBeVisible();
  });
});

test.describe("stats", () => {
  test("individual leaders load by default", async ({ page }) => {
    await visit(page, "/stats");
    await expect(page.locator("h1")).toHaveText("National leaders");
    expect(await rows(page).count()).toBeGreaterThan(10);
    await expect(page.locator("table.data th", { hasText: "Player" })).toBeVisible();
  });

  test("team leaders load too", async ({ page }) => {
    await visit(page, "/stats?scope=team");
    expect(await rows(page).count()).toBeGreaterThan(10);
    await expect(page.locator("table.data th", { hasText: "Player" })).toHaveCount(0);
  });
});

test.describe("teams", () => {
  test("index lists the whole division grouped by conference", async ({ page }) => {
    await visit(page, "/teams");
    await expect(page.locator("h1")).toHaveText("Division I teams");
    expect(await page.locator('a[href^="/teams/"]').count()).toBeGreaterThan(300);
    await expect(page.getByRole("link", { name: FEATURED, exact: true })).toBeVisible();
  });

  test("featured team page has a record, schedule and roster", async ({ page }) => {
    await visit(page, "/teams/stanford");
    await expect(page.locator("h1")).toContainText(FEATURED);
    await expect(page.getByText(/ · \d+-\d+ \(\d+-\d+\) · home /)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Schedule and results" })).toBeVisible();
    expect(await page.locator('a[href^="/matches/"]').count()).toBeGreaterThan(5);
    await expect(page.getByRole("heading", { name: "Players" })).toBeVisible();
    expect(await rows(page).count()).toBeGreaterThan(5);
    await expect(page.getByRole("heading", { name: "Tournament resume" })).toBeVisible();
  });

  test("unknown team is a 404, not a crash", async ({ page }) => {
    await visit(page, "/teams/not-a-real-team", 404);
    await expect(page.locator("h1")).toHaveText("Not found");
  });
});

test.describe("match", () => {
  test("the featured team's last box score renders set scores and both teams' stats", async ({ page }) => {
    // Follow the home page's link rather than hardcoding an id, so the test tracks the season.
    await visit(page, "/");
    const href = await page.getByRole("link", { name: /Box score/ }).getAttribute("href");
    expect(href).toMatch(/^\/matches\/\d+$/);
    await visit(page, href!);
    await expect(page.getByText("Final", { exact: true })).toBeVisible();
    await expect(page.locator("table.data th", { hasText: "Set 1" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Team stats" })).toBeVisible();
    await expect(page.locator("table.data td", { hasText: "Kills" })).toBeVisible();
    // Two player tables, one per side, each with a roster.
    const playerTables = page.locator("table.data").filter({ has: page.locator("th", { hasText: "BA" }) });
    await expect(playerTables).toHaveCount(2);
    for (const t of await playerTables.all()) expect(await t.locator("tbody tr").count()).toBeGreaterThan(5);
  });

  test("unknown match is a 404, not a crash", async ({ page }) => {
    await visit(page, "/matches/0", 404);
    await expect(page.locator("h1")).toHaveText("Not found");
  });
});

test.describe("bracket", () => {
  test("projects a 64-team field with 16 seeds and consistent bid counts", async ({ page }) => {
    await visit(page, "/bracket");
    await expect(page.locator("h1")).toHaveText("Bracketology");

    const summary = await page.getByText(/Projected \d+-team field/).textContent();
    const m = summary?.match(/Projected (\d+)-team field · (\d+) automatic bids \((\d+) settled\) · (\d+) at-large/);
    expect(m, `field summary: ${summary}`).not.toBeNull();
    const [, field, auto, settled, atLarge] = m!.map(Number);
    expect(field).toBe(64);
    expect(auto + atLarge).toBe(64);
    expect(settled).toBeLessThanOrEqual(auto);

    const tables = page.locator("table.data");
    await expect(tables.nth(0).locator("tbody tr")).toHaveCount(16); // seeds
    await expect(tables.nth(1).locator("tbody tr")).toHaveCount(48); // rest of the field
    await expect(tables.nth(3).locator("tbody tr")).toHaveCount(auto); // one row per automatic bid

    // The featured team is placed somewhere: seeded, in the field, on the bubble, or out.
    await expect(page.getByText(new RegExp(`${FEATURED}.*(projects as|is on the bubble)|featured team is not`))).toBeVisible();
    await expect(page.getByRole("heading", { name: "Method" })).toBeVisible();
  });
});

test.describe("data freshness", () => {
  // The only check that notices the scheduled ingest silently dying. On main CI treats a
  // stale database as a failure; elsewhere it is a warning, so an upstream outage at
  // ncaa-api.henrygd.me does not block unrelated changes.
  function report(ok: boolean, message: string) {
    if (ok) return;
    if (STRICT_FRESHNESS) expect(ok, message).toBe(true);
    test.info().annotations.push({ type: "warning", description: message });
    console.warn(`freshness warning: ${message}`);
  }

  test("the last ingest and the RPI table are recent", async ({ page }) => {
    await visit(page, "/bracket");

    // Footer: "Data last updated Tue, Oct 13, 2:33 PM PDT" (no year; assume the current one).
    const footer = (await page.locator("footer").textContent()) ?? "";
    const upd = footer.match(/Data last updated \w+, (\w+) (\d+), /);
    expect(upd, `footer has a last-updated stamp: ${footer}`).not.toBeNull();
    const now = new Date();
    let updated = new Date(`${upd![1]} ${upd![2]} ${now.getFullYear()} 12:00 UTC`);
    if (updated.getTime() - now.getTime() > 7 * 86_400_000) updated = new Date(`${upd![1]} ${upd![2]} ${now.getFullYear() - 1} 12:00 UTC`);
    const daysSinceIngest = (now.getTime() - updated.getTime()) / 86_400_000;
    report(daysSinceIngest <= 3, `last ingest was ${daysSinceIngest.toFixed(1)} days ago (${upd![0].trim()})`);

    // "Everything below is a projection from RPI (through Oct. 11 2026), ..." — RPI posts weekly.
    const intro = (await page.getByText(/projection from RPI/).textContent()) ?? "";
    const thru = intro.match(/through ([A-Za-z]+)\.? (\d+) (\d{4})/);
    expect(thru, `bracket names the RPI through-date: ${intro}`).not.toBeNull();
    const rpiDate = new Date(`${thru![1]} ${thru![2]} ${thru![3]} 12:00 UTC`);
    const daysSinceRpi = (now.getTime() - rpiDate.getTime()) / 86_400_000;
    report(daysSinceRpi <= 14, `RPI is ${daysSinceRpi.toFixed(0)} days old (through ${thru![1]} ${thru![2]} ${thru![3]})`);
  });
});
