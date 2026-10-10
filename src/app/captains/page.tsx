import Link from "next/link";
import { Suspense } from "react";
import MonthPicker from "@/components/MonthPicker";
import { aggregateCaptains } from "@/lib/cricket/stats";
import { getPlayerNames } from "@/lib/data/queries";
import { availableMonths, loadRange } from "@/lib/data/statsLoader";

export const dynamic = "force-dynamic";

export default async function CaptainsPage({ searchParams }: { searchParams: Record<string, string | undefined> }) {
  const [{ days }, names, months] = await Promise.all([loadRange(searchParams), getPlayerNames(), availableMonths()]);
  const caps = aggregateCaptains(days);
  return (
    <div className="space-y-4">
      <div>
        <h1 className="h1">Captains&apos; table 🧢</h1>
        <p className="muted">Who leads from the front? Matches and day-series won and lost as captain.</p>
      </div>
      <Suspense><MonthPicker months={months} /></Suspense>
      {caps.length === 0 ? (
        <p className="card p-6 text-center muted">No completed matches with a captain in this period.</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {caps.slice(0, 3).map((c, i) => (
              <div key={c.playerId} className={`card p-4 ${i === 0 ? "border-gold-300 bg-gold-100/40" : ""}`}>
                <p className="text-2xl">{["🥇", "🥈", "🥉"][i]}</p>
                <Link href={`/players/${c.playerId}`} className="font-display text-lg font-bold hover:underline">{names[c.playerId]}</Link>
                <p className="tabular-nums muted">{c.won}W · {c.lost}L{c.tied ? ` · ${c.tied}T` : ""} · {c.winPct.toFixed(0)}%</p>
              </div>
            ))}
          </div>
          <div className="card overflow-x-auto">
            <table className="tbl">
              <thead><tr><th>Captain</th><th className="num">Matches</th><th className="num">Won</th><th className="num">Lost</th><th className="num">Tied</th><th className="num">Win %</th><th className="num">Series won</th></tr></thead>
              <tbody>
                {caps.map((c) => (
                  <tr key={c.playerId}>
                    <td className="font-semibold"><Link href={`/players/${c.playerId}`} className="hover:underline">{names[c.playerId]}</Link></td>
                    <td className="num">{c.matches}</td><td className="num font-bold text-pitch-700">{c.won}</td><td className="num">{c.lost}</td><td className="num">{c.tied}</td>
                    <td className="num">{c.winPct.toFixed(0)}%</td><td className="num">{c.seriesWon}/{c.seriesPlayed}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
