import { Suspense } from "react";
import Leaderboard from "@/components/Leaderboard";
import MonthPicker from "@/components/MonthPicker";
import { aggregatePlayers } from "@/lib/cricket/stats";
import { getPlayerNames } from "@/lib/data/queries";
import { availableMonths, loadRange } from "@/lib/data/statsLoader";
import { POINTS, POINTS_ORIGINAL } from "@/lib/cricket/stats";

export const dynamic = "force-dynamic";

export default async function StatsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const [{ perfs, days }, names, months] = await Promise.all([loadRange(searchParams), getPlayerNames(), availableMonths()]);
  const rows = aggregatePlayers(perfs);
  const matches = days.reduce((n, d) => n + d.bundles.filter((b) => b.match.status === "completed").length, 0);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Player stats</h1>
        <p className="muted">{days.length} Sunday{days.length === 1 ? "" : "s"} · {matches} completed match{matches === 1 ? "" : "es"}</p>
      </div>
      <Suspense><MonthPicker months={months} /></Suspense>
      <Leaderboard rows={rows} names={names} />
      <details className="card p-4 text-sm">
        <summary className="cursor-pointer font-semibold text-pitch">How are MVP points worked out?</summary>
        <p className="mt-2 muted">
          From 1 November 2026: {POINTS.run} per run, +{POINTS.fourBonus} per four, +{POINTS.sixBonus} per six, {POINTS.wicket} per wicket, {POINTS.maiden} per maiden,
          {" "}{POINTS.fielding} per catch / run-out / stumping, +{POINTS.thirty} for 30+, +{POINTS.fifty} more for 50+, +{POINTS.threeFor} for a 3-wicket haul,
          and +{POINTS.win} for being on the winning side. The Player of the Day is whoever scores the most points that Sunday.
        </p>
        <p className="mt-2 text-xs muted">
          Earlier Sundays keep the points they were played under ({POINTS_ORIGINAL.wicket} per wicket, {POINTS_ORIGINAL.maiden} per maiden,
          {" "}{POINTS_ORIGINAL.fielding} per catch / run-out / stumping, the rest the same), so past awards never change.
        </p>
      </details>
    </div>
  );
}
