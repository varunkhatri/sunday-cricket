import Link from "next/link";
import { Suspense } from "react";
import MonthPicker from "@/components/MonthPicker";
import { aggregateCaptains, aggregatePlayers, topBy } from "@/lib/cricket/stats";
import { getPlayerNames } from "@/lib/data/queries";
import { availableMonths, loadRange } from "@/lib/data/statsLoader";
import { dayOverview } from "@/lib/dayView";
import { fmtDate, fmtMonth } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function HistoryPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const months = await availableMonths();
  const month = searchParams.month ?? months[0];
  if (!month)
    return <p className="card p-6 text-center muted">No Sundays recorded yet.</p>;
  const [{ days, perfs }, names] = await Promise.all([loadRange({ month }), getPlayerNames()]);
  const agg = aggregatePlayers(perfs);
  const mvp = topBy(agg, (a) => a.points);
  const bat = topBy(agg, (a) => a.runs, (a) => a.balls);
  const bowl = topBy(agg, (a) => a.wickets, (a) => a.bowlRuns);
  const six = topBy(agg, (a) => a.sixes);
  const cap = aggregateCaptains(days)[0];
  const potdCount = new Map<string, number>();
  const overviews = days.map((d) => ({ d, o: dayOverview(d, names) }));
  const mvpCount = new Map<string, number>();
  for (const { o } of overviews) {
    if (o.potd) potdCount.set(o.potd.playerId, (potdCount.get(o.potd.playerId) ?? 0) + 1);
    if (o.mvp) mvpCount.set(o.mvp, (mvpCount.get(o.mvp) ?? 0) + 1);
  }

  const awards = [
    mvp && { icon: "🏆", label: "Player of the Month", who: mvp.playerId, detail: `${mvp.points} MVP points` },
    bat && { icon: "🏏", label: "Most runs", who: bat.playerId, detail: `${bat.runs} runs · HS ${bat.highest}${bat.highestNotOut ? "*" : ""}` },
    bowl && { icon: "🎯", label: "Most wickets", who: bowl.playerId, detail: `${bowl.wickets} wkts · best ${bowl.bestW}/${bowl.bestR}` },
    six && six.sixes >= 2 && { icon: "🚀", label: "Six machine", who: six.playerId, detail: `${six.sixes} sixes` },
    cap && cap.won > 0 && { icon: "🧢", label: "Top captain", who: cap.playerId, detail: `${cap.won}W–${cap.lost}L` },
  ].filter(Boolean) as { icon: string; label: string; who: string; detail: string }[];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="h1">{fmtMonth(month)}</h1>
          <p className="muted">{days.length} Sunday{days.length === 1 ? "" : "s"} of cricket</p>
        </div>
        <Suspense><MonthPicker months={months} allowAll={false} /></Suspense>
      </div>

      {awards.length > 0 && (
        <section className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {awards.map((a) => (
            <div key={a.label} className={`card p-4 ${a.icon === "🏆" ? "shine col-span-2 border-gold-300 sm:col-span-1" : ""}`}>
              <p className="text-xs font-bold uppercase tracking-wider text-ink/50">{a.icon} {a.label}</p>
              <Link href={`/players/${a.who}`} className="mt-1 block font-display text-lg font-bold hover:underline">{names[a.who]}</Link>
              <p className="text-sm muted">{a.detail}</p>
            </div>
          ))}
        </section>
      )}

      <section className="space-y-3">
        <h2 className="h2">Sundays</h2>
        {overviews.map(({ d, o }) => {
          const w = o.series.winnerId ? d.teams.find((t) => t.id === o.series.winnerId) : null;
          return (
            <Link key={d.day.id} href={`/days/${d.day.id}`} className="card block p-4 transition hover:border-pitch/30">
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <p className="font-display text-lg font-bold">{fmtDate(d.day.date)}</p>
                <p className="text-sm muted">{d.bundles.length} match{d.bundles.length === 1 ? "" : "es"}{d.photos.length ? ` · 📸 ${d.photos.length}` : ""}</p>
              </div>
              <p className="mt-1 text-sm">
                {o.series.shared ? "🤝 Series shared" : w ? `🏆 ${w.name} won the series` : "Series not decided"}
                {o.series.standings.length >= 2 && ` (${o.series.standings.map((s) => s.won).join("–")})`}
              </p>
              {o.potd && <p className="mt-1 text-sm text-gold-700">⭐ Player of the Day: <b>{names[o.potd.playerId]}</b></p>}
              {o.mvp && <p className="mt-1 text-sm text-violet-800">🏅 MVP (players&apos; vote): <b>{names[o.mvp]}</b></p>}
            </Link>
          );
        })}
      </section>

      {potdCount.size > 0 && (
        <section className="card p-4">
          <h2 className="h2">Player of the Day awards</h2>
          <p className="mt-2 flex flex-wrap gap-2">
            {[...potdCount.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => (
              <span key={id} className="chip bg-gold-100 py-1 text-sm text-pitch-900">🏅 {names[id]} ×{n}</span>
            ))}
          </p>
        </section>
      )}
      {mvpCount.size > 0 && (
        <section className="card p-4">
          <h2 className="h2">MVP awards (players&apos; vote)</h2>
          <p className="mt-2 flex flex-wrap gap-2">
            {[...mvpCount.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => (
              <span key={id} className="chip bg-violet-100 py-1 text-sm text-violet-900">🏅 {names[id]} ×{n}</span>
            ))}
          </p>
        </section>
      )}
      <p className="text-center"><Link href={`/stats?month=${month}`} className="btn-ghost">Full stats for {fmtMonth(month)} →</Link></p>
    </div>
  );
}
