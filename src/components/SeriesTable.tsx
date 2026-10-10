import type { DayTeam } from "@/lib/types";
import type { SeriesResult } from "@/lib/cricket/stats";
import { signed } from "@/lib/format";

export default function SeriesTable({ series, teams, names }: { series: SeriesResult; teams: DayTeam[]; names: Record<string, string> }) {
  const tn = (id: string) => teams.find((t) => t.id === id);
  const winner = series.winnerId ? tn(series.winnerId) : null;
  const finished = series.matchesTotal > 0 && series.matchesCompleted === series.matchesTotal;
  return (
    <section className="card p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="h2">Series of the day</h2>
        <span className="text-sm muted">{series.matchesCompleted}/{series.matchesTotal} played</span>
      </div>
      {series.matchesCompleted > 0 && (
        <p className="mt-1 font-semibold text-pitch-700">
          {series.shared
            ? "🤝 Series level — honours shared!"
            : winner
              ? `${finished ? "🏆" : "📈"} ${winner.name} ${finished ? "win the series" : "lead the series"}${series.decidedBy === "nrr" ? " on net run rate" : ""}`
              : null}
        </p>
      )}
      <div className="mt-3 overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr><th>Team</th><th className="num">P</th><th className="num">W</th><th className="num">L</th><th className="num">T</th><th className="num">NRR</th></tr>
          </thead>
          <tbody>
            {series.standings.map((s) => {
              const t = tn(s.teamId);
              return (
                <tr key={s.teamId} className={s.teamId === series.winnerId && finished ? "bg-gold-100/60" : ""}>
                  <td className="font-semibold">
                    {t?.name}
                    {t?.captain_id && <span className="ml-1 text-xs font-normal muted">(c {names[t.captain_id]})</span>}
                  </td>
                  <td className="num">{s.played}</td><td className="num font-bold">{s.won}</td><td className="num">{s.lost}</td><td className="num">{s.tied}</td>
                  <td className="num">{s.played ? signed(s.nrr) : "–"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}
