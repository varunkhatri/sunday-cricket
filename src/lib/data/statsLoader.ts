import { daysInRange, loadDays, monthRange, listDays } from "./queries";
import { matchPerformances, type PlayerMatchPerf } from "../cricket/stats";

export type DatedPerf = PlayerMatchPerf & { date: string };

export interface RangeParams { month?: string; from?: string; to?: string }

export function resolveRange(p: RangeParams) {
  if (p.month && /^\d{4}-\d{2}$/.test(p.month)) return { ...monthRange(p.month), label: p.month };
  const from = p.from && /^\d{4}-\d{2}-\d{2}$/.test(p.from) ? p.from : undefined;
  const to = p.to && /^\d{4}-\d{2}-\d{2}$/.test(p.to) ? p.to : undefined;
  return { from, to, label: from || to ? "custom" : "all" };
}

export async function loadRange(p: RangeParams) {
  const r = resolveRange(p);
  const days = await loadDays(await daysInRange(r.from, r.to));
  const perfs: DatedPerf[] = days.flatMap((d) =>
    d.bundles.filter((b) => b.match.status === "completed").flatMap((b) => matchPerformances(b).map((x) => ({ ...x, date: d.day.date }))),
  );
  return { range: r, days, perfs };
}

/** Months (YYYY-MM) that have at least one match day, newest first. */
export async function availableMonths() {
  const days = await listDays();
  return [...new Set(days.map((d) => d.date.slice(0, 7)))].sort().reverse();
}
