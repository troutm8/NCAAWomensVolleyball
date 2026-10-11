import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { getFeaturedTeam, getLastIngest } from "@/lib/queries";
import { TeamLogo } from "@/components/TeamLogo";
import { teamView } from "@/lib/views";
import { SEASON_YEAR } from "@/lib/season";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = {
  title: { default: `Cardinal Volleyball ${SEASON_YEAR}`, template: `%s · Cardinal Volleyball ${SEASON_YEAR}` },
  description: "Stanford women's volleyball and the NCAA Division I season at a glance.",
};

export const dynamic = "force-dynamic";

const NAV = [
  ["/", "Home"],
  ["/scores", "Scores"],
  ["/rankings", "Rankings"],
  ["/standings", "Standings"],
  ["/bracket", "Bracket"],
  ["/stats", "Stats"],
  ["/teams", "Teams"],
] as const;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const [featured, last] = await Promise.all([getFeaturedTeam(), getLastIngest()]);
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-line bg-card">
          <div className="mx-auto flex max-w-6xl items-center gap-4 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 font-semibold">
              {featured && <TeamLogo team={teamView(featured)} size={32} />}
              <span className="whitespace-nowrap">
                Cardinal <span className="hidden sm:inline">Volleyball</span> <span className="text-muted">{SEASON_YEAR}</span>
              </span>
            </Link>
            <nav className="-mr-4 ml-auto flex gap-0.5 overflow-x-auto pr-4 text-sm sm:gap-1">
              {NAV.map(([href, label]) => (
                <Link key={href} href={href} className="rounded-md px-2 py-1.5 hover:bg-soft sm:px-3">
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
        <footer className="mx-auto max-w-6xl px-4 py-8 text-xs text-muted">
          Scores, box scores, RPI and polls from ncaa.com; live set scores and logos from ESPN. Unofficial, for personal use.
          {last && <> Data last updated {fmtDateTime(last)}.</>}
        </footer>
      </body>
    </html>
  );
}
