import Link from "next/link";
import type { DayFull } from "@/lib/data/queries";
import { dayOverview } from "@/lib/dayView";
import { fmtDate } from "@/lib/format";
import AutoRefresh from "./AutoRefresh";
import MatchCard from "./MatchCard";
import PhotoGrid from "./PhotoGrid";
import PotdCard from "./PotdCard";
import SeriesTable from "./SeriesTable";
import Summary from "./Summary";

export default function DayView({ data, names, admin }: { data: DayFull; names: Record<string, string>; admin: boolean }) {
  const o = dayOverview(data, names);
  const { day, teams, bundles, photos } = data;
  return (
    <div className="space-y-5">
      {o.live && <AutoRefresh />}
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wider text-gold-700">{o.live ? "Live now" : o.allDone ? "Full time" : "Match day"}</p>
          <h1 className="h1">{fmtDate(day.date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h1>
          {day.venue && <p className="muted">📍 {day.venue}</p>}
        </div>
        {admin && <Link href={`/admin/days/${day.id}`} className="btn-ghost text-sm">Manage day</Link>}
      </div>
      {day.notes && <p className="card p-4 text-[15px]">{day.notes}</p>}

      {o.potd && o.potdText && (
        <PotdCard award={o.potd} text={o.potdText} name={names[o.potd.playerId] ?? "?"} runnersUp={o.ranking.slice(1, 3)} names={names} />
      )}

      {(o.topBat || o.topBowl) && (
        <div className="grid grid-cols-2 gap-3">
          {o.topBat && (
            <div className="card p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink/50">🥇 Most runs</p>
              <p className="mt-1 font-display text-lg font-bold">{names[o.topBat.playerId]}</p>
              <p className="tabular-nums muted">{o.topBat.runs} runs ({o.topBat.balls} balls)</p>
            </div>
          )}
          {o.topBowl && (
            <div className="card p-4">
              <p className="text-xs font-bold uppercase tracking-wider text-ink/50">🎯 Most wickets</p>
              <p className="mt-1 font-display text-lg font-bold">{names[o.topBowl.playerId]}</p>
              <p className="tabular-nums muted">{o.topBowl.wickets} wickets ({o.topBowl.bowlRuns} runs)</p>
            </div>
          )}
        </div>
      )}

      {teams.length >= 2 && <SeriesTable series={o.series} teams={teams} names={names} />}

      <section className="space-y-3">
        <h2 className="h2">Matches</h2>
        {bundles.length === 0 && <p className="card p-4 muted">No matches yet — the umpire will add them soon.</p>}
        <div className="grid gap-3 sm:grid-cols-2">
          {bundles.map((b) => <MatchCard key={b.match.id} bundle={b} />)}
        </div>
      </section>

      {bundles.some((b) => b.match.summary) && (
        <section className="space-y-3">
          <h2 className="h2">Match reports 📰</h2>
          {bundles.filter((b) => b.match.summary).map((b) => (
            <article key={b.match.id} className="card p-4 sm:p-5">
              <p className="mb-1 text-xs font-bold uppercase tracking-wider text-ink/50">Match {b.match.match_no}</p>
              <Summary text={b.match.summary} />
              <Link href={`/matches/${b.match.id}`} className="mt-3 inline-block text-sm font-semibold text-pitch hover:underline">Full scorecard →</Link>
            </article>
          ))}
        </section>
      )}

      {photos.length > 0 && (
        <section className="space-y-3">
          <h2 className="h2">📸 Photos of the day</h2>
          <PhotoGrid photos={photos} />
        </section>
      )}

      {teams.length > 0 && (
        <section className="space-y-3">
          <h2 className="h2">Squads</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {teams.map((t) => (
              <div key={t.id} className="card p-4">
                <p className="font-display font-bold">{t.name}</p>
                <p className="mt-1 text-sm leading-relaxed">
                  {t.player_ids.map((p, i) => (
                    <span key={p}>{i ? ", " : ""}<Link href={`/players/${p}`} className="hover:underline">{names[p]}</Link>{t.captain_id === p && " (c)"}</span>
                  ))}
                </p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
