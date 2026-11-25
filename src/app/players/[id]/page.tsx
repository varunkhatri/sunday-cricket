import Link from "next/link";
import { notFound } from "next/navigation";
import { aggregateCaptains, aggregatePlayers, rankDay } from "@/lib/cricket/stats";
import { store } from "@/lib/data/store";
import { getPlayerNames, getPlayerPhotos } from "@/lib/data/queries";
import { DISMISSAL_TYPES, playerMatchups, strikeRate, type FaceOff } from "@/lib/cricket/matchups";
import { isSuperAdmin } from "@/lib/auth";
import Avatar from "@/components/Avatar";
import PlayerPhotoUploader from "@/components/admin/PlayerPhotoUploader";
import { loadRange } from "@/lib/data/statsLoader";
import { f1, f2, fmtDate, fmtMonth } from "@/lib/format";
import type { Player } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PlayerPage({ params }: { params: { id: string } }) {
  const player = await store().get<Player>("players", params.id);
  if (!player) notFound();
  const [{ perfs, days }, names, photos] = await Promise.all([loadRange({}), getPlayerNames(), getPlayerPhotos()]);
  const finished = days.flatMap((d) => d.bundles.filter((b) => b.match.status === "completed"));
  const mu = playerMatchups(finished, player.id);
  const nm = (id: string) => names[id] ?? "?";
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
        <Avatar name={player.name} url={player.photo_url} size={88} className="ring-4 ring-white shadow-card" />
        <div className="min-w-0">
          <h1 className="h1">{player.name}</h1>
          {player.nickname && <p className="muted">“{player.nickname}”</p>}
          {potdWins.length > 0 && <p className="mt-1 text-sm font-semibold text-gold-700">{"🏆".repeat(Math.min(potdWins.length, 5))} Player of the Day ×{potdWins.length}</p>}
          {mvpWins > 0 && <p className="mt-1 text-sm font-semibold text-violet-800">{"🏅".repeat(Math.min(mvpWins, 5))} MVP of the Day (players&apos; vote) ×{mvpWins}</p>}
          {isSuperAdmin() && <div className="mt-2"><PlayerPhotoUploader playerId={player.id} hasPhoto={!!player.photo_url} /></div>}
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

          <BattingMatchups mu={mu} nm={nm} photos={photos} />
          <BowlingMatchups mu={mu} nm={nm} photos={photos} />

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

/* ---------- head-to-head sections ---------- */

type Names = (id: string) => string;

function Who({ id, nm, photos }: { id: string; nm: Names; photos: Record<string, string> }) {
  return (
    <Link href={`/players/${id}`} className="inline-flex min-w-0 items-center gap-2 font-semibold hover:underline">
      <Avatar name={nm(id)} url={photos[id]} size={24} />
      <span className="truncate">{nm(id)}</span>
    </Link>
  );
}

/** One row per way of getting out, with a thin bar for the share. */
function HowOutBars({ counts, total, extra }: { counts: Record<string, number>; total: number; extra?: { label: string; n: number }[] }) {
  const rows = [
    ...DISMISSAL_TYPES.map((t) => ({ label: t.label, n: counts[t.key] ?? 0 })).filter((r) => r.n > 0),
    ...(extra ?? []).filter((r) => r.n > 0),
  ];
  if (!rows.length) return <p className="text-sm muted">Nothing yet.</p>;
  const max = Math.max(...rows.map((r) => r.n));
  return (
    <ul className="space-y-1.5">
      {rows.map((r) => (
        <li key={r.label} className="grid grid-cols-[6.5rem_1fr_2.5rem] items-center gap-2 text-sm">
          <span className="text-ink/80">{r.label}</span>
          <span className="h-2.5 rounded-full bg-pitch-50">
            <span className="block h-2.5 rounded-full bg-pitch-600" style={{ width: `${Math.max(6, (r.n / max) * 100)}%` }} />
          </span>
          <span className="text-right font-bold tabular-nums">
            {r.n}
            {total > 0 && <span className="ml-1 text-xs font-normal muted">{Math.round((r.n / total) * 100)}%</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}

function Highlight({ icon, label, id, detail, nm, photos }: { icon: string; label: string; id: string; detail: string; nm: Names; photos: Record<string, string> }) {
  return (
    <div className="rounded-xl bg-pitch-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wider text-ink/50">{icon} {label}</p>
      <div className="mt-1"><Who id={id} nm={nm} photos={photos} /></div>
      <p className="mt-0.5 text-sm tabular-nums muted">{detail}</p>
    </div>
  );
}

function BattingMatchups({ mu, nm, photos }: { mu: ReturnType<typeof playerMatchups>; nm: Names; photos: Record<string, string> }) {
  const b = mu.batting;
  if (!b.innings) return null;
  const fav = b.vsBowlers[0];
  const nemesis = [...b.vsBowlers].filter((f) => f.outs > 0).sort((x, y) => y.outs - x.outs || x.runs - y.runs)[0];
  const sr = (f: FaceOff) => { const v = strikeRate(f); return v == null ? "–" : v.toFixed(0); };
  const catchers = Object.entries(b.caughtBy).sort((x, y) => y[1] - x[1]);
  const runOuts = Object.entries(b.runOutBy).sort((x, y) => y[1] - x[1]);
  return (
    <section className="card space-y-4 p-4">
      <h2 className="h2">🏏 Batting: how he gets out &amp; who he scores off</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm muted">
            {b.innings} innings · out {b.outs} · not out {b.notOuts}{b.retired ? ` · retired ${b.retired}` : ""}
          </p>
          <HowOutBars counts={b.howOut} total={b.outs} />
          {(catchers.length > 0 || runOuts.length > 0) && (
            <p className="mt-3 text-xs leading-relaxed muted">
              {catchers.length > 0 && <>Caught by {catchers.map(([id, n]) => `${nm(id)} ×${n}`).join(", ")}. </>}
              {runOuts.length > 0 && <>Run out by {runOuts.map(([id, n]) => `${nm(id)} ×${n}`).join(", ")}.</>}
            </p>
          )}
        </div>
        <div className="grid content-start gap-2">
          {fav && fav.runs > 0 && (
            <Highlight icon="🍯" label="Scores most off" id={fav.playerId} nm={nm} photos={photos}
              detail={`${fav.runs} runs from ${fav.balls} balls · SR ${sr(fav)}${fav.sixes ? ` · ${fav.sixes}×6` : ""}`} />
          )}
          {nemesis && (
            <Highlight icon="😈" label="Gets him out most" id={nemesis.playerId} nm={nm} photos={photos}
              detail={`out ${nemesis.outs} time${nemesis.outs === 1 ? "" : "s"} · ${nemesis.runs} runs from ${nemesis.balls} balls`} />
          )}
        </div>
      </div>
      {b.vsBowlers.length > 0 && (
        <div className="-mx-4 overflow-x-auto border-t border-black/5">
          <table className="tbl">
            <thead><tr><th>Against bowler</th><th className="num">Runs</th><th className="num">Balls</th><th className="num">SR</th><th className="num">4s</th><th className="num">6s</th><th className="num">Dots</th><th className="num">Out</th></tr></thead>
            <tbody>
              {b.vsBowlers.map((f) => (
                <tr key={f.playerId}>
                  <td><Who id={f.playerId} nm={nm} photos={photos} /></td>
                  <td className="num font-bold">{f.runs}</td><td className="num">{f.balls}</td><td className="num">{sr(f)}</td>
                  <td className="num">{f.fours}</td><td className="num">{f.sixes}</td><td className="num">{f.dots}</td>
                  <td className={`num ${f.outs ? "font-bold text-ball" : ""}`}>{f.outs}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="px-4 pt-2 text-xs muted">Runs off the bat only. &ldquo;Out&rdquo; counts the bowler&apos;s wickets (run outs aren&apos;t the bowler&apos;s).</p>
        </div>
      )}
    </section>
  );
}

function BowlingMatchups({ mu, nm, photos }: { mu: ReturnType<typeof playerMatchups>; nm: Names; photos: Record<string, string> }) {
  const w = mu.bowling;
  if (!w.victims.length) return null;
  const bunny = w.victims.find((v) => v.outs > 0);
  const toughest = [...w.victims].sort((x, y) => y.runs - x.runs || y.balls - x.balls)[0];
  const econ = (f: FaceOff) => (f.balls ? ((f.runs / f.balls) * 6).toFixed(1) : "–");
  return (
    <section className="card space-y-4 p-4">
      <h2 className="h2">🎯 Bowling: how he takes wickets &amp; who he gets out</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="mb-2 text-sm muted">{w.wickets} wicket{w.wickets === 1 ? "" : "s"}{w.caughtAndBowled ? ` · ${w.caughtAndBowled} caught & bowled` : ""}</p>
          <HowOutBars counts={w.howOut} total={w.wickets} />
        </div>
        <div className="grid content-start gap-2">
          {bunny && (
            <Highlight icon="🐰" label="Favourite wicket" id={bunny.playerId} nm={nm} photos={photos}
              detail={`dismissed ${bunny.outs} time${bunny.outs === 1 ? "" : "s"} · ${bunny.runs} runs off ${bunny.balls} balls`} />
          )}
          {toughest && toughest.runs > 0 && (
            <Highlight icon="💥" label="Hardest to bowl to" id={toughest.playerId} nm={nm} photos={photos}
              detail={`${toughest.runs} runs off ${toughest.balls} balls · out ${toughest.outs}`} />
          )}
        </div>
      </div>
      <div className="-mx-4 overflow-x-auto border-t border-black/5">
        <table className="tbl">
          <thead><tr><th>Against batter</th><th className="num">Wkts</th><th className="num">Balls</th><th className="num">Runs</th><th className="num">Runs/over</th><th className="num">Dots</th><th className="num">4s</th><th className="num">6s</th></tr></thead>
          <tbody>
            {w.victims.map((f) => (
              <tr key={f.playerId}>
                <td><Who id={f.playerId} nm={nm} photos={photos} /></td>
                <td className={`num ${f.outs ? "font-bold text-pitch-700" : ""}`}>{f.outs}</td><td className="num">{f.balls}</td><td className="num">{f.runs}</td>
                <td className="num">{econ(f)}</td><td className="num">{f.dots}</td><td className="num">{f.fours}</td><td className="num">{f.sixes}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="px-4 pt-2 text-xs muted">Runs off the bat only (wides, no-balls and byes aren&apos;t counted against a batter).</p>
      </div>
    </section>
  );
}
