import type { DayFull } from "./data/queries";
import type { ID } from "./types";
import { computeSeries, matchPerformances, rankDay, topBy } from "./cricket/stats";
import { potdMessage } from "./cricket/summary";

export function dayOverview(d: DayFull, names: Record<ID, string>) {
  const series = computeSeries(d.teams, d.bundles);
  const done = d.bundles.filter((b) => b.match.status === "completed");
  const perfs = done.flatMap(matchPerformances);
  const ranking = rankDay(perfs);
  const potd = ranking[0] ?? null;
  const topBat = topBy(ranking, (a) => a.runs, (a) => a.balls);
  const topBowl = topBy(ranking, (a) => a.wickets, (a) => a.bowlRuns);
  const live = d.bundles.find((b) => b.match.status === "live") ?? null;
  return {
    series,
    ranking,
    potd,
    potdText: potd ? potdMessage(potd.playerId + d.day.id, names[potd.playerId] ?? "?", potd) : null,
    topBat,
    topBowl,
    live,
    allDone: d.bundles.length > 0 && done.length === d.bundles.length,
  };
}
