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
  // Best of the day by the points system (batting / bowling / fielding parts of the MVP points)
  const bestBat = pickBest(ranking, (a) => a.batPoints, (a) => a.runs, (a) => -a.balls);
  const bestBowl = pickBest(ranking, (a) => a.bowlPoints, (a) => a.wickets, (a) => -a.bowlRuns);
  const bestField = pickBest(ranking, (a) => a.fieldPoints, (a) => a.catches, () => 0);
  const live = d.bundles.find((b) => b.match.status === "live") ?? null;
  return {
    series,
    ranking,
    potd,
    potdText: potd ? potdMessage(potd.playerId + d.day.id, names[potd.playerId] ?? "?", potd) : null,
    topBat,
    topBowl,
    bestBat,
    bestBowl,
    bestField,
    mvp: d.day.mvp_player_id ?? null,
    live,
    allDone: d.bundles.length > 0 && done.length === d.bundles.length,
  };
}

function pickBest<T>(items: T[], score: (t: T) => number, tie1: (t: T) => number, tie2: (t: T) => number): T | null {
  const c = items.filter((i) => score(i) > 0);
  c.sort((a, b) => score(b) - score(a) || tie1(b) - tie1(a) || tie2(b) - tie2(a));
  return c[0] ?? null;
}
