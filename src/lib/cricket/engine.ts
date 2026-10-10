import type { Ball, ID, Innings, Match, MatchBundle, WicketType } from "../types";

/* ---------- Ball-level helpers ---------- */

export const isLegal = (b: Pick<Ball, "extra_type">) =>
  b.extra_type !== "wide" && b.extra_type !== "no_ball";

export const totalRuns = (b: Pick<Ball, "runs_bat" | "extra_runs">) => b.runs_bat + b.extra_runs;

/** Runs charged to the bowler (byes & leg byes are not). */
export const bowlerRuns = (b: Pick<Ball, "runs_bat" | "extra_runs" | "extra_type">) =>
  b.runs_bat + (b.extra_type === "wide" || b.extra_type === "no_ball" ? b.extra_runs : 0);

/** Did the batter face this delivery? (wides don't count as balls faced) */
export const facedByBatter = (b: Pick<Ball, "extra_type">) => b.extra_type !== "wide";

/** Counts toward the team's wicket tally (retired doesn't). */
export const isTeamWicket = (b: Pick<Ball, "wicket_type">) =>
  !!b.wicket_type && b.wicket_type !== "retired";

const BOWLER_WICKETS: WicketType[] = ["bowled", "caught", "lbw", "stumped", "hit_wicket"];
export const isBowlerWicket = (b: Pick<Ball, "wicket_type">) =>
  !!b.wicket_type && BOWLER_WICKETS.includes(b.wicket_type);

/** Runs physically run between the wickets — decides strike rotation. */
export function runsRun(b: Pick<Ball, "runs_bat" | "extra_runs" | "extra_type">): number {
  switch (b.extra_type) {
    case "wide":
      return Math.max(0, b.extra_runs - 1);
    case "no_ball":
      return b.runs_bat + Math.max(0, b.extra_runs - 1);
    case "bye":
    case "leg_bye":
      return b.extra_runs;
    default:
      return b.runs_bat;
  }
}

export const oversText = (legalBalls: number) => `${Math.floor(legalBalls / 6)}.${legalBalls % 6}`;

/** Overs as a decimal for rate calculations (3.4 overs -> 3.667) */
export const oversDecimal = (legalBalls: number) => legalBalls / 6;

export function ballSymbol(b: Ball): string {
  const w = b.wicket_type && b.wicket_type !== "retired" ? "W" : "";
  let s: string;
  switch (b.extra_type) {
    case "wide":
      s = b.extra_runs > 1 ? `${b.extra_runs}wd` : "wd";
      break;
    case "no_ball":
      s = b.runs_bat > 0 ? `nb${b.runs_bat}` : "nb";
      break;
    case "bye":
      s = `${b.extra_runs}b`;
      break;
    case "leg_bye":
      s = `${b.extra_runs}lb`;
      break;
    default:
      s = b.runs_bat === 0 ? (w ? "" : "•") : String(b.runs_bat);
  }
  if (w) return s && s !== "•" ? `W+${s}` : "W";
  if (b.wicket_type === "retired") return s === "•" ? "R" : `R+${s}`;
  return s;
}

/* ---------- Innings computation ---------- */

export interface InningsRules {
  maxOvers: number;
  maxWickets: number; // players_per_side - 1
  target?: number | null; // runs needed to win (2nd innings)
  closed?: boolean;
}

export interface InningsState {
  runs: number;
  wickets: number;
  legalBalls: number;
  overs: string;
  extras: { wides: number; noBalls: number; byes: number; legByes: number; total: number };
  /** Batters at the crease after the last ball (null = slot needs a new batter). */
  striker: ID | null;
  nonStriker: ID | null;
  /** Bowler of the last delivery */
  lastBowler: ID | null;
  /** True when the last delivery completed an over (a new bowler is needed). */
  overJustCompleted: boolean;
  /** Players who are out (retired players are not in here). */
  dismissed: Set<ID>;
  /** Players who have batted (in order of appearance). */
  battingOrder: ID[];
  complete: boolean;
  completeReason: "overs" | "all_out" | "target" | "closed" | null;
  runRate: number;
  /** Balls in the current (incomplete) over, for the live "this over" strip */
  currentOver: Ball[];
}

export function computeInnings(balls: Ball[], rules: InningsRules): InningsState {
  const sorted = [...balls].sort((a, b) => a.seq - b.seq);
  let runs = 0,
    wickets = 0,
    legal = 0;
  const extras = { wides: 0, noBalls: 0, byes: 0, legByes: 0, total: 0 };
  let striker: ID | null = null,
    nonStriker: ID | null = null,
    lastBowler: ID | null = null,
    overJustCompleted = false;
  const dismissed = new Set<ID>();
  const battingOrder: ID[] = [];
  let currentOver: Ball[] = [];

  const seen = (id: ID | null) => {
    if (id && !battingOrder.includes(id)) battingOrder.push(id);
  };

  for (const b of sorted) {
    if (legal > 0 && legal % 6 === 0 && overJustCompleted) currentOver = [];
    seen(b.striker_id);
    seen(b.non_striker_id);
    // a retired batter can come back
    dismissed.delete(b.striker_id);
    if (b.non_striker_id) dismissed.delete(b.non_striker_id);

    runs += totalRuns(b);
    if (b.extra_type === "wide") extras.wides += b.extra_runs;
    if (b.extra_type === "no_ball") extras.noBalls += b.extra_runs;
    if (b.extra_type === "bye") extras.byes += b.extra_runs;
    if (b.extra_type === "leg_bye") extras.legByes += b.extra_runs;

    let s: ID | null = b.striker_id;
    let ns: ID | null = b.non_striker_id;
    if (runsRun(b) % 2 === 1) [s, ns] = [ns, s];

    if (b.wicket_type) {
      const out = b.dismissed_id ?? b.striker_id;
      if (isTeamWicket(b)) {
        wickets++;
        dismissed.add(out);
      }
      if (s === out) s = null;
      else if (ns === out) ns = null;
    }

    overJustCompleted = false;
    if (isLegal(b)) {
      legal++;
      if (legal % 6 === 0) {
        [s, ns] = [ns, s];
        overJustCompleted = true;
      }
    }
    striker = s;
    nonStriker = ns;
    lastBowler = b.bowler_id;
    currentOver.push(b);
  }
  if (overJustCompleted) currentOver = [];
  extras.total = extras.wides + extras.noBalls + extras.byes + extras.legByes;

  let completeReason: InningsState["completeReason"] = null;
  if (rules.target != null && runs >= rules.target) completeReason = "target";
  else if (wickets >= rules.maxWickets) completeReason = "all_out";
  else if (legal >= rules.maxOvers * 6) completeReason = "overs";
  else if (rules.closed) completeReason = "closed";

  return {
    runs,
    wickets,
    legalBalls: legal,
    overs: oversText(legal),
    extras,
    striker,
    nonStriker,
    lastBowler,
    overJustCompleted,
    dismissed,
    battingOrder,
    complete: completeReason !== null,
    completeReason,
    runRate: legal ? runs / oversDecimal(legal) : 0,
    currentOver,
  };
}

/* ---------- Match computation ---------- */

export interface MatchResult {
  winnerId: ID | null;
  loserId: ID | null;
  tie: boolean;
  text: string;
  marginRuns?: number;
  marginWickets?: number;
  ballsLeft?: number;
}

export interface MatchState {
  battingFirstId: ID | null;
  bowlingFirstId: ID | null;
  first: InningsState | null;
  second: InningsState | null;
  firstInnings: Innings | null;
  secondInnings: Innings | null;
  target: number | null;
  phase: "setup" | "first" | "break" | "second" | "done";
  result: MatchResult | null;
  maxWickets: number;
}

export function battingFirst(match: Match): ID | null {
  if (!match.toss_winner_id || !match.toss_decision) return null;
  const other = match.toss_winner_id === match.team_a_id ? match.team_b_id : match.team_a_id;
  return match.toss_decision === "bat" ? match.toss_winner_id : other;
}

export function rulesFor(match: Match) {
  return { maxOvers: match.overs, maxWickets: Math.max(1, match.players_per_side - 1) };
}

export function teamName(bundle: MatchBundle, id: ID | null) {
  if (id === bundle.teamA.id) return bundle.teamA.name;
  if (id === bundle.teamB.id) return bundle.teamB.name;
  return "?";
}

export function computeMatch(bundle: MatchBundle): MatchState {
  const { match } = bundle;
  const rules = rulesFor(match);
  const inn1 = bundle.innings.find((i) => i.innings_no === 1) ?? null;
  const inn2 = bundle.innings.find((i) => i.innings_no === 2) ?? null;
  const bf = inn1?.batting_team_id ?? battingFirst(match);
  const bowlF = bf ? (bf === match.team_a_id ? match.team_b_id : match.team_a_id) : null;

  const base: MatchState = {
    battingFirstId: bf,
    bowlingFirstId: bowlF,
    first: null,
    second: null,
    firstInnings: inn1,
    secondInnings: inn2,
    target: null,
    phase: "setup",
    result: null,
    maxWickets: rules.maxWickets,
  };
  if (!inn1) return base;

  const first = computeInnings(
    bundle.balls.filter((b) => b.innings_id === inn1.id),
    { ...rules, closed: inn1.closed },
  );
  base.first = first;
  if (!first.complete) return { ...base, phase: "first" };
  const target = first.runs + 1;
  base.target = target;
  if (!inn2) return { ...base, phase: "break" };

  const second = computeInnings(
    bundle.balls.filter((b) => b.innings_id === inn2.id),
    { ...rules, target, closed: inn2.closed },
  );
  base.second = second;
  if (!second.complete) return { ...base, phase: "second" };

  const chasing = inn2.batting_team_id;
  const defending = inn2.bowling_team_id;
  let result: MatchResult;
  if (second.runs >= target) {
    const wk = rules.maxWickets - second.wickets;
    const ballsLeft = rules.maxOvers * 6 - second.legalBalls;
    result = {
      winnerId: chasing,
      loserId: defending,
      tie: false,
      marginWickets: wk,
      ballsLeft,
      text: `${teamName(bundle, chasing)} won by ${wk} wicket${wk === 1 ? "" : "s"}${
        ballsLeft > 0 ? ` (${ballsLeft} ball${ballsLeft === 1 ? "" : "s"} left)` : ""
      }`,
    };
  } else if (second.runs === first.runs) {
    result = { winnerId: null, loserId: null, tie: true, text: "Match tied" };
  } else {
    const r = first.runs - second.runs;
    result = {
      winnerId: defending,
      loserId: chasing,
      tie: false,
      marginRuns: r,
      text: `${teamName(bundle, defending)} won by ${r} run${r === 1 ? "" : "s"}`,
    };
  }
  return { ...base, phase: "done", result };
}
