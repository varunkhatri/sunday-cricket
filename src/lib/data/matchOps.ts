import type { Ball, ExtraType, ID, Innings, Match, MatchBundle, WicketType } from "../types";
import { computeMatch } from "../cricket/engine";
import { generateSummary } from "../cricket/summary";
import { getMatchBundle, getPlayerNames } from "./queries";
import { store } from "./store";

export class ConflictError extends Error {}

export async function startMatch(matchId: ID, tossWinnerId: ID, decision: "bat" | "bowl") {
  const s = store();
  const m = await s.get<Match>("matches", matchId);
  if (!m) throw new Error("Match not found");
  if (![m.team_a_id, m.team_b_id].includes(tossWinnerId)) throw new Error("Toss winner must be one of the two teams");
  const existing = await s.list<Innings>("innings", { match_id: matchId });
  if (existing.length) throw new Error("Match already started");
  const other = tossWinnerId === m.team_a_id ? m.team_b_id : m.team_a_id;
  const bat = decision === "bat" ? tossWinnerId : other;
  const bowl = bat === m.team_a_id ? m.team_b_id : m.team_a_id;
  await s.update("matches", matchId, { toss_winner_id: tossWinnerId, toss_decision: decision, status: "live" });
  await s.insert("innings", { match_id: matchId, innings_no: 1, batting_team_id: bat, bowling_team_id: bowl, closed: false });
}

export interface BallInput {
  id?: string;
  innings_id: ID;
  seq: number;
  striker_id: ID;
  non_striker_id: ID | null;
  bowler_id: ID;
  runs_bat: number;
  extra_type: ExtraType | null;
  extra_runs: number;
  wicket_type: WicketType | null;
  dismissed_id: ID | null;
  fielder_id: ID | null;
}

const EXTRA: (ExtraType | null)[] = ["wide", "no_ball", "bye", "leg_bye", null];
const WICKET: (WicketType | null)[] = ["bowled", "caught", "lbw", "run_out", "stumped", "hit_wicket", "retired", null];
const int = (v: unknown, min: number, max: number) => {
  const n = Number(v);
  if (!Number.isInteger(n) || n < min || n > max) throw new Error("Invalid number");
  return n;
};

export function currentInnings(bundle: MatchBundle): Innings | null {
  return bundle.innings[bundle.innings.length - 1] ?? null;
}

export async function addBall(matchId: ID, input: BallInput) {
  const bundle = await getMatchBundle(matchId);
  if (!bundle) throw new Error("Match not found");
  if (input.id && bundle.balls.some((b) => b.id === input.id)) return; // already saved (retry)
  const state = computeMatch(bundle);
  if (state.phase !== "first" && state.phase !== "second") throw new ConflictError("This innings is complete");
  const inn = currentInnings(bundle)!;
  if (input.innings_id !== inn.id) throw new ConflictError("Out of date — refreshing");
  const innBalls = bundle.balls.filter((b) => b.innings_id === inn.id);
  const nextSeq = (innBalls[innBalls.length - 1]?.seq ?? 0) + 1;
  if (input.seq !== nextSeq) throw new ConflictError("Out of date — refreshing");

  if (!EXTRA.includes(input.extra_type)) throw new Error("Bad extra type");
  if (!WICKET.includes(input.wicket_type)) throw new Error("Bad wicket type");
  if (!input.striker_id || !input.bowler_id) throw new Error("Choose the batter and bowler");
  if (input.striker_id === input.non_striker_id) throw new Error("Striker and non-striker must be different");

  const row: Record<string, unknown> = {
    innings_id: inn.id,
    match_id: matchId,
    seq: nextSeq,
    striker_id: input.striker_id,
    non_striker_id: input.non_striker_id || null,
    bowler_id: input.bowler_id,
    runs_bat: int(input.runs_bat, 0, 7),
    extra_type: input.extra_type,
    extra_runs: int(input.extra_runs, 0, 7),
    wicket_type: input.wicket_type,
    dismissed_id: input.wicket_type ? input.dismissed_id || input.striker_id : null,
    fielder_id: input.wicket_type ? input.fielder_id || null : null,
  };
  if (input.id && /^[0-9a-f-]{36}$/i.test(input.id)) row.id = input.id;
  await store().insert("balls", row);
  await syncMatch(matchId);
}

/** Undo the last action: reopen a manually closed innings, or delete the last ball. */
export async function undoLast(matchId: ID) {
  const s = store();
  let bundle = await getMatchBundle(matchId);
  if (!bundle) throw new Error("Match not found");
  for (let guard = 0; guard < 3; guard++) {
    const inn = currentInnings(bundle!);
    if (!inn) return;
    if (inn.closed) {
      await s.update("innings", inn.id, { closed: false });
      break;
    }
    const innBalls = bundle!.balls.filter((b) => b.innings_id === inn.id);
    const last = innBalls[innBalls.length - 1];
    if (last) {
      await s.remove("balls", { id: last.id });
      break;
    }
    if (inn.innings_no === 2) {
      // empty 2nd innings: step back into the 1st innings
      await s.remove("innings", { id: inn.id });
      bundle = await getMatchBundle(matchId);
      continue;
    }
    // empty 1st innings: back to the toss
    await s.remove("innings", { id: inn.id });
    await s.update("matches", matchId, { status: "setup", toss_winner_id: null, toss_decision: null });
    return;
  }
  await syncMatch(matchId, { allowRemoveEmptySecond: false });
}

export async function endInnings(matchId: ID) {
  const bundle = await getMatchBundle(matchId);
  if (!bundle) throw new Error("Match not found");
  const inn = currentInnings(bundle);
  if (!inn) throw new Error("Match hasn't started");
  await store().update("innings", inn.id, { closed: true });
  await syncMatch(matchId);
}

/** Keep the stored match status/result/innings in line with the ball data. */
export async function syncMatch(matchId: ID, opts: { allowRemoveEmptySecond?: boolean } = {}) {
  const s = store();
  const bundle = await getMatchBundle(matchId);
  if (!bundle) return;
  const st = computeMatch(bundle);
  const inn2 = bundle.innings.find((i) => i.innings_no === 2);

  if (st.phase === "break" && !inn2) {
    const inn1 = st.firstInnings!;
    await s.insert("innings", {
      match_id: matchId,
      innings_no: 2,
      batting_team_id: inn1.bowling_team_id,
      bowling_team_id: inn1.batting_team_id,
      closed: false,
    });
  }
  if (
    opts.allowRemoveEmptySecond !== false &&
    inn2 &&
    st.first &&
    !st.first.complete &&
    !bundle.balls.some((b) => b.innings_id === inn2.id)
  ) {
    await s.remove("innings", { id: inn2.id });
  }

  const m = bundle.match;
  if (st.phase === "done" && st.result) {
    if (m.status !== "completed" || m.result_text !== st.result.text) {
      const names = await getPlayerNames();
      const summary = generateSummary(bundle, (id) => (id ? names[id] ?? "?" : "?"));
      await s.update("matches", matchId, {
        status: "completed",
        winner_team_id: st.result.winnerId,
        result_text: st.result.text,
        summary: m.summary && m.status === "completed" ? m.summary : summary,
      });
    }
  } else if (m.status === "completed" || (m.status === "setup" && st.phase !== "setup")) {
    await s.update("matches", matchId, { status: "live", winner_team_id: null, result_text: null, summary: null });
  }
}

export async function regenerateSummary(matchId: ID) {
  const bundle = await getMatchBundle(matchId);
  if (!bundle) throw new Error("Match not found");
  const names = await getPlayerNames();
  const summary = generateSummary(bundle, (id) => (id ? names[id] ?? "?" : "?"), { seed: matchId + Date.now() });
  if (summary) await store().update("matches", matchId, { summary });
}

/** Delete a whole day and everything in it (works for both stores). */
export async function deleteDayCascade(dayId: ID) {
  const s = store();
  const matches = await s.list<Match>("matches", { match_day_id: dayId });
  const mids = matches.map((m) => m.id);
  const photos = await s.list<{ id: string; path: string }>("photos", { match_day_id: dayId });
  for (const p of photos) await s.deleteFile(p.path).catch(() => undefined);
  if (mids.length) {
    await s.remove("balls", { match_id: mids });
    await s.remove("innings", { match_id: mids });
    await s.remove("matches", { id: mids });
  }
  await s.remove("photos", { match_day_id: dayId });
  await s.remove("day_teams", { match_day_id: dayId });
  await s.remove("match_days", { id: dayId });
}

export async function deleteMatchCascade(matchId: ID) {
  const s = store();
  await s.remove("balls", { match_id: matchId });
  await s.remove("innings", { match_id: matchId });
  await s.remove("matches", { id: matchId });
}

export type { Ball };
