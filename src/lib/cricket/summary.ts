import type { Ball, ID, MatchBundle } from "../types";
import { computeMatch, isBowlerWicket, isLegal, teamName } from "./engine";
import { buildScorecard, type BattingRow, type BowlingRow } from "./scorecard";
import { matchPerformances } from "./stats";

/* A tiny seeded random generator so the same match always gets the same write-up
   (until the admin hits "regenerate", which changes the seed). */
function rng(seedStr: string) {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i++) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

type Vars = Record<string, string | number>;
function fill(t: string, v: Vars) {
  return t.replace(/\{(\w+)\}/g, (_, k) => String(v[k] ?? ""));
}

const T = {
  thriller: [
    "😱 EDGE-OF-THE-SEAT THRILLER! {winner} snatch it at the death",
    "💓 Hearts in mouths! {winner} survive a nail-biter",
    "🎢 What a finish! {winner} edge a classic",
  ],
  thumping: [
    "💥 Total domination! {winner} flatten {loser}",
    "🚂 Unstoppable! {winner} steamroll {loser}",
    "🔥 {winner} put on a masterclass against {loser}",
  ],
  solid: [
    "✅ {winner} get the job done against {loser}",
    "💪 {winner} too strong for {loser} today",
    "🏏 {winner} take the honours over {loser}",
  ],
  tie: ["🤝 Unbelievable — it's a TIE! Nobody could split {a} and {b}", "⚖️ Dead level! {a} and {b} can't be separated"],
  firstInnings: [
    "{bat} batted first and posted {score} in {overs} overs.",
    "Sent in to bat, {bat} put {score} on the board from {overs} overs.",
    "{bat} got first use of the pitch and finished on {score} ({overs} ov).",
  ],
  chaseWon: [
    "Chasing {target}, {bat} got there in {overs} overs with {wk} wicket{wks} in hand.",
    "{bat} hunted down {target} with {wk} wicket{wks} to spare, finishing on {score} in {overs} overs.",
  ],
  chaseLost: [
    "Needing {target}, {bat} fell short on {score} ({overs} ov).",
    "The chase of {target} never quite got going — {bat} ended on {score} in {overs} overs.",
  ],
  chaseTie: ["Chasing {target}, {bat} finished on exactly {score} — level!"],
  bigKnock: [
    "🔥 {name} lit up the ground with a blazing {runs} off {balls}{boundaries}.",
    "🚀 {name} was in sensational touch, smashing {runs} from just {balls} balls{boundaries}.",
    "👑 Take a bow, {name}! A commanding {runs} ({balls}){boundaries}.",
  ],
  knock: [
    "🏏 {name} chipped in with a valuable {runs} off {balls}.",
    "{name} held things together with {runs} ({balls}).",
    "💼 A gritty {runs} from {name} kept the scoreboard ticking.",
  ],
  spell: [
    "🎯 {name} was the pick of the bowlers with {w}/{r} from {o} overs.",
    "🌪️ {name} ripped through the batting — {w} for {r} in {o} overs!",
    "🧤 Ball-in-hand hero {name} returned figures of {w}/{r} ({o} ov).",
  ],
  tightSpell: ["🔒 {name} was miserly — just {r} runs off {o} overs.", "🧊 Ice-cool {name} gave away only {r} in {o} overs."],
  bigOver: [
    "💣 The {ordinal} over went for a whopping {runs} runs as {batter} cut loose.",
    "🎆 Fireworks in the {ordinal} over — {runs} runs came off it!",
  ],
  sixes: ["🚀 {name} cleared the rope {n} times!", "🌙 {name} launched {n} sixes into orbit!"],
  matchSixes: ["Total sixes in the match: {n} 🎉"],
  maiden: ["🧱 {name} bowled a maiden — dot, dot, dot, dot, dot, dot!", "🧱 A maiden over from {name}. Pure pressure."],
  hatTrick: ["🎩🎩🎩 HAT-TRICK for {name}! Three in three — legendary!"],
  catches: ["🙌 Safe hands award: {name} held {n} catches.", "🧲 {name} was a magnet in the field with {n} catches."],
  goldenDuck: ["🦆 Golden duck for {name} — next week is a comeback story waiting to happen!"],
  pom: [
    "⭐ Player of the Match: {name} ({detail})",
    "🌟 Star of the show: {name} ({detail})",
  ],
};

function pick<K extends keyof typeof T>(r: () => number, key: K, v: Vars) {
  const arr = T[key];
  return fill(arr[Math.floor(r() * arr.length)], v);
}

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

function boundaryText(r: BattingRow) {
  const parts: string[] = [];
  if (r.fours) parts.push(`${r.fours}×4`);
  if (r.sixes) parts.push(`${r.sixes}×6`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

function hatTrickBowlers(balls: Ball[]): ID[] {
  const byBowler = new Map<ID, Ball[]>();
  for (const b of [...balls].sort((a, b) => a.seq - b.seq)) {
    if (b.non_delivery || (!isLegal(b) && !b.wicket_type)) continue;
    byBowler.set(b.bowler_id, [...(byBowler.get(b.bowler_id) ?? []), b]);
  }
  const out: ID[] = [];
  for (const [id, seq] of byBowler) {
    let run = 0;
    for (const b of seq) {
      run = isBowlerWicket(b) ? run + 1 : 0;
      if (run >= 3) {
        out.push(id);
        break;
      }
    }
  }
  return out;
}

export interface SummaryOptions {
  seed?: string;
}

/**
 * Build an exciting, readable match report from the ball-by-ball data.
 * Format: first line "# headline", then paragraphs, then "- " bullet highlights.
 */
export function generateSummary(
  bundle: MatchBundle,
  name: (id: ID | null) => string,
  opts: SummaryOptions = {},
): string {
  const state = computeMatch(bundle);
  if (state.phase !== "done" || !state.result || !state.first || !state.second) return "";
  const r = rng(opts.seed ?? bundle.match.id);
  const res = state.result;
  const inn1 = state.firstInnings!;
  const inn2 = state.secondInnings!;
  const balls1 = bundle.balls.filter((b) => b.innings_id === inn1.id);
  const balls2 = bundle.balls.filter((b) => b.innings_id === inn2.id);
  const sc1 = buildScorecard(balls1);
  const sc2 = buildScorecard(balls2);
  const tn = (id: ID | null) => teamName(bundle, id);

  // Headline
  let headline: string;
  if (res.tie) headline = pick(r, "tie", { a: bundle.teamA.name, b: bundle.teamB.name });
  else {
    const close =
      (res.marginRuns != null && res.marginRuns <= 5) ||
      (res.marginWickets != null && (res.marginWickets <= 1 || (res.ballsLeft ?? 99) <= 2));
    const big =
      (res.marginRuns != null && res.marginRuns >= Math.max(25, state.first.runs * 0.3)) ||
      (res.marginWickets != null && res.marginWickets >= Math.max(3, state.maxWickets - 1) && (res.ballsLeft ?? 0) >= 6);
    const key = close ? "thriller" : big ? "thumping" : "solid";
    headline = pick(r, key, { winner: tn(res.winnerId), loser: tn(res.loserId) });
  }

  const paras: string[] = [];
  const bullets: string[] = [];

  const knockLines = (rows: BattingRow[]) => {
    const top = [...rows].sort((a, b) => b.runs - a.runs || a.balls - b.balls).filter((x) => x.runs >= 8).slice(0, 2);
    return top.map((x) =>
      pick(r, x.runs >= 25 || (x.balls > 0 && x.runs / x.balls >= 1.8 && x.runs >= 15) ? "bigKnock" : "knock", {
        name: name(x.playerId),
        runs: x.runs + (x.out ? "" : "*"),
        balls: x.balls,
        boundaries: boundaryText(x),
      }),
    );
  };
  const spellLine = (rows: BowlingRow[]) => {
    const best = [...rows].sort((a, b) => b.wickets - a.wickets || a.runs - b.runs)[0];
    if (!best) return null;
    if (best.wickets >= 1) return pick(r, "spell", { name: name(best.playerId), w: best.wickets, r: best.runs, o: best.overs });
    const tight = [...rows].filter((x) => x.legalBalls >= 6).sort((a, b) => a.economy - b.economy)[0];
    return tight ? pick(r, "tightSpell", { name: name(tight.playerId), r: tight.runs, o: tight.overs }) : null;
  };

  // Innings 1 paragraph
  const p1 = [
    pick(r, "firstInnings", {
      bat: tn(inn1.batting_team_id),
      score: `${state.first.runs}/${state.first.wickets}`,
      overs: state.first.overs,
    }),
    ...knockLines(sc1.batting),
  ];
  const s1 = spellLine(sc1.bowling);
  if (s1) p1.push(s1);
  paras.push(p1.join(" "));

  // Innings 2 paragraph
  const chaseVars = {
    bat: tn(inn2.batting_team_id),
    target: state.target!,
    score: `${state.second.runs}/${state.second.wickets}`,
    overs: state.second.overs,
    wk: res.marginWickets ?? 0,
    wks: res.marginWickets === 1 ? "" : "s",
  };
  const p2 = [
    pick(r, res.tie ? "chaseTie" : res.winnerId === inn2.batting_team_id ? "chaseWon" : "chaseLost", chaseVars),
    ...knockLines(sc2.batting),
  ];
  const s2 = spellLine(sc2.bowling);
  if (s2) p2.push(s2);
  paras.push(p2.join(" "));

  // Highlights
  const allOvers = [
    ...sc1.overs.map((o) => ({ o, balls: balls1 })),
    ...sc2.overs.map((o) => ({ o, balls: balls2 })),
  ].sort((a, b) => b.o.runs - a.o.runs);
  const big = allOvers[0];
  if (big && big.o.runs >= 12) {
    const batterRuns = new Map<ID, number>();
    for (const b of big.o.balls) batterRuns.set(b.striker_id, (batterRuns.get(b.striker_id) ?? 0) + b.runs_bat);
    const batter = [...batterRuns.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    bullets.push(pick(r, "bigOver", { ordinal: ordinal(big.o.overNo), runs: big.o.runs, batter: name(batter) }));
  }

  const allBat = [...sc1.batting, ...sc2.batting];
  const sixHitter = [...allBat].sort((a, b) => b.sixes - a.sixes)[0];
  if (sixHitter && sixHitter.sixes >= 2) bullets.push(pick(r, "sixes", { name: name(sixHitter.playerId), n: sixHitter.sixes }));
  const totalSixes = allBat.reduce((s, x) => s + x.sixes, 0);
  if (totalSixes >= 4) bullets.push(pick(r, "matchSixes", { n: totalSixes }));

  for (const id of [...hatTrickBowlers(balls1), ...hatTrickBowlers(balls2)]) bullets.push(pick(r, "hatTrick", { name: name(id) }));

  const maidens = [...sc1.bowling, ...sc2.bowling].filter((b) => b.maidens > 0);
  for (const m of maidens.slice(0, 2)) bullets.push(pick(r, "maiden", { name: name(m.playerId) }));

  const fielders = new Map<ID, number>();
  for (const sc of [sc1, sc2]) for (const [id, f] of Object.entries(sc.fielding)) fielders.set(id, (fielders.get(id) ?? 0) + f.catches);
  const catcher = [...fielders.entries()].sort((a, b) => b[1] - a[1])[0];
  if (catcher && catcher[1] >= 2) bullets.push(pick(r, "catches", { name: name(catcher[0]), n: catcher[1] }));

  const golden = allBat.filter((x) => x.out && x.runs === 0 && x.balls <= 1);
  if (golden.length === 1) bullets.push(pick(r, "goldenDuck", { name: name(golden[0].playerId) }));

  // Player of the match
  const perfs = matchPerformances(bundle).sort((a, b) => b.points - a.points);
  const pom = perfs[0];
  if (pom && pom.points > 0) {
    const bits: string[] = [];
    if (pom.batted && pom.runs > 0) bits.push(`${pom.runs}${pom.out ? "" : "*"} run${pom.runs === 1 ? "" : "s"}`);
    if (pom.wickets > 0) bits.push(`${pom.wickets}/${pom.bowlRuns}`);
    if (pom.catches > 0) bits.push(`${pom.catches} ct`);
    bullets.push(pick(r, "pom", { name: name(pom.playerId), detail: bits.join(", ") || `${pom.points} pts` }));
  }

  return [`# ${headline}`, `**${res.text}**`, ...paras, ...bullets.map((b) => `- ${b}`)].join("\n\n");
}

/* ---------- Player of the Day messages ---------- */

const POTD_LINES = [
  "🏆 Take a bow, {name}! {detail} — you owned this Sunday. The whole squad will be chasing your standard next week!",
  "🥇 {name} was simply unstoppable today: {detail}. Pure class — keep that fire burning! 🔥",
  "🏅 Sunday belonged to {name}! {detail}. That's how legends are made — see you at the crease next week, champ!",
  "🏆 Hats off to {name}! {detail}. A performance the group chat will be talking about all week! 👏",
  "🌟 {name} brought the magic today — {detail}. Golden effort, golden player! 🏆",
];

export function potdMessage(
  playerId: ID,
  name: string,
  a: { runs: number; wickets: number; bowlRuns: number; catches: number; sixes: number },
) {
  const bits: string[] = [];
  if (a.runs > 0) bits.push(`${a.runs} run${a.runs === 1 ? "" : "s"}`);
  if (a.wickets > 0) bits.push(`${a.wickets} wicket${a.wickets === 1 ? "" : "s"}`);
  if (a.catches > 0) bits.push(`${a.catches} dismissal${a.catches === 1 ? "" : "s"} in the field`);
  if (a.sixes >= 2) bits.push(`${a.sixes} massive sixes`);
  const detail = bits.length > 1 ? bits.slice(0, -1).join(", ") + " and " + bits[bits.length - 1] : bits[0] ?? "an all-round show";
  const r = rng(playerId + name);
  return fill(POTD_LINES[Math.floor(r() * POTD_LINES.length)], { name, detail });
}
