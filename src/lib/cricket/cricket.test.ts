import { describe, expect, it } from "vitest";
import type { Ball, DayTeam, Innings, Match, MatchBundle } from "../types";
import { computeInnings, computeMatch, rulesFor } from "./engine";
import { buildScorecard, dismissalText } from "./scorecard";
import { aggregateCaptains, aggregatePlayers, computeSeries, matchPerformances, rankDay } from "./stats";
import { generateSummary, potdMessage } from "./summary";

let seq = 0;
function ball(p: Partial<Ball> & { inn?: string }): Ball {
  seq++;
  return {
    id: "b" + seq,
    innings_id: p.inn ?? "i1",
    match_id: "m1",
    seq,
    striker_id: p.striker_id ?? "A1",
    non_striker_id: p.non_striker_id === undefined ? "A2" : p.non_striker_id,
    bowler_id: p.bowler_id ?? "B1",
    runs_bat: p.runs_bat ?? 0,
    extra_type: p.extra_type ?? null,
    extra_runs: p.extra_runs ?? 0,
    wicket_type: p.wicket_type ?? null,
    dismissed_id: p.dismissed_id ?? null,
    fielder_id: p.fielder_id ?? null,
    created_at: "",
  };
}

const rules = { maxOvers: 2, maxWickets: 3 };

describe("innings engine", () => {
  it("wides and no-balls add runs but are not legal deliveries", () => {
    const s = computeInnings(
      [
        ball({ extra_type: "wide", extra_runs: 1 }),
        ball({ extra_type: "no_ball", extra_runs: 1, runs_bat: 4 }),
        ball({ runs_bat: 0 }),
      ],
      rules,
    );
    expect(s.runs).toBe(6);
    expect(s.legalBalls).toBe(1);
    expect(s.overs).toBe("0.1");
    expect(s.extras).toMatchObject({ wides: 1, noBalls: 1, total: 2 });
  });

  it("rotates strike on odd runs and at the end of the over", () => {
    let s = computeInnings([ball({ runs_bat: 1 })], rules);
    expect(s.striker).toBe("A2");
    expect(s.nonStriker).toBe("A1");
    const over = Array.from({ length: 6 }, () => ball({ runs_bat: 0 }));
    s = computeInnings(over, rules);
    expect(s.overJustCompleted).toBe(true);
    expect(s.striker).toBe("A2"); // swapped at over end
    // single off last ball of over → batter keeps strike
    const over2 = [...Array.from({ length: 5 }, () => ball({})), ball({ runs_bat: 1 })];
    s = computeInnings(over2, rules);
    expect(s.striker).toBe("A1");
  });

  it("byes count for the team but rotate strike and are legal", () => {
    const s = computeInnings([ball({ extra_type: "bye", extra_runs: 1 })], rules);
    expect(s.runs).toBe(1);
    expect(s.legalBalls).toBe(1);
    expect(s.striker).toBe("A2");
  });

  it("frees the dismissed batter's slot, including run-out of the non-striker", () => {
    let s = computeInnings([ball({ wicket_type: "bowled", dismissed_id: "A1" })], rules);
    expect(s.wickets).toBe(1);
    expect(s.striker).toBeNull();
    expect(s.nonStriker).toBe("A2");
    s = computeInnings([ball({ runs_bat: 1, wicket_type: "run_out", dismissed_id: "A2" })], rules);
    // after a single they crossed: A2 was heading to striker's end... we free A2's slot
    expect([s.striker, s.nonStriker]).toContain("A1");
    expect([s.striker, s.nonStriker]).toContain(null);
  });

  it("retired doesn't count as a wicket", () => {
    const s = computeInnings([ball({ wicket_type: "retired", dismissed_id: "A1" })], rules);
    expect(s.wickets).toBe(0);
    expect(s.striker).toBeNull();
  });

  it("ends on all out (players per side - 1 wickets)", () => {
    const s = computeInnings(
      [
        ball({ wicket_type: "bowled", dismissed_id: "A1" }),
        ball({ striker_id: "A3", wicket_type: "bowled", dismissed_id: "A3" }),
        ball({ striker_id: "A4", wicket_type: "lbw", dismissed_id: "A4" }),
      ],
      rules,
    );
    expect(s.complete).toBe(true);
    expect(s.completeReason).toBe("all_out");
  });

  it("ends when overs are used up, or target reached mid-over", () => {
    const twelve = Array.from({ length: 12 }, () => ball({}));
    expect(computeInnings(twelve, rules).completeReason).toBe("overs");
    const chase = computeInnings([ball({ runs_bat: 4 }), ball({ runs_bat: 6 })], { ...rules, target: 10 });
    expect(chase.completeReason).toBe("target");
  });
});

/* ---------- Full match ---------- */

const team = (id: string, players: string[], captain: string): DayTeam => ({
  id,
  match_day_id: "d1",
  name: id === "TA" ? "Tigers" : "Lions",
  captain_id: captain,
  player_ids: players,
  created_at: "",
});
const TA = team("TA", ["A1", "A2", "A3", "A4"], "A1");
const TB = team("TB", ["B1", "B2", "B3", "B4"], "B1");

function mkMatch(id: string): Match {
  return {
    id,
    match_day_id: "d1",
    match_no: 1,
    team_a_id: "TA",
    team_b_id: "TB",
    overs: 1,
    players_per_side: 4,
    toss_winner_id: "TA",
    toss_decision: "bat",
    status: "live",
    winner_team_id: null,
    result_text: null,
    summary: null,
    created_at: "",
  };
}

function mkBundle(id: string, inn1Runs: number[], inn2Runs: number[]): MatchBundle {
  const i1: Innings = { id: id + "i1", match_id: id, innings_no: 1, batting_team_id: "TA", bowling_team_id: "TB", closed: false, created_at: "" };
  const i2: Innings = { id: id + "i2", match_id: id, innings_no: 2, batting_team_id: "TB", bowling_team_id: "TA", closed: false, created_at: "" };
  const balls: Ball[] = [
    ...inn1Runs.map((r) => ({ ...ball({ inn: i1.id, runs_bat: r, striker_id: "A1", non_striker_id: "A2", bowler_id: "B1" }), match_id: id })),
    ...inn2Runs.map((r) => ({ ...ball({ inn: i2.id, runs_bat: r, striker_id: "B1", non_striker_id: "B2", bowler_id: "A3" }), match_id: id })),
  ];
  return { match: mkMatch(id), teamA: TA, teamB: TB, innings: inn2Runs.length ? [i1, i2] : [i1], balls };
}

describe("match result", () => {
  it("defending team wins by runs", () => {
    const s = computeMatch(mkBundle("m1", [4, 4, 0, 0, 0, 2], [1, 1, 1, 1, 1, 1]));
    expect(s.phase).toBe("done");
    expect(s.target).toBe(11);
    expect(s.result?.text).toBe("Tigers won by 4 runs");
  });

  it("chasing team wins by wickets with balls left", () => {
    const s = computeMatch(mkBundle("m2", [1, 1, 0, 0, 0, 0], [6]));
    expect(s.result?.winnerId).toBe("TB");
    expect(s.result?.text).toBe("Lions won by 3 wickets (5 balls left)");
  });

  it("tie", () => {
    const s = computeMatch(mkBundle("m3", [2, 0, 0, 0, 0, 0], [1, 1, 0, 0, 0, 0]));
    expect(s.result?.tie).toBe(true);
  });

  it("innings break phase when 2nd innings not started", () => {
    const s = computeMatch(mkBundle("m4", [1, 1, 1, 1, 1, 1], []));
    expect(s.phase).toBe("break");
  });
});

describe("scorecard", () => {
  it("batting, bowling, maidens and dismissal text", () => {
    const balls = [
      ...Array.from({ length: 6 }, () => ball({ inn: "x", bowler_id: "B1" })),
      ball({ inn: "x", striker_id: "A2", non_striker_id: "A1", bowler_id: "B2", runs_bat: 6 }),
      ball({ inn: "x", striker_id: "A2", non_striker_id: "A1", bowler_id: "B2", wicket_type: "caught", dismissed_id: "A2", fielder_id: "B3" }),
    ];
    const sc = buildScorecard(balls);
    const b1 = sc.bowling.find((b) => b.playerId === "B1")!;
    expect(b1.maidens).toBe(1);
    expect(b1.overs).toBe("1.0");
    const a2 = sc.batting.find((b) => b.playerId === "A2")!;
    expect(a2).toMatchObject({ runs: 6, balls: 2, sixes: 1, out: true });
    expect(dismissalText(a2, (id) => id ?? "")).toBe("c B3 b B2");
    expect(sc.fielding.B3.catches).toBe(1);
    expect(sc.fow[0]).toMatchObject({ wicketNo: 1, score: 6, overs: "1.2" });
  });
});

describe("series, stats, captains, POTD", () => {
  const bundles = [
    mkBundle("s1", [4, 4, 0, 0, 0, 2], [1, 1, 1, 1, 1, 1]), // Tigers win
    mkBundle("s2", [1, 1, 0, 0, 0, 0], [6]), // Lions win
    mkBundle("s3", [6, 6, 6, 0, 0, 0], [1, 0, 0, 0, 0, 0]), // Tigers win
  ];
  it("series winner by most wins", () => {
    const s = computeSeries([TA, TB], bundles);
    expect(s.winnerId).toBe("TA");
    expect(s.decidedBy).toBe("wins");
    expect(s.standings[0]).toMatchObject({ teamId: "TA", won: 2, lost: 1 });
  });
  it("series level on wins → net run rate decides", () => {
    const s = computeSeries([TA, TB], bundles.slice(0, 2));
    expect(s.decidedBy).toBe("nrr");
  });
  it("aggregates player stats and captains", () => {
    const perfs = bundles.flatMap(matchPerformances);
    const agg = aggregatePlayers(perfs);
    const a1 = agg.find((a) => a.playerId === "A1")!;
    expect(a1.runs).toBe(10 + 2 + 18);
    expect(a1.highest).toBe(18);
    expect(a1.matches).toBe(3);
    expect(a1.wins).toBe(2);
    const caps = aggregateCaptains([{ teams: [TA, TB], bundles }]);
    expect(caps.find((c) => c.playerId === "A1")).toMatchObject({ won: 2, lost: 1, seriesWon: 1 });
    const ranked = rankDay(perfs);
    expect(ranked[0].playerId).toBe("A1");
    expect(potdMessage("A1", "Raj", ranked[0])).toContain("Raj");
  });
  it("generates a summary", () => {
    const text = generateSummary(bundles[2], (id) => id ?? "?");
    expect(text.startsWith("# ")).toBe(true);
    expect(text).toContain("Tigers won by");
    expect(text).toContain("A1");
  });
});

/* ---------- October update ---------- */
import { matchSquad, pointsBreakdown } from "./stats";
import { runRateSeries } from "./runrate";

describe("retire batter (no ball used)", () => {
  it("frees the slot without using a delivery or changing strike/over", () => {
    const balls = [
      ball({ runs_bat: 1 }), // A2 now on strike
      { ...ball({ striker_id: "A2", non_striker_id: "A1", wicket_type: "retired", dismissed_id: "A1" }), non_delivery: true },
    ];
    const s = computeInnings(balls, rules);
    expect(s.legalBalls).toBe(1);
    expect(s.wickets).toBe(0);
    expect(s.striker).toBe("A2");
    expect(s.nonStriker).toBeNull();
    const sc = buildScorecard(balls);
    expect(sc.batting.find((r) => r.playerId === "A1")).toMatchObject({ retired: true, out: false, balls: 1 });
    expect(sc.bowling[0].legalBalls).toBe(1);
  });
  it("a retire right after an over keeps the 'new bowler needed' state", () => {
    const over = Array.from({ length: 6 }, () => ball({}));
    const s = computeInnings([...over, { ...ball({ striker_id: "A2", non_striker_id: "A1", wicket_type: "retired", dismissed_id: "A2" }), non_delivery: true }], rules);
    expect(s.overJustCompleted).toBe(true);
    expect(s.legalBalls).toBe(6);
  });
});

describe("out of box", () => {
  it("is a wicket credited to the bowler", () => {
    const b = [ball({ wicket_type: "out_of_box", dismissed_id: "A1" })];
    expect(computeInnings(b, rules).wickets).toBe(1);
    const sc = buildScorecard(b);
    expect(sc.bowling[0].wickets).toBe(1);
    expect(dismissalText(sc.batting[0], (id) => id ?? "")).toBe("out of box b B1");
  });
});

describe("common player & points", () => {
  it("common player is in both squads and gets no win/loss", () => {
    const b = mkBundle("c1", [6, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0, 0]);
    b.match.common_player_id = "C";
    b.balls.push({ ...ball({ inn: "c1i1", striker_id: "C", non_striker_id: "A2", bowler_id: "C", runs_bat: 0 }), match_id: "c1" });
    expect(matchSquad(b, "TA")).toContain("C");
    expect(matchSquad(b, "TB")).toContain("C");
    const perf = matchPerformances(b).find((p) => p.playerId === "C")!;
    expect(perf.common).toBe(true);
    expect(perf.won).toBeNull();
  });
  it("batting + bowling + fielding + win = the same total as before", () => {
    const p = { runs: 34, fours: 3, sixes: 2, wickets: 3, maidens: 1, catches: 1, runOuts: 1, stumpings: 0, won: true } as Parameters<typeof pointsBreakdown>[0];
    const b = pointsBreakdown(p);
    const old = 34 + 3 + 4 + 3 * 20 + 10 + 2 * 8 + 10 + 0 + 10 + 5;
    expect(b.total).toBe(old);
    expect(b.bat + b.bowl + b.field + b.win).toBe(old);
  });
});

describe("overs changed mid-match", () => {
  it("innings 1 stays finished once the chase has started", () => {
    const b = mkBundle("o1", [1, 1, 1, 1, 1, 1], [1]);
    b.match.overs = 3; // overs increased during the chase
    const s = computeMatch(b);
    expect(s.phase).toBe("second");
    expect(s.target).toBe(7);
  });
  it("extending overs during the innings break re-opens innings 1", () => {
    const b = mkBundle("o2", [1, 1, 1, 1, 1, 1], []);
    b.innings.push({ id: "o2i2", match_id: "o2", innings_no: 2, batting_team_id: "TB", bowling_team_id: "TA", closed: false, created_at: "" });
    b.match.overs = 2;
    expect(computeMatch(b).phase).toBe("first");
  });
});

describe("run rate series", () => {
  it("gives runs per over and running run rate", () => {
    const b = mkBundle("r1", [4, 4, 0, 0, 0, 2], [1, 1, 1]);
    b.match.overs = 2;
    const [s1, s2] = runRateSeries(b);
    expect(s1.points[0]).toMatchObject({ over: 1, runs: 10, runRate: 10, partial: false });
    expect(s2.points[0]).toMatchObject({ runs: 3, partial: true, runRate: 6 });
  });
});

describe("last batter bats alone", () => {
  const lms = { maxOvers: 2, maxWickets: 3, lastManStands: true };
  it("lone batter keeps strike on singles and at the end of the over", () => {
    const alone = (r: number) => ball({ striker_id: "A3", non_striker_id: null, runs_bat: r });
    let s = computeInnings([alone(1)], lms);
    expect(s.striker).toBe("A3");
    s = computeInnings([alone(1), alone(3), alone(0), alone(1), alone(0), alone(1)], lms);
    expect(s.overJustCompleted).toBe(true);
    expect(s.striker).toBe("A3");
    expect(s.complete).toBe(false);
  });
  it("innings only ends when every player is out", () => {
    const b = [
      ball({ wicket_type: "bowled", dismissed_id: "A1" }),
      ball({ striker_id: "A3", wicket_type: "bowled", dismissed_id: "A3" }),
    ];
    expect(computeInnings(b, lms).complete).toBe(false); // A2 can carry on alone
    expect(computeInnings([...b, ball({ striker_id: "A2", non_striker_id: null, wicket_type: "lbw", dismissed_id: "A2" })], lms).completeReason).toBe("all_out");
  });
  it("old matches (setting off) keep the old rule", () => {
    const m = mkBundle("l1", [1], []);
    expect(rulesFor(m.match).maxWickets).toBe(3);
    expect(rulesFor({ ...m.match, last_man_stands: true }).maxWickets).toBe(4);
  });
});
