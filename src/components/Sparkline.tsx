/** Inline SVG rank sparkline. Lower rank is better, so the y axis is inverted. */
export function RankSparkline({ ranks, width = 160, height = 40, max = 25 }: { ranks: number[]; width?: number; height?: number; max?: number }) {
  if (ranks.length < 2) return null;
  const top = Math.max(max, ...ranks);
  const pad = 4;
  const x = (i: number) => pad + (i / (ranks.length - 1)) * (width - pad * 2);
  const y = (r: number) => pad + ((r - 1) / (top - 1)) * (height - pad * 2);
  const d = ranks.map((r, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(r).toFixed(1)}`).join(" ");
  const last = ranks[ranks.length - 1];
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Rank history, now ${last}`}>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={x(ranks.length - 1)} cy={y(last)} r={3} fill="currentColor" />
    </svg>
  );
}
