"use client";

import { useEffect, useState } from "react";
import type { MatchView } from "@/lib/views";
import { MatchRow } from "./MatchRow";

export type LiveEvent = {
  id: string;
  state: string;
  completed: boolean;
  detail: string | null;
  home: { espnId: string; sets: number | null; linescores: number[] };
  away: { espnId: string; sets: number | null; linescores: number[] };
};

function merge(m: MatchView, ev: LiveEvent): MatchView {
  const flipped = ev.home.espnId !== m.home.espnId;
  const h = flipped ? ev.away : ev.home;
  const a = flipped ? ev.home : ev.away;
  const n = Math.min(h.linescores.length, a.linescores.length);
  const setScores = n ? Array.from({ length: n }, (_, i) => ({ home: h.linescores[i], away: a.linescores[i] })) : m.setScores;
  const state = ev.completed ? "final" : ev.state === "in" ? "live" : m.state;
  return { ...m, state, homeSets: h.sets ?? m.homeSets, awaySets: a.sets ?? m.awaySets, setScores, period: state === "live" ? ev.detail : m.period };
}

/** Renders matches for a day and overlays live ESPN set scores, refreshing while any match is live or upcoming. */
export function LiveScoreboard({ matches, date, featured, pollMs = 45_000 }: { matches: MatchView[]; date: string; featured?: string; pollMs?: number }) {
  const [live, setLive] = useState<Map<string, LiveEvent>>(new Map());
  const [updated, setUpdated] = useState<string | null>(null);
  const anyActive = matches.some((m) => m.state !== "final");

  useEffect(() => {
    if (!anyActive) return;
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch(`/api/live?date=${date}`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { fetchedAt: string; events: LiveEvent[] };
        if (stop) return;
        setLive(new Map(data.events.map((e) => [e.id, e])));
        setUpdated(data.fetchedAt);
      } catch {
        /* keep the server-rendered scores */
      }
    };
    tick();
    const t = setInterval(tick, pollMs);
    return () => {
      stop = true;
      clearInterval(t);
    };
  }, [date, pollMs, anyActive]);

  const merged = matches.map((m) => (m.espnEventId && live.get(m.espnEventId) ? merge(m, live.get(m.espnEventId)!) : m));
  return (
    <div>
      {merged.map((m) => (
        <MatchRow key={m.id} m={m} featured={featured} />
      ))}
      {updated && <p className="pt-2 text-right text-[11px] text-muted">Live scores updated {new Date(updated).toLocaleTimeString()}</p>}
    </div>
  );
}
