import Link from "next/link";
import type { MatchBundle } from "@/lib/types";
import { computeMatch, teamName } from "@/lib/cricket/engine";
import { buildScorecard, dismissalText } from "@/lib/cricket/scorecard";
import { f1, f2 } from "@/lib/format";
import { matchSquad } from "@/lib/cricket/stats";

export default function ScorecardView({ bundle, names }: { bundle: MatchBundle; names: Record<string, string> }) {
  const st = computeMatch(bundle);
  const nm = (id: string | null) => (id ? names[id] ?? "?" : "?");
  const blocks = [
    { inn: st.firstInnings, state: st.first },
    { inn: st.secondInnings, state: st.second },
  ].filter((b) => b.inn && b.state);
  if (!blocks.length) return <p className="card p-4 muted">Scorecard appears once the first ball is bowled.</p>;
  return (
    <div className="space-y-5">
      {blocks.map(({ inn, state }) => {
        const balls = bundle.balls.filter((b) => b.innings_id === inn!.id);
        const sc = buildScorecard(balls);
        const team = bundle.teamA.id === inn!.batting_team_id ? bundle.teamA : bundle.teamB;
        const yetToBat = matchSquad(bundle, team.id).filter((p) => !sc.batting.some((r) => r.playerId === p));
        const atCrease = new Set([state!.striker, state!.nonStriker].filter(Boolean) as string[]);
        return (
          <section key={inn!.id} className="card overflow-hidden">
            <header className="flex items-baseline justify-between bg-pitch px-4 py-3 text-white">
              <h3 className="font-display text-lg font-bold">{teamName(bundle, inn!.batting_team_id)}</h3>
              <p className="tabular-nums"><b className="text-xl">{state!.runs}/{state!.wickets}</b> <span className="text-white/70">({state!.overs} ov · RR {f2(state!.runRate)})</span></p>
            </header>
            <div className="overflow-x-auto">
              <table className="tbl">
                <thead><tr><th>Batter</th><th></th><th className="num">R</th><th className="num">B</th><th className="num">4s</th><th className="num">6s</th><th className="num">SR</th></tr></thead>
                <tbody>
                  {sc.batting.map((r) => (
                    <tr key={r.playerId}>
                      <td className="font-semibold">
                        <Link href={`/players/${r.playerId}`} className="hover:underline">{nm(r.playerId)}</Link>
                        {!r.out && !r.retired && atCrease.has(r.playerId) && !state!.complete && r.playerId === state!.striker && <span className="text-ball"> *</span>}
                      </td>
                      <td className="text-xs muted">{dismissalText(r, nm)}</td>
                      <td className="num font-bold">{r.runs}{!r.out ? "*" : ""}</td><td className="num">{r.balls}</td>
                      <td className="num">{r.fours}</td><td className="num">{r.sixes}</td><td className="num">{f1(r.strikeRate)}</td>
                    </tr>
                  ))}
                  <tr><td className="muted">Extras</td><td colSpan={6} className="text-xs muted">{state!.extras.total} (wd {state!.extras.wides}, nb {state!.extras.noBalls}, b {state!.extras.byes}, lb {state!.extras.legByes})</td></tr>
                </tbody>
              </table>
            </div>
            {yetToBat.length > 0 && <p className="px-4 py-2 text-xs muted">Did not bat: {yetToBat.map(nm).join(", ")}</p>}
            {sc.fow.length > 0 && (
              <p className="px-4 pb-2 text-xs muted">
                Fall of wickets: {sc.fow.map((f) => `${f.score}-${f.wicketNo} (${nm(f.playerId)}, ${f.overs})`).join(" · ")}
              </p>
            )}
            <div className="overflow-x-auto border-t border-black/5">
              <table className="tbl">
                <thead><tr><th>Bowler</th><th className="num">O</th><th className="num">M</th><th className="num">R</th><th className="num">W</th><th className="num">Econ</th><th className="num">Wd</th><th className="num">Nb</th></tr></thead>
                <tbody>
                  {sc.bowling.map((r) => (
                    <tr key={r.playerId}>
                      <td className="font-semibold"><Link href={`/players/${r.playerId}`} className="hover:underline">{nm(r.playerId)}</Link></td>
                      <td className="num">{r.overs}</td><td className="num">{r.maidens}</td><td className="num">{r.runs}</td>
                      <td className="num font-bold">{r.wickets}</td><td className="num">{f2(r.economy)}</td><td className="num">{r.wides}</td><td className="num">{r.noBalls}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <details className="border-t border-black/5 px-4 py-3">
              <summary className="cursor-pointer text-sm font-semibold text-pitch">Over by over</summary>
              <ol className="mt-2 space-y-1.5">
                {sc.overs.map((o) => (
                  <li key={o.overNo} className="flex flex-wrap items-center gap-1.5 text-sm">
                    <span className="w-14 shrink-0 font-semibold">Ov {o.overNo}</span>
                    <span className="w-24 shrink-0 truncate text-xs muted">{nm(o.bowlerId)}</span>
                    {o.symbols.map((s, i) => <BallDot key={i} s={s} />)}
                    <span className="ml-auto text-xs muted tabular-nums">{o.runs} runs · {o.scoreAtEnd}</span>
                  </li>
                ))}
              </ol>
            </details>
          </section>
        );
      })}
    </div>
  );
}

/** One ball in an over strip. Solid fills + a ring so every ball reads on white cards AND the dark-green scoreboard. */
export function BallDot({ s }: { s: string }) {
  const cls = s.startsWith("W")
    ? "bg-ball text-white ring-white/70"
    : s === "4" ? "bg-sky-600 text-white ring-white/70"
    : s === "6" ? "bg-gold text-pitch-900 ring-white/70"
    : s === "R" ? "bg-violet-100 text-violet-900 ring-violet-300"
    : /wd|nb|b|lb/.test(s) ? "bg-amber-200 text-amber-950 ring-amber-400"
    : s === "•" ? "bg-slate-200 text-slate-800 ring-slate-300"
    : "bg-white text-pitch-900 ring-pitch-200";
  const label = s === "•" ? "dot ball" : s === "R" ? "batter retired" : s;
  return (
    <span title={label} aria-label={label} className={`inline-grid h-7 min-w-7 place-items-center rounded-full px-1.5 text-xs font-bold ring-1 ${cls}`}>
      {s}
    </span>
  );
}
