/**
 * Fills the app with a month of realistic demo matches so you can see how everything looks.
 *   DATA_MODE=local npm run seed:demo      (local test data)
 * Don't run this against your real Supabase database unless you want demo data there.
 */
import { store } from "../src/lib/data/store";
import { addBall, startMatch } from "../src/lib/data/matchOps";
import { getMatchBundle } from "../src/lib/data/queries";
import { computeMatch } from "../src/lib/cricket/engine";
import type { DayTeam, ExtraType, Player, WicketType } from "../src/lib/types";

const NAMES = [
  "Varun Khatri", "Raj Patel", "Sam Khan", "Arjun Mehta", "Dev Sharma", "Kabir Singh", "Nikhil Rao",
  "Imran Ali", "Rohit Verma", "Aman Gupta", "Faraz Shaikh", "Kunal Joshi", "Vikram Nair", "Harsh Malhotra",
];

let seed = 42;
const rand = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
const pick = <T,>(a: T[]) => a[Math.floor(rand() * a.length)];
const shuffle = <T,>(a: T[]) => [...a].sort(() => rand() - 0.5);

async function playMatch(matchId: string, skill: Record<string, number>) {
  const m = (await getMatchBundle(matchId))!;
  await startMatch(matchId, pick([m.match.team_a_id, m.match.team_b_id]), pick(["bat", "bowl"] as const));
  for (let guard = 0; guard < 400; guard++) {
    const b = (await getMatchBundle(matchId))!;
    const st = computeMatch(b);
    if (st.phase === "done") return;
    const inn = b.innings[b.innings.length - 1];
    const cur = inn.innings_no === 1 ? st.first! : st.second!;
    const bat = inn.batting_team_id === b.teamA.id ? b.teamA : b.teamB;
    const bowlTeam = inn.batting_team_id === b.teamA.id ? b.teamB : b.teamA;
    const innBalls = b.balls.filter((x) => x.innings_id === inn.id);
    const avail = bat.player_ids.filter((p) => !cur.dismissed.has(p) && p !== cur.striker && p !== cur.nonStriker);
    let striker = cur.striker ?? (innBalls.length ? null : bat.player_ids[0]);
    let nonStriker = cur.nonStriker ?? (innBalls.length ? null : bat.player_ids[1]);
    if (!striker) striker = avail.shift()!;
    if (!nonStriker) nonStriker = avail.shift() ?? null;
    let bowler = cur.lastBowler;
    if (!bowler || cur.overJustCompleted || !innBalls.length) {
      const overNo = Math.floor(cur.legalBalls / 6);
      const rota = bowlTeam.player_ids.slice(0, 5);
      bowler = rota[overNo % rota.length];
      if (bowler === cur.lastBowler) bowler = rota[(overNo + 1) % rota.length];
    }
    const sk = skill[striker] ?? 1;
    const bk = skill[bowler] ?? 1;
    const r = rand();
    let runs_bat = 0, extra_type: ExtraType | null = null, extra_runs = 0, wicket_type: WicketType | null = null, fielder_id: string | null = null;
    const wk = 0.07 * bk / sk;
    if (r < 0.04) { extra_type = "wide"; extra_runs = 1; }
    else if (r < 0.055) { extra_type = "no_ball"; extra_runs = 1; runs_bat = pick([0, 1, 4]); }
    else if (r < 0.065) { extra_type = pick(["bye", "leg_bye"] as const); extra_runs = 1; }
    else if (r < 0.065 + wk) {
      wicket_type = pick(["bowled", "caught", "caught", "caught", "lbw", "run_out", "stumped"] as const);
      if (wicket_type === "caught" || wicket_type === "run_out" || wicket_type === "stumped") fielder_id = pick(bowlTeam.player_ids);
    } else {
      const x = rand() * sk;
      runs_bat = x < 0.33 ? 0 : x < 0.68 ? 1 : x < 0.8 ? 2 : x < 0.82 ? 3 : x < 0.95 ? 4 : 6;
    }
    await addBall(matchId, {
      innings_id: inn.id,
      seq: (innBalls[innBalls.length - 1]?.seq ?? 0) + 1,
      striker_id: striker, non_striker_id: nonStriker, bowler_id: bowler,
      runs_bat, extra_type, extra_runs, wicket_type, dismissed_id: wicket_type ? striker : null, fielder_id,
    });
  }
}

async function main() {
  const s = store();
  const existing = await s.list<Player>("players");
  if (existing.length) {
    console.log("Data already exists — skipping seed. Delete .data/ to start over.");
    return;
  }
  const players: Player[] = [];
  for (const name of NAMES) players.push(await s.insert<Player>("players", { name }));
  await s.update("players", players[1].id, { nickname: "Rajju" });
  const skill: Record<string, number> = Object.fromEntries(players.map((p) => [p.id, 0.8 + rand() * 0.6]));

  const dates = ["2026-09-06", "2026-09-13", "2026-09-20", "2026-09-27", "2026-10-04"];
  const teamNames = [["Thunder", "Lightning"], ["Strikers", "Warriors"], ["Royals", "Titans"], ["Falcons", "Panthers"], ["Mavericks", "Gladiators"]];
  for (const [i, date] of dates.entries()) {
    const day = await s.insert<{ id: string }>("match_days", { date, venue: "Victoria Park", notes: i === 4 ? "Perfect sunshine and a full turnout of 14! ☀️" : null });
    const sh = shuffle(players.map((p) => p.id));
    const half = [sh.slice(0, 7), sh.slice(7)];
    const teams: DayTeam[] = [];
    for (const t of [0, 1])
      teams.push(await s.insert<DayTeam>("day_teams", { match_day_id: day.id, name: teamNames[i][t], captain_id: half[t][0], player_ids: half[t] }));
    const n = i % 2 === 0 ? 3 : 4;
    for (let k = 1; k <= n; k++) {
      const m = await s.insert<{ id: string }>("matches", {
        match_day_id: day.id, match_no: k, team_a_id: teams[0].id, team_b_id: teams[1].id,
        overs: k === 4 ? 5 : 6, players_per_side: 7, status: "setup",
      });
      await playMatch(m.id, skill);
    }
    console.log(`Seeded ${date}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
