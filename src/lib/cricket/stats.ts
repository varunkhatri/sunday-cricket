import type { DayTeam, ID, MatchBundle } from "../types";
import { computeMatch } from "./engine";
import { buildScorecard } from "./scorecard";

/* ---------- Per-player, per-match performance ---------- */

export interface PlayerMatchPerf {
  playerId: ID;
  matchId: ID;
  dayId: ID;
  teamId: ID | null;
  batted: boolean;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  out: boolean;
  bowled: boolean;
  bowlBalls: number;
  bowlRuns: number;
  wickets: number;
  maidens: number;
  catches: number;
  runOuts: number;
  stumpings: number;
  /** true = team won, false = lost, null = tie / not finished */
  won: boolean | null;
  /** true when this player was the match's common player (played for both teams) */
  common: boolean;
  points: number;
  batPoints: number;
  bowlPoints: number;
  fieldPoints: number;
}

export type PointsRules = typeof POINTS_ORIGINAL;

/** Points used for every match day before 1 November 2026 — kept so past awards never change. */
export const POINTS_ORIGINAL = {
  run: 1,
  fourBonus: 1,
  sixBonus: 2,
  wicket: 20,
  maiden: 10,
  fielding: 8,
  thirty: 10,
  fifty: 10,
  threeFor: 10,
  win: 5,
};

/** Points from Sunday 1 November 2026 onwards. */
export const POINTS_NOV_2026: PointsRules = {
  run: 1,
  fourBonus: 1,
  sixBonus: 2,
  wicket: 15,
  maiden: 15,
  fielding: 5,
  thirty: 10,
  fifty: 10,
  threeFor: 10,
  win: 5,
};

export const POINTS_NOV_2026_FROM = "2026-10-29";

/** The points rules that apply to a match day (by its date, YYYY-MM-DD). */
export function pointsFor(date?: string | null): PointsRules {
  return date && date < POINTS_NOV_2026_FROM ? POINTS_ORIGINAL : POINTS_NOV_2026;
}

/** The current rules (shown on the Stats page). */
export const POINTS = POINTS_NOV_2026;

type RawPerf = Omit<PlayerMatchPerf, "points" | "batPoints" | "bowlPoints" | "fieldPoints">;

/** MVP points split into batting / bowling / fielding parts (+ win bonus). */
export function pointsBreakdown(p: RawPerf, POINTS: PointsRules = POINTS_NOV_2026) {
  const bat =
    p.runs * POINTS.run +
    p.fours * POINTS.fourBonus +
    p.sixes * POINTS.sixBonus +
    (p.runs >= 30 ? POINTS.thirty : 0) +
    (p.runs >= 50 ? POINTS.fifty : 0);
  const bowl = p.wickets * POINTS.wicket + p.maidens * POINTS.maiden + (p.wickets >= 3 ? POINTS.threeFor : 0);
  const field = (p.catches + p.runOuts + p.stumpings) * POINTS.fielding;
  const win = p.won ? POINTS.win : 0;
  return { bat, bowl, field, win, total: bat + bowl + field + win };
}

export function perfPoints(p: RawPerf, rules?: PointsRules) {
  return pointsBreakdown(p, rules).total;
}

/** Everyone who can play for a team in this match: its squad plus the common player. */
export function matchSquad(bundle: MatchBundle, teamId: ID): ID[] {
  const t = teamId === bundle.teamA.id ? bundle.teamA : bundle.teamB;
  const c = bundle.match.common_player_id;
  return c && !t.player_ids.includes(c) ? [...t.player_ids, c] : t.player_ids;
}

export function teamOf(bundle: MatchBundle, playerId: ID): DayTeam | null {
  if (bundle.teamA.player_ids.includes(playerId)) return bundle.teamA;
  if (bundle.teamB.player_ids.includes(playerId)) return bundle.teamB;
  return null;
}

export function matchPerformances(bundle: MatchBundle): PlayerMatchPerf[] {
  const state = computeMatch(bundle);
  const winner = state.result?.winnerId ?? null;
  const finished = state.phase === "done";
  const perfs = new Map<ID, RawPerf>();
  const common = bundle.match.common_player_id ?? null;
  const get = (id: ID, teamIdIn: ID | null) => {
    // the common player belongs to neither side, so gets no win/loss
    const teamId = id === common ? null : teamIdIn;
    if (!perfs.has(id))
      perfs.set(id, {
        playerId: id,
        matchId: bundle.match.id,
        dayId: bundle.match.match_day_id,
        teamId,
        batted: false,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        out: false,
        bowled: false,
        bowlBalls: 0,
        bowlRuns: 0,
        wickets: 0,
        maidens: 0,
        catches: 0,
        runOuts: 0,
        stumpings: 0,
        won: finished && teamId ? (winner ? winner === teamId : null) : null,
        common: id === common,
      });
    return perfs.get(id)!;
  };

  // everyone named in a squad "played"
  for (const t of [bundle.teamA, bundle.teamB]) for (const pid of t.player_ids) get(pid, t.id);
  if (common) get(common, null);

  for (const inn of bundle.innings) {
    const sc = buildScorecard(bundle.balls.filter((b) => b.innings_id === inn.id));
    for (const r of sc.batting) {
      const p = get(r.playerId, teamOf(bundle, r.playerId)?.id ?? inn.batting_team_id);
      p.batted = true;
      p.runs += r.runs;
      p.balls += r.balls;
      p.fours += r.fours;
      p.sixes += r.sixes;
      p.out = p.out || r.out;
    }
    for (const r of sc.bowling) {
      const p = get(r.playerId, teamOf(bundle, r.playerId)?.id ?? inn.bowling_team_id);
      p.bowled = true;
      p.bowlBalls += r.legalBalls;
      p.bowlRuns += r.runs;
      p.wickets += r.wickets;
      p.maidens += r.maidens;
    }
    for (const [pid, f] of Object.entries(sc.fielding)) {
      const p = get(pid, teamOf(bundle, pid)?.id ?? inn.bowling_team_id);
      p.catches += f.catches;
      p.runOuts += f.runOuts;
      p.stumpings += f.stumpings;
    }
  }
  return [...perfs.values()].map((p) => {
    const b = pointsBreakdown(p, pointsFor(bundle.date));
    return { ...p, points: b.total, batPoints: b.bat, bowlPoints: b.bowl, fieldPoints: b.field };
  });
}

/* ---------- Aggregation over many matches ---------- */

export interface PlayerAgg {
  playerId: ID;
  matches: number;
  wins: number;
  losses: number;
  innings: number;
  runs: number;
  balls: number;
  fours: number;
  sixes: number;
  outs: number;
  highest: number;
  highestNotOut: boolean;
  thirties: number;
  fifties: number;
  ducks: number;
  bowlInnings: number;
  bowlBalls: number;
  bowlRuns: number;
  wickets: number;
  maidens: number;
  bestW: number;
  bestR: number;
  threeFors: number;
  catches: number;
  runOuts: number;
  stumpings: number;
  points: number;
  average: number | null;
  strikeRate: number;
  economy: number | null;
  bowlAverage: number | null;
}

export function aggregatePlayers(perfs: PlayerMatchPerf[]): PlayerAgg[] {
  const m = new Map<ID, PlayerAgg>();
  for (const p of perfs) {
    let a = m.get(p.playerId);
    if (!a) {
      a = {
        playerId: p.playerId,
        matches: 0,
        wins: 0,
        losses: 0,
        innings: 0,
        runs: 0,
        balls: 0,
        fours: 0,
        sixes: 0,
        outs: 0,
        highest: 0,
        highestNotOut: false,
        thirties: 0,
        fifties: 0,
        ducks: 0,
        bowlInnings: 0,
        bowlBalls: 0,
        bowlRuns: 0,
        wickets: 0,
        maidens: 0,
        bestW: 0,
        bestR: 0,
        threeFors: 0,
        catches: 0,
        runOuts: 0,
        stumpings: 0,
        points: 0,
        average: null,
        strikeRate: 0,
        economy: null,
        bowlAverage: null,
      };
      m.set(p.playerId, a);
    }
    a.matches++;
    if (p.won === true) a.wins++;
    if (p.won === false) a.losses++;
    if (p.batted) {
      a.innings++;
      a.runs += p.runs;
      a.balls += p.balls;
      a.fours += p.fours;
      a.sixes += p.sixes;
      if (p.out) a.outs++;
      if (p.runs > a.highest || (p.runs === a.highest && !p.out)) {
        a.highest = p.runs;
        a.highestNotOut = !p.out;
      }
      if (p.runs >= 50) a.fifties++;
      else if (p.runs >= 30) a.thirties++;
      if (p.runs === 0 && p.out) a.ducks++;
    }
    if (p.bowled) {
      a.bowlInnings++;
      a.bowlBalls += p.bowlBalls;
      a.bowlRuns += p.bowlRuns;
      a.wickets += p.wickets;
      a.maidens += p.maidens;
      if (a.bowlInnings === 1 || p.wickets > a.bestW || (p.wickets === a.bestW && p.bowlRuns < a.bestR)) {
        a.bestW = p.wickets;
        a.bestR = p.bowlRuns;
      }
      if (p.wickets >= 3) a.threeFors++;
    }
    a.catches += p.catches;
    a.runOuts += p.runOuts;
    a.stumpings += p.stumpings;
    a.points += p.points;
  }
  for (const a of m.values()) {
    a.average = a.outs ? a.runs / a.outs : null;
    a.strikeRate = a.balls ? (a.runs / a.balls) * 100 : 0;
    a.economy = a.bowlBalls ? a.bowlRuns / (a.bowlBalls / 6) : null;
    a.bowlAverage = a.wickets ? a.bowlRuns / a.wickets : null;
  }
  return [...m.values()];
}

/* ---------- Day series ---------- */

export interface SeriesStanding {
  teamId: ID;
  played: number;
  won: number;
  lost: number;
  tied: number;
  runsFor: number;
  ballsFaced: number;
  runsAgainst: number;
  ballsBowled: number;
  nrr: number;
}

export interface SeriesResult {
  standings: SeriesStanding[];
  winnerId: ID | null;
  decidedBy: "wins" | "nrr" | null;
  shared: boolean;
  matchesCompleted: number;
  matchesTotal: number;
}

export function computeSeries(teams: DayTeam[], bundles: MatchBundle[]): SeriesResult {
  const st = new Map<ID, SeriesStanding>();
  for (const t of teams)
    st.set(t.id, { teamId: t.id, played: 0, won: 0, lost: 0, tied: 0, runsFor: 0, ballsFaced: 0, runsAgainst: 0, ballsBowled: 0, nrr: 0 });
  let completed = 0;
  for (const b of bundles) {
    const s = computeMatch(b);
    if (s.phase !== "done" || !s.result) continue;
    completed++;
    const quota = b.match.overs * 6;
    const inns: [ID, typeof s.first][] = [
      [s.firstInnings!.batting_team_id, s.first],
      [s.secondInnings!.batting_team_id, s.second],
    ];
    for (const [batId, inn] of inns) {
      if (!inn) continue;
      const bowlId = batId === b.match.team_a_id ? b.match.team_b_id : b.match.team_a_id;
      // all out counts as the full quota of overs for NRR
      const faced = inn.completeReason === "all_out" ? quota : inn.legalBalls;
      const bat = st.get(batId);
      const bowl = st.get(bowlId);
      if (bat) {
        bat.runsFor += inn.runs;
        bat.ballsFaced += faced;
      }
      if (bowl) {
        bowl.runsAgainst += inn.runs;
        bowl.ballsBowled += faced;
      }
    }
    for (const id of [b.match.team_a_id, b.match.team_b_id]) {
      const t = st.get(id);
      if (!t) continue;
      t.played++;
      if (s.result.tie) t.tied++;
      else if (s.result.winnerId === id) t.won++;
      else t.lost++;
    }
  }
  for (const t of st.values()) {
    const forRate = t.ballsFaced ? t.runsFor / (t.ballsFaced / 6) : 0;
    const agRate = t.ballsBowled ? t.runsAgainst / (t.ballsBowled / 6) : 0;
    t.nrr = forRate - agRate;
  }
  const standings = [...st.values()].sort(
    (a, b) => b.won * 2 + b.tied - (a.won * 2 + a.tied) || b.nrr - a.nrr,
  );
  let winnerId: ID | null = null;
  let decidedBy: SeriesResult["decidedBy"] = null;
  let shared = false;
  if (completed > 0 && standings.length >= 2) {
    const [a, b] = standings;
    const pa = a.won * 2 + a.tied;
    const pb = b.won * 2 + b.tied;
    if (pa > pb) {
      winnerId = a.teamId;
      decidedBy = "wins";
    } else if (Math.abs(a.nrr - b.nrr) > 1e-9) {
      winnerId = a.teamId;
      decidedBy = "nrr";
    } else shared = true;
  }
  return { standings, winnerId, decidedBy, shared, matchesCompleted: completed, matchesTotal: bundles.length };
}

/* ---------- Captains ---------- */

export interface CaptainRecord {
  playerId: ID;
  matches: number;
  won: number;
  lost: number;
  tied: number;
  seriesPlayed: number;
  seriesWon: number;
  winPct: number;
}

export function aggregateCaptains(
  days: { teams: DayTeam[]; bundles: MatchBundle[] }[],
): CaptainRecord[] {
  const m = new Map<ID, CaptainRecord>();
  const rec = (id: ID) => {
    if (!m.has(id)) m.set(id, { playerId: id, matches: 0, won: 0, lost: 0, tied: 0, seriesPlayed: 0, seriesWon: 0, winPct: 0 });
    return m.get(id)!;
  };
  for (const d of days) {
    const series = computeSeries(d.teams, d.bundles);
    for (const t of d.teams) {
      if (!t.captain_id) continue;
      const st = series.standings.find((s) => s.teamId === t.id);
      if (!st || st.played === 0) continue;
      const r = rec(t.captain_id);
      r.matches += st.played;
      r.won += st.won;
      r.lost += st.lost;
      r.tied += st.tied;
      r.seriesPlayed++;
      if (series.winnerId === t.id) r.seriesWon++;
    }
  }
  for (const r of m.values()) r.winPct = r.matches ? (r.won / r.matches) * 100 : 0;
  return [...m.values()].sort((a, b) => b.won - a.won || b.winPct - a.winPct);
}

/* ---------- Player of the Day ---------- */

export interface DayAward {
  playerId: ID;
  points: number;
  batPoints: number;
  bowlPoints: number;
  fieldPoints: number;
  fours: number;
  bowlBalls: number;
  runs: number;
  balls: number;
  wickets: number;
  bowlRuns: number;
  catches: number;
  sixes: number;
}

export function rankDay(perfs: PlayerMatchPerf[]): DayAward[] {
  const m = new Map<ID, DayAward>();
  for (const p of perfs) {
    const a = m.get(p.playerId) ?? {
      playerId: p.playerId, points: 0, batPoints: 0, bowlPoints: 0, fieldPoints: 0, fours: 0, bowlBalls: 0,
      runs: 0, balls: 0, wickets: 0, bowlRuns: 0, catches: 0, sixes: 0,
    };
    a.points += p.points;
    a.batPoints += p.batPoints;
    a.bowlPoints += p.bowlPoints;
    a.fieldPoints += p.fieldPoints;
    a.fours += p.fours;
    a.bowlBalls += p.bowlBalls;
    a.runs += p.runs;
    a.balls += p.balls;
    a.wickets += p.wickets;
    a.bowlRuns += p.bowlRuns;
    a.catches += p.catches + p.runOuts + p.stumpings;
    a.sixes += p.sixes;
    m.set(p.playerId, a);
  }
  return [...m.values()]
    .filter((a) => a.points > 0)
    .sort((a, b) => b.points - a.points || b.runs - a.runs || b.wickets - a.wickets);
}

export function topBy<T>(items: T[], key: (t: T) => number, tiebreak?: (t: T) => number): T | null {
  let best: T | null = null;
  for (const it of items) {
    if (key(it) <= 0) continue;
    if (!best || key(it) > key(best) || (key(it) === key(best) && tiebreak && tiebreak(it) < tiebreak(best)))
      best = it;
  }
  return best;
}
