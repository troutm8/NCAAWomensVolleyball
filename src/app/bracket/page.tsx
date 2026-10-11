import Link from "next/link";
import { Card, Empty } from "@/components/Card";
import { TeamName } from "@/components/TeamName";
import { daysUntil, fmtYmd, num, ordinal } from "@/lib/format";
import {
  BUBBLE_SIZE,
  FIELD_SIZE,
  SEED_COUNT,
  WEIGHTS,
  getBracketology,
  type BidStatus,
  type ConferenceBid,
  type FieldEntry,
  type Resume,
} from "@/lib/bracketology";
import { FEATURED_TEAM, todayEastern } from "@/lib/season";
import { teamView } from "@/lib/views";

export const metadata = { title: "Bracketology" };

const SELECTION_DAY = "2026-11-29";

/** ncaa.com labels its tables "Through Games Oct. 04 2026"; keep just the date part. */
function throughDate(asOf: string | null): string | null {
  return asOf ? asOf.replace(/^through games\s*/i, "").trim() : null;
}

const STATUS_LABEL: Record<BidStatus, string> = {
  clinched: "Clinched",
  underway: "Tournament underway",
  projected: "Projected",
  override: "Entered by hand",
};

function StatusPill({ status }: { status: BidStatus }) {
  const tone =
    status === "clinched"
      ? "bg-win/15 text-win"
      : status === "underway"
        ? "bg-live/15 text-live"
        : status === "override"
          ? "bg-cardinal/10 text-cardinal dark:text-red-300"
          : "bg-soft text-muted";
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${tone}`}>{STATUS_LABEL[status]}</span>;
}

function Record({ wl }: { wl: [number, number] }) {
  return (
    <span className="tabular">
      {wl[0]}-{wl[1]}
    </span>
  );
}

/** The five score inputs as a stacked bar, so the weighting is visible per team. */
function ScoreBar({ r }: { r: Resume }) {
  const parts: [keyof typeof WEIGHTS, string][] = [
    ["rpi", "bg-cardinal"],
    ["poll", "bg-cardinal/60"],
    ["quality", "bg-win/70"],
    ["avoid", "bg-muted/60"],
    ["road", "bg-live/60"],
  ];
  return (
    <span className="inline-flex h-2 w-24 overflow-hidden rounded-full bg-soft align-middle" title={parts.map(([k]) => `${k} ${num(r.components[k], 1)}/${WEIGHTS[k]}`).join(" · ")}>
      {parts.map(([k, cls]) => (
        <span key={k} className={cls} style={{ width: `${r.components[k]}%` }} />
      ))}
    </span>
  );
}

function FieldTable({ rows, featured }: { rows: FieldEntry[]; featured: string }) {
  return (
    <table className="data w-full text-sm">
      <thead>
        <tr>
          <th className="r">Seed</th>
          <th>Team</th>
          <th>Conference</th>
          <th className="r">RPI</th>
          <th className="r">AVCA</th>
          <th className="r">Record</th>
          <th className="r">vs T25</th>
          <th className="r">vs T50</th>
          <th className="r">Rd/N</th>
          <th className="r">Bid</th>
          <th className="r">Score</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((e) => {
          const r = e.resume;
          const isFeatured = r.team.slug === featured;
          return (
            <tr key={r.team.slug} className={isFeatured ? "bg-soft font-semibold" : ""}>
              <td className="r tabular font-semibold">{e.seed ?? <span className="text-muted">{e.overall}</span>}</td>
              <td>
                <TeamName team={teamView(r.team)} size={20} featured={isFeatured} />
              </td>
              <td className="text-muted">{r.confName}</td>
              <td className="r tabular">{r.rpiRank ?? "—"}</td>
              <td className="r tabular text-muted">{r.avcaRank ?? "—"}</td>
              <td className="r">
                <Record wl={[r.record.wins, r.record.losses]} />
              </td>
              <td className="r text-muted">
                <Record wl={r.quality.top25} />
              </td>
              <td className="r text-muted">
                <Record wl={r.quality.top50} />
              </td>
              <td className="r text-muted">
                <Record wl={r.roadNeutral} />
              </td>
              <td className="r">
                {e.bid === "auto" ? (
                  <span className="text-[11px] font-semibold uppercase tracking-wide text-muted">{e.bidStatus === "clinched" ? "Auto ✓" : "Auto"}</span>
                ) : (
                  <span className="text-[11px] uppercase tracking-wide text-muted">At-large</span>
                )}
              </td>
              <td className="r tabular">
                <span className="mr-2 align-middle">{num(r.score, 1)}</span>
                <ScoreBar r={r} />
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function BidRow({ b, featured }: { b: ConferenceBid; featured: string }) {
  const r = b.team;
  return (
    <tr className={r?.team.slug === featured ? "bg-soft font-semibold" : ""}>
      <td>{b.confName}</td>
      <td>{r ? <TeamName team={teamView(r.team)} size={20} featured={r.team.slug === featured} /> : <span className="text-muted">—</span>}</td>
      <td className="r tabular text-muted">{r ? `${r.record.confWins}-${r.record.confLosses}` : "—"}</td>
      <td className="r tabular">{r?.rpiRank ?? "—"}</td>
      <td className="r">
        <StatusPill status={b.status} />
      </td>
      <td className="text-xs text-muted">
        {b.note ??
          (b.decidesOn
            ? `${b.pending} conference match${b.pending === 1 ? "" : "es"} to play, last scheduled ${fmtYmd(b.decidesOn, { month: "short", day: "numeric" })}`
            : "")}
      </td>
    </tr>
  );
}

export default async function BracketPage() {
  const today = todayEastern();
  const b = await getBracketology(today);
  if (!b.field.length) {
    return (
      <Empty>
        No results yet. Run <code>pnpm ingest backfill</code> to load the season.
      </Empty>
    );
  }

  const featuredEntry = b.field.find((e) => e.resume.team.slug === FEATURED_TEAM);
  const featuredBubble = b.bubble.find((r) => r.team.slug === FEATURED_TEAM);
  const clinched = b.bids.filter((x) => x.status === "clinched" || x.status === "override").length;
  const days = daysUntil(SELECTION_DAY, today);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h1 className="text-xl font-bold">Bracketology</h1>
        <p className="text-sm text-muted">
          Projected {FIELD_SIZE}-team field · {b.bids.length} automatic bids ({clinched} settled) · {b.atLargeCount} at-large
        </p>
      </div>

      {b.selectionDone ? (
        <p className="rounded-lg border border-line bg-soft px-4 py-3 text-sm">
          The field was announced on {fmtYmd(SELECTION_DAY, { month: "long", day: "numeric" })}. This page still shows the projection; the real bracket is not loaded
          yet.
        </p>
      ) : (
        <p className="text-sm text-muted">
          {days} day{days === 1 ? "" : "s"} until the selection show on {fmtYmd(SELECTION_DAY, { weekday: "long", month: "long", day: "numeric" })}. Everything below
          is a projection from RPI {b.rpiAsOf ? `(through ${throughDate(b.rpiAsOf)})` : ""}, the AVCA poll and completed matches — not an NCAA product.
        </p>
      )}

      {/* Where the featured team stands. */}
      <section className="rounded-xl border border-line bg-card p-5 shadow-sm">
        {featuredEntry ? (
          <p className="text-lg">
            <TeamName team={teamView(featuredEntry.resume.team)} size={28} bold featured /> projects as{" "}
            <strong>
              {featuredEntry.seed ? `the #${featuredEntry.seed} seed` : `${ordinal(featuredEntry.overall)} overall, in the field but unseeded`}
            </strong>{" "}
            {featuredEntry.bid === "auto" ? "with the conference automatic bid" : "as an at-large"}.
          </p>
        ) : featuredBubble ? (
          <p className="text-lg">
            <TeamName team={teamView(featuredBubble.team)} size={28} bold featured /> is <strong>on the bubble</strong>, just outside the projected field.
          </p>
        ) : (
          <p className="text-lg text-muted">The featured team is not in the projected field or the bubble.</p>
        )}
        {featuredEntry && (
          <p className="mt-2 text-sm text-muted">
            RPI {featuredEntry.resume.rpiRank ?? "—"} · AVCA {featuredEntry.resume.avcaRank ?? "NR"} · {featuredEntry.resume.record.wins}-
            {featuredEntry.resume.record.losses} · vs RPI top 25 {featuredEntry.resume.quality.top25[0]}-{featuredEntry.resume.quality.top25[1]} · road and
            neutral {featuredEntry.resume.roadNeutral[0]}-{featuredEntry.resume.roadNeutral[1]} · score {num(featuredEntry.resume.score, 1)}
          </p>
        )}
      </section>

      <Card title={`Projected seeds 1–${SEED_COUNT}`}>
        <p className="mb-3 text-xs text-muted">The top {SEED_COUNT} host the first two rounds, December 3–5.</p>
        <div className="overflow-x-auto">
          <FieldTable rows={b.seeds} featured={FEATURED_TEAM} />
        </div>
      </Card>

      <Card title={`Rest of the field (${SEED_COUNT + 1}–${FIELD_SIZE})`}>
        <div className="overflow-x-auto">
          <FieldTable rows={b.field.slice(SEED_COUNT)} featured={FEATURED_TEAM} />
        </div>
      </Card>

      <Card title={`Bubble — next ${BUBBLE_SIZE} out`}>
        <div className="overflow-x-auto">
          <table className="data w-full text-sm">
            <thead>
              <tr>
                <th>Team</th>
                <th>Conference</th>
                <th className="r">RPI</th>
                <th className="r">Record</th>
                <th className="r">vs T50</th>
                <th className="r">Bad losses</th>
                <th className="r">Score</th>
              </tr>
            </thead>
            <tbody>
              {b.bubble.map((r) => (
                <tr key={r.team.slug} className={r.team.slug === FEATURED_TEAM ? "bg-soft font-semibold" : ""}>
                  <td>
                    <TeamName team={teamView(r.team)} size={20} featured={r.team.slug === FEATURED_TEAM} />
                  </td>
                  <td className="text-muted">{r.confName}</td>
                  <td className="r tabular">{r.rpiRank ?? "—"}</td>
                  <td className="r">
                    <Record wl={[r.record.wins, r.record.losses]} />
                  </td>
                  <td className="r text-muted">
                    <Record wl={r.quality.top50} />
                  </td>
                  <td className="r tabular text-muted">{r.badLosses || "—"}</td>
                  <td className="r tabular">{num(r.score, 1)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title={`Automatic bids (${clinched} of ${b.bids.length} settled)`}>
        <p className="mb-3 text-xs text-muted">
          Each conference champion takes an automatic bid. Until a conference has played its last conference match, the bid shows as projected — the current
          conference leader.
        </p>
        <div className="overflow-x-auto">
          <table className="data w-full text-sm">
            <thead>
              <tr>
                <th>Conference</th>
                <th>Bid</th>
                <th className="r">Conf</th>
                <th className="r">RPI</th>
                <th className="r">Status</th>
                <th>Note</th>
              </tr>
            </thead>
            <tbody>
              {b.bids.map((bid) => (
                <BidRow key={bid.conf} b={bid} featured={FEATURED_TEAM} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Method">
        <div className="space-y-2 text-sm text-muted">
          <p>
            Every team with a completed match gets a composite score out of 100. Conference champions (projected or settled) take the{" "}
            {b.bids.length} automatic bids; the remaining {b.atLargeCount} slots go to the highest-scoring teams left. The whole field is then re-ranked by score,
            and the top {SEED_COUNT} are the seeds.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>{WEIGHTS.rpi} points — NCAA RPI rank.</strong> Linear from 1st down to last of {b.rpiTotal}. The committee's primary sorting tool, so it
              carries the most weight.
            </li>
            <li>
              <strong>{WEIGHTS.poll} points — AVCA Coaches Poll.</strong> Linear across the top 25; unranked teams score zero rather than being penalised.
            </li>
            <li>
              <strong>{WEIGHTS.quality} points — quality wins.</strong> Wins over the RPI top 25 count triple, 26–50 double, 51–100 single; 15 weighted points
              is full credit.
            </li>
            <li>
              <strong>{WEIGHTS.avoid} points — avoiding bad losses.</strong> Losses outside the RPI top 100 subtract, with losses outside 150 counting double.
            </li>
            <li>
              <strong>{WEIGHTS.road} points — road and neutral win rate.</strong> A team that has not played away from home yet gets half credit.
            </li>
          </ul>
          <p>
            Opponent quality uses each opponent's <em>current</em> RPI, the same way the committee's own "record versus RPI top 25/50" tables are built, so
            these numbers move as the season moves. Known limitations: real seeding also weighs host viability and avoids early conference rematches, neither of
            which is modelled here; a conference whose automatic bid does not go to the winner of its last conference match has to be corrected by hand in{" "}
            <code>src/lib/auto-bid-overrides.ts</code>.
          </p>
          <p>
            Based on data through {throughDate(b.rpiAsOf) ?? "the latest ingest"} for RPI and {throughDate(b.avcaAsOf) ?? "the latest poll"} for the AVCA poll. See{" "}
            <Link href="/rankings" className="underline">
              Rankings
            </Link>{" "}
            for the underlying tables.
          </p>
        </div>
      </Card>
    </div>
  );
}
