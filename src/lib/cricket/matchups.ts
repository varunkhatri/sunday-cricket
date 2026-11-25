import type { Ball, ID, MatchBundle, WicketType } from "../types";
import { facedByBatter, isBowlerWicket, isTeamWicket } from "./engine";

/** Ways of getting out, in the order they're shown. */
export const DISMISSAL_TYPES: { key: Exclude<WicketType, "retired">; label: string }[] = [
  { key: "bowled", label: "Bowled" },
  { key: "caught", label: "Caught" },
  { key: "lbw", label: "LBW" },
  { key: "run_out", label: "Run out" },
  { key: "stumped", label: "Stumped" },
  { key: "hit_wicket", label: "Hit wicket" },
  { key: "out_of_box", label: "Out of box" },
];

export interface FaceOff {
  /** the other player (bowler when looking at a batter, batter when looking at a bowler) */
  playerId: ID;
  balls: number; // legal balls faced (wides don't count)
  runs: number; // runs off the bat
  fours: number;
  sixes: number;
  dots: number;
  outs: number; // dismissals credited to the bowler
}

export interface Matchups {
  batting: {
    innings: number;
    outs: number;
    notOuts: number;
    retired: number;
    howOut: Record<string, number>; // by wicket type
    caughtBy: Record<ID, number>; // fielder → catches that got this batter out
    runOutBy: Record<ID, number>; // fielder → run outs of this batter
    vsBowlers: FaceOff[];
  };
  bowling: {
    wickets: number;
    howOut: Record<string, number>; // wicket types this bowler took (bowler-credited)
    caughtAndBowled: number;
    victims: FaceOff[]; // batters faced: balls, runs conceded off the bat, times dismissed
  };
}

const blankFace = (playerId: ID): FaceOff => ({ playerId, balls: 0, runs: 0, fours: 0, sixes: 0, dots: 0, outs: 0 });

/**
 * Head-to-head numbers for one player, worked out from the ball-by-ball data of the given matches.
 * Only finished matches should be passed in (like the rest of the stats).
 */
export function playerMatchups(bundles: MatchBundle[], playerId: ID): Matchups {
  const bat: Matchups["batting"] = { innings: 0, outs: 0, notOuts: 0, retired: 0, howOut: {}, caughtBy: {}, runOutBy: {}, vsBowlers: [] };
  const bowl: Matchups["bowling"] = { wickets: 0, howOut: {}, caughtAndBowled: 0, victims: [] };
  const vsB = new Map<ID, FaceOff>();
  const vsV = new Map<ID, FaceOff>();
  const face = (m: Map<ID, FaceOff>, id: ID) => {
    if (!m.has(id)) m.set(id, blankFace(id));
    return m.get(id)!;
  };

  for (const bundle of bundles) {
    for (const inn of bundle.innings) {
      const balls: Ball[] = bundle.balls.filter((b) => b.innings_id === inn.id).sort((a, b) => a.seq - b.seq);
      let batted = false;
      let out = false;
      let retiredNow = false;
      for (const b of balls) {
        const involvedBat = b.striker_id === playerId || b.non_striker_id === playerId;
        if (involvedBat) batted = true;

        // ---- as the batter ----
        if (b.striker_id === playerId && !b.non_delivery) {
          const f = face(vsB, b.bowler_id);
          if (facedByBatter(b)) {
            f.balls++;
            if (b.runs_bat === 0 && !b.extra_type) f.dots++;
          }
          f.runs += b.runs_bat;
          if (b.runs_bat === 4) f.fours++;
          if (b.runs_bat === 6) f.sixes++;
        }
        if (b.wicket_type && (b.dismissed_id ?? b.striker_id) === playerId) {
          if (b.wicket_type === "retired") {
            retiredNow = true;
          } else if (isTeamWicket(b)) {
            out = true;
            retiredNow = false;
            bat.howOut[b.wicket_type] = (bat.howOut[b.wicket_type] ?? 0) + 1;
            if (isBowlerWicket(b)) face(vsB, b.bowler_id).outs++;
            if (b.wicket_type === "caught" && b.fielder_id) bat.caughtBy[b.fielder_id] = (bat.caughtBy[b.fielder_id] ?? 0) + 1;
            if (b.wicket_type === "run_out" && b.fielder_id) bat.runOutBy[b.fielder_id] = (bat.runOutBy[b.fielder_id] ?? 0) + 1;
          }
        } else if (involvedBat && retiredNow && !b.non_delivery) {
          retiredNow = false; // came back in after retiring
        }

        // ---- as the bowler ----
        if (b.bowler_id === playerId && !b.non_delivery) {
          const v = face(vsV, b.striker_id);
          if (facedByBatter(b)) {
            v.balls++;
            if (b.runs_bat === 0 && !b.extra_type) v.dots++;
          }
          v.runs += b.runs_bat;
          if (b.runs_bat === 4) v.fours++;
          if (b.runs_bat === 6) v.sixes++;
          if (isBowlerWicket(b)) {
            const victim = b.dismissed_id ?? b.striker_id;
            face(vsV, victim).outs++;
            bowl.wickets++;
            bowl.howOut[b.wicket_type!] = (bowl.howOut[b.wicket_type!] ?? 0) + 1;
            if (b.wicket_type === "caught" && b.fielder_id === playerId) bowl.caughtAndBowled++;
          }
        }
      }
      if (batted) {
        bat.innings++;
        if (out) bat.outs++;
        else if (retiredNow) bat.retired++;
        else bat.notOuts++;
      }
    }
  }

  const byRuns = (a: FaceOff, b: FaceOff) => b.runs - a.runs || b.balls - a.balls || b.outs - a.outs;
  bat.vsBowlers = [...vsB.values()].filter((f) => f.balls > 0 || f.runs > 0 || f.outs > 0).sort(byRuns);
  bowl.victims = [...vsV.values()]
    .filter((f) => f.balls > 0 || f.runs > 0 || f.outs > 0)
    .sort((a, b) => b.outs - a.outs || a.runs - b.runs || b.balls - a.balls);
  return { batting: bat, bowling: bowl };
}

/** Strike rate, or null when no balls were faced. */
export const strikeRate = (f: Pick<FaceOff, "runs" | "balls">) => (f.balls ? (f.runs / f.balls) * 100 : null);
