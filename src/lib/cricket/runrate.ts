import type { MatchBundle } from "../types";
import { isLegal, isTeamWicket, totalRuns } from "./engine";
import { withOverIndex } from "./scorecard";

export interface OverPoint {
  over: number; // 1-based
  runs: number; // runs scored in this over
  wickets: number;
  totalRuns: number; // score at the end of this over
  legalBalls: number; // legal balls bowled so far in the innings
  runRate: number; // run rate after this over
  partial: boolean; // over still in progress
}

export interface InningsSeries {
  teamId: string;
  teamName: string;
  inningsNo: 1 | 2;
  points: OverPoint[];
}

/** Over-by-over runs and run rate for each innings, for the charts. */
export function runRateSeries(bundle: MatchBundle): InningsSeries[] {
  return bundle.innings.map((inn) => {
    const rows = withOverIndex(bundle.balls.filter((b) => b.innings_id === inn.id && !b.non_delivery));
    const pts: OverPoint[] = [];
    let total = 0;
    let legal = 0;
    for (const { ball, overIdx } of rows) {
      while (pts.length <= overIdx)
        pts.push({ over: pts.length + 1, runs: 0, wickets: 0, totalRuns: total, legalBalls: legal, runRate: 0, partial: true });
      const p = pts[overIdx];
      total += totalRuns(ball);
      if (isLegal(ball)) legal++;
      p.runs += totalRuns(ball);
      if (isTeamWicket(ball)) p.wickets++;
      p.totalRuns = total;
      p.legalBalls = legal;
      p.partial = legal < (overIdx + 1) * 6;
      p.runRate = legal ? total / (legal / 6) : 0;
    }
    const team = inn.batting_team_id === bundle.teamA.id ? bundle.teamA : bundle.teamB;
    return { teamId: team.id, teamName: team.name, inningsNo: inn.innings_no, points: pts };
  });
}
