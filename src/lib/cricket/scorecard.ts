import type { Ball, ID } from "../types";
import {
  ballSymbol,
  bowlerRuns,
  facedByBatter,
  isBowlerWicket,
  isLegal,
  isTeamWicket,
  oversText,
  totalRuns,
} from "./engine";

export interface BattingRow {
  playerId: ID;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  retired: boolean;
  wicketType: Ball["wicket_type"];
  bowlerId: ID | null;
  fielderId: ID | null;
  strikeRate: number;
}

export interface BowlingRow {
  playerId: ID;
  legalBalls: number;
  overs: string;
  maidens: number;
  runs: number;
  wickets: number;
  wides: number;
  noBalls: number;
  dots: number;
  economy: number;
}

export interface FallOfWicket {
  wicketNo: number;
  score: number;
  playerId: ID;
  overs: string;
}

export interface OverSummary {
  overNo: number; // 1-based
  bowlerId: ID;
  balls: Ball[];
  symbols: string[];
  runs: number;
  wickets: number;
  scoreAtEnd: string;
}

export interface Scorecard {
  batting: BattingRow[];
  bowling: BowlingRow[];
  fow: FallOfWicket[];
  overs: OverSummary[];
  fielding: Record<ID, { catches: number; runOuts: number; stumpings: number }>;
}

/** Over index (0-based) of each ball, by counting legal deliveries before it. */
export function withOverIndex(balls: Ball[]) {
  let legal = 0;
  return [...balls]
    .sort((a, b) => a.seq - b.seq)
    .map((b) => {
      const overIdx = Math.floor(legal / 6);
      if (isLegal(b)) legal++;
      return { ball: b, overIdx, legalAfter: legal };
    });
}

export function buildScorecard(balls: Ball[]): Scorecard {
  const rows = withOverIndex(balls);
  const bat = new Map<ID, BattingRow>();
  const bowl = new Map<ID, BowlingRow>();
  const fielding: Scorecard["fielding"] = {};
  const fow: FallOfWicket[] = [];
  const overs = new Map<number, OverSummary>();

  const batter = (id: ID) => {
    if (!bat.has(id))
      bat.set(id, {
        playerId: id,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
        retired: false,
        wicketType: null,
        bowlerId: null,
        fielderId: null,
        strikeRate: 0,
      });
    return bat.get(id)!;
  };
  const bowler = (id: ID) => {
    if (!bowl.has(id))
      bowl.set(id, {
        playerId: id,
        legalBalls: 0,
        overs: "0.0",
        maidens: 0,
        runs: 0,
        wickets: 0,
        wides: 0,
        noBalls: 0,
        dots: 0,
        economy: 0,
      });
    return bowl.get(id)!;
  };
  const field = (id: ID) => (fielding[id] ??= { catches: 0, runOuts: 0, stumpings: 0 });

  let score = 0;
  let wkts = 0;
  for (const { ball: b, overIdx, legalAfter } of rows) {
    const s = batter(b.striker_id);
    if (b.non_striker_id) batter(b.non_striker_id);
    // a retired batter who walks back in is no longer "retired"
    for (const id of [b.striker_id, b.non_striker_id]) {
      if (id && bat.get(id)!.retired) {
        const r = bat.get(id)!;
        r.retired = false;
        r.wicketType = null;
      }
    }
    s.runs += b.runs_bat;
    if (facedByBatter(b)) s.balls++;
    if (b.runs_bat === 4) s.fours++;
    if (b.runs_bat === 6) s.sixes++;

    const bw = bowler(b.bowler_id);
    bw.runs += bowlerRuns(b);
    if (isLegal(b)) bw.legalBalls++;
    if (b.extra_type === "wide") bw.wides++;
    if (b.extra_type === "no_ball") bw.noBalls++;
    if (isLegal(b) && bowlerRuns(b) === 0) bw.dots++;
    if (isBowlerWicket(b)) bw.wickets++;

    score += totalRuns(b);
    if (b.wicket_type) {
      const outId = b.dismissed_id ?? b.striker_id;
      const o = batter(outId);
      o.wicketType = b.wicket_type;
      if (b.wicket_type === "retired") o.retired = true;
      else {
        o.out = true;
        o.bowlerId = b.bowler_id;
        o.fielderId = b.fielder_id;
        wkts++;
        fow.push({ wicketNo: wkts, score, playerId: outId, overs: oversText(legalAfter) });
        if (b.fielder_id) {
          if (b.wicket_type === "caught") field(b.fielder_id).catches++;
          if (b.wicket_type === "run_out") field(b.fielder_id).runOuts++;
          if (b.wicket_type === "stumped") field(b.fielder_id).stumpings++;
        }
      }
    }

    let ov = overs.get(overIdx);
    if (!ov) {
      ov = { overNo: overIdx + 1, bowlerId: b.bowler_id, balls: [], symbols: [], runs: 0, wickets: 0, scoreAtEnd: "" };
      overs.set(overIdx, ov);
    }
    ov.balls.push(b);
    ov.symbols.push(ballSymbol(b));
    ov.runs += totalRuns(b);
    if (isTeamWicket(b)) ov.wickets++;
    ov.scoreAtEnd = `${score}/${wkts}`;
  }

  // maidens: complete overs (6 legal balls) where the bowler conceded nothing
  for (const ov of overs.values()) {
    const legal = ov.balls.filter(isLegal).length;
    if (legal === 6 && ov.balls.every((b) => bowlerRuns(b) === 0)) bowler(ov.bowlerId).maidens++;
  }

  for (const r of bat.values()) r.strikeRate = r.balls ? (r.runs / r.balls) * 100 : 0;
  for (const r of bowl.values()) {
    r.overs = oversText(r.legalBalls);
    r.economy = r.legalBalls ? r.runs / (r.legalBalls / 6) : 0;
  }

  return {
    batting: [...bat.values()],
    bowling: [...bowl.values()],
    fow,
    overs: [...overs.values()].sort((a, b) => a.overNo - b.overNo),
    fielding,
  };
}

const WT_LABEL: Record<string, string> = {
  bowled: "b",
  lbw: "lbw b",
  hit_wicket: "hit wkt b",
};

export function dismissalText(row: BattingRow, name: (id: ID | null) => string): string {
  if (row.retired) return "retired";
  if (!row.out) return "not out";
  switch (row.wicketType) {
    case "caught":
      return row.fielderId === row.bowlerId
        ? `c & b ${name(row.bowlerId)}`
        : `c ${name(row.fielderId)} b ${name(row.bowlerId)}`;
    case "stumped":
      return `st ${name(row.fielderId)} b ${name(row.bowlerId)}`;
    case "run_out":
      return row.fielderId ? `run out (${name(row.fielderId)})` : "run out";
    default:
      return `${WT_LABEL[row.wicketType ?? ""] ?? "b"} ${name(row.bowlerId)}`;
  }
}
