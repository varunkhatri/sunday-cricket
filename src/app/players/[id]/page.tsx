import Link from "next/link";
import { notFound } from "next/navigation";
import { aggregateCaptains, aggregatePlayers, rankDay } from "@/lib/cricket/stats";
import { store } from "@/lib/data/store";
import { loadRange } from "@/lib/data/statsLoader";
import { f1, f2, fmtDate, fmtMonth } from "@/lib/format";
import type { Player } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: { id: string } }) {
  const player = await store().get<Player>("players", params.id);
  if (!player) notFound();
  const { perfs, days } = await loadRange({});
  const mine = perfs.filter((p) => p.playerId === player.id);
  const all = aggregatePlayers(mine)[0];
  const months = [...new Set(mine.map((p) => p.date.slice(0, 7)))].sort().reverse();
  const byMonth = months.map((m) => ({ m, a: aggregatePlayers(mine.filter((p) => p.date.startsWith(m)))[0] }));
  const potdWins = days.filter((d) => {
    const ids = new Set(d.bundles.map((b) => b.match.id));
    return rankDay(perfs.filter((p) => ids.has(p.matchId)))[0]?.playerId === player.id;
  });
  const cap = aggregateCaptains(days).find((c) => c.playerId === player.id);
  const mvpWins = days.filter((d) => d.day.mvp_player_id === player.id).length;
  const matchInfo = new Map(days.flatMap((d) => d.bundles.map((b) => [b.match.id, { b, date: d.day.date }] as const)));
  const recent = [...mine].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 12);

  const Stat = ({ label, value }: { label: string; value: string | number }) => (
    <div className="rounded-xl bg-pitch-50 p-3 text-center"><p className="font-display text-2xl font-extrabold tabular-nums text-pitch-900">{value}</p><p className="text-xs font-semibold uppercase tracking-wider text-ink/50">{label}</p></div>
  );

  return (
    <div className="space-y-5">
      <Link href="/players" className="text-sm font-semibold text-pitch hover:underline">← All players</Link>
      <div className="flex items-center gap-4">
        <span className="grid h-16 w-16 place-items-center rounded-full bg-pitch font-display text-2xl font-bold text-white">
          {player.name.split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase()}
        </span>
        <div>
          <h1 className="h1">{player.name}</h1>
          {player.nickname && <p className="muted">“{player.nickname}”</p>}
          {potdWins.length > 0 && <p className="mt-1 text-sm font-semibold text-gold-700">{"🏆".repeat(Math.min(potdWins.length, 5))} Player of the Day ×{potdWins.length}</p>}
          {mvpWins > 0 && <p className="mt-1 text-sm font-semibold text-violet-800">{"🏅".repeat(Math.min(mvpWins, 5))} MVP of the Day (players&apos; vote) ×{mvpWins}</p>}
        </div>
      </div>

      {!all ? (
        <p className="card p-6 text-center muted">No completed matches yet — the first highlight is coming soon! 🏏</p>
      ) : (
        <>
          <section className="card p-4">
            <h2 className="h2">Career</h2>
            <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-6">
              <Stat label="Matches" value={all.matches} />
              <Stat label="Won" value={all.wins} />
              <Stat label="Runs" value={all.runs} />
              <Stat label="Wickets" value={all.wickets} />
              <Stat label="Catches" value={all.catches} />
              <Stat label="MVP pts" value={all.points} />
            </div>
            <div className="mt-4 grid gap-4 sm:grid-cols-2 text-sm">
              <p><b>Batting:</b> {all.innings} inns · HS {all.highest}{all.highestNotOut ? "*" : ""} · avg {f1(all.average)} · SR {f1(all.balls ? all.strikeRate : null)} · {all.fours}×4 · {all.sixes}×6</p>
              <p><b>Bowling:</b> {Math.floor(all.bowlBalls / 6)}.{all.bowlBalls % 6} ov · best {all.bestW}/{all.bestR} · econ {f2(all.economy)} · {all.maidens} maidens</p>
              {cap && <p><b>Captaincy:</b> {cap.won}W {cap.lost}L {cap.tied ? `${cap.tied}T ` : ""}· series won {cap.seriesWon}/{cap.seriesPlayed}</p>}
            </div>
          </section>

          <section className="card overflow-x-auto">
            <h2 className="h2 px-4 pt-4">Month by month</h2>
            <table className="tbl mt-2">
              <thead><tr><th>Month</th><th className="num">M</th><th className="num">Runs</th><th className="num">HS</th><th className="num">SR</th><th className="num">Wkts</th><th className="num">Econ</th><th className="num">Pts</th></tr></thead>
              <tbody>
                {byMonth.map(({ m, a }) => (
                  <tr key={m}>
                    <td><Link href={`/history?month=${m}`} className="font-semibold hover:underline">{fmtMonth(m)}</Link></td>
                    <td className="num">{a.matches}</td><td className="num font-bold">{a.runs}</td><td className="num">{a.highest}{a.highestNotOut ? "*" : ""}</td>
                    <td className="num">{f1(a.balls ? a.strikeRate : null)}</td><td className="num font-bold">{a.wickets}</td><td className="num">{f2(a.economy)}</td><td className="num">{a.points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>

          <section className="card overflow-x-auto">
            <h2 className="h2 px-4 pt-4">Recent matches</h2>
            <table className="tbl mt-2">
              <thead><tr><th>Date</th><th>Match</th><th className="num">Bat</th><th className="num">Bowl</th><th className="num">Field</th><th>Result</th></tr></thead>
              <tbody>
                {recent.map((p) => {
                  const info = matchInfo.get(p.matchId);
                  return (
                    <tr key={p.matchId}>
                      <td>{fmtDate(p.date, { day: "numeric", month: "short" })}</td>
                      <td><Link href={`/matches/${p.matchId}`} className="hover:underline">{info ? `${info.b.teamA.name} v ${info.b.teamB.name}` : "Match"}</Link></td>
                      <td className="num">{p.batted ? `${p.runs}${p.out ? "" : "*"} (${p.balls})` : "–"}</td>
                      <td className="num">{p.bowled ? `${p.wickets}/${p.bowlRuns}` : "–"}</td>
                      <td className="num">{p.catches + p.runOuts + p.stumpings || "–"}</td>
                      <td>{p.common ? <span className="chip bg-violet-100 text-violet-900">🤝 Common</span> : p.won === true ? <span className="chip bg-pitch-100 text-pitch-700">Won</span> : p.won === false ? <span className="chip bg-black/5 text-ink/60">Lost</span> : <span className="chip bg-gold-100 text-gold-700">Tie</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </section>
        </>
      )}
    </div>
  );
}
