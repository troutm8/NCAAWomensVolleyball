import { NextResponse } from "next/server";
import { ESPN_BASE, scoreboardSchema, setScoresOf } from "@/ingest/sources/espn";
import { isValidYmd, todayEastern } from "@/lib/season";
import type { LiveEvent } from "@/components/LiveScoreboard";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("date") ?? undefined;
  const date = isValidYmd(q) ? q : todayEastern();
  try {
    const res = await fetch(`${ESPN_BASE}/scoreboard?dates=${date.replace(/-/g, "")}&limit=400`, { next: { revalidate: 30 } });
    if (!res.ok) return NextResponse.json({ error: `espn ${res.status}` }, { status: 502 });
    const board = scoreboardSchema.parse(await res.json());
    const events: LiveEvent[] = [];
    for (const ev of board.events) {
      const comp = ev.competitions[0];
      const home = comp.competitors.find((c) => c.homeAway === "home");
      const away = comp.competitors.find((c) => c.homeAway === "away");
      if (!home || !away) continue;
      const sets = setScoresOf(ev) ?? [];
      const toInt = (s?: string) => (s != null && s !== "" && Number.isFinite(Number(s)) ? Number(s) : null);
      events.push({
        id: ev.id,
        state: comp.status.type.state,
        completed: comp.status.type.completed,
        detail: comp.status.type.shortDetail ?? comp.status.type.detail ?? null,
        home: { espnId: home.team.id, sets: toInt(home.score), linescores: sets.map((s) => s.home) },
        away: { espnId: away.team.id, sets: toInt(away.score), linescores: sets.map((s) => s.away) },
      });
    }
    return NextResponse.json({ fetchedAt: new Date().toISOString(), date, events }, { headers: { "cache-control": "public, max-age=20" } });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 502 });
  }
}
