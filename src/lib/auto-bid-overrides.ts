/**
 * Hand-entered conference automatic qualifiers.
 *
 * The auto-bid tracker reads conference tournament results out of the match data, which is
 * right as long as a conference's tournament final is the last conference match it plays.
 * When that breaks — a conference that awards its bid to the regular-season champion, a
 * tournament ncaa.com does not tag as conference play, a vacated title — add the answer
 * here and it wins over anything derived. Same spirit as
 * `data/team-crosswalk-overrides.csv`: derive first, hand-fix the leftovers.
 */
export type AutoBidOverride = {
  /** Conference slug as stored on `teams.conference_slug` (e.g. "pac-12"). */
  conf: string;
  /** Team slug of the automatic qualifier. */
  team: string;
  /** Shown next to the bid on /bracket, so the override is never invisible. */
  note: string;
};

export const AUTO_BID_OVERRIDES: AutoBidOverride[] = [
  // { conf: "ivy-league", team: "princeton", note: "Regular-season champion; no conference tournament." },
];

/**
 * Conference slugs that do not award an automatic bid this season.
 *
 * The number of automatic bids is derived from the data — every conference with at least
 * two Division I members that has played — which gives 32 for 2026 now that the Pac-12 has
 * rebuilt to nine volleyball members. NCAA automatic-qualification rules (member counts,
 * years of continuous operation) are not in any feed, so if a conference turns out not to
 * qualify, list it here and its slot goes to the next at-large instead.
 */
export const NO_AUTO_BID: string[] = [];
