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
import AwardCard from "./AwardCard";
import { awardMessage } from "@/lib/cricket/summary";

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

      {o.mvp && (
        <section className="relative overflow-hidden rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 shadow-card">
          <div className="flex items-start gap-4">
            <div className="text-5xl drop-shadow" aria-hidden>🏅</div>
            <div className="min-w-0">
              <p className="text-xs font-bold uppercase tracking-widest text-violet-800">MVP of the Day · chosen by the players</p>
              <Link href={`/players/${o.mvp}`} className="font-display text-2xl font-extrabold text-pitch-900 hover:underline">{names[o.mvp] ?? "?"}</Link>
            </div>
          </div>
          <p className="mt-3 text-[15px] font-medium leading-relaxed text-pitch-900">
            {day.mvp_note ? `“${day.mvp_note}” ` : ""}The whole squad voted, and the verdict is in — {names[o.mvp] ?? "our MVP"} was the heartbeat of the team today! 🗳️👏
          </p>
        </section>
      )}

      {(o.bestBat || o.bestBowl || o.bestField) && (
        <section className="space-y-3">
          <h2 className="h2">Stars of the day ⭐</h2>
          <div className="grid gap-3 md:grid-cols-3">
            {o.bestBat && (
              <AwardCard kind="bat" playerId={o.bestBat.playerId} name={names[o.bestBat.playerId] ?? "?"} points={o.bestBat.batPoints}
                stat={`${o.bestBat.runs} runs (${o.bestBat.balls} balls)`}
                text={awardMessage("bat", day.id, names[o.bestBat.playerId] ?? "?", o.bestBat)} />
            )}
            {o.bestBowl && (
              <AwardCard kind="bowl" playerId={o.bestBowl.playerId} name={names[o.bestBowl.playerId] ?? "?"} points={o.bestBowl.bowlPoints}
                stat={`${o.bestBowl.wickets}/${o.bestBowl.bowlRuns}`}
                text={awardMessage("bowl", day.id, names[o.bestBowl.playerId] ?? "?", o.bestBowl)} />
            )}
            {o.bestField && (
              <AwardCard kind="field" playerId={o.bestField.playerId} name={names[o.bestField.playerId] ?? "?"} points={o.bestField.fieldPoints}
                stat={`${o.bestField.catches} dismissal${o.bestField.catches === 1 ? "" : "s"}`}
                text={awardMessage("field", day.id, names[o.bestField.playerId] ?? "?", o.bestField)} />
            )}
          </div>
        </section>
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
