import Link from "next/link";
import type { DayAward } from "@/lib/cricket/stats";

export default function PotdCard({ award, text, name, runnersUp, names }: {
  award: DayAward; text: string; name: string; runnersUp?: DayAward[]; names: Record<string, string>;
}) {
  return (
    <section className="shine relative overflow-hidden rounded-2xl border border-gold-300 p-5 shadow-card">
      <div className="flex items-start gap-4">
        <div className="text-5xl sm:text-6xl drop-shadow" aria-hidden>🏆</div>
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-widest text-gold-700">Player of the Day</p>
          <Link href={`/players/${award.playerId}`} className="font-display text-2xl sm:text-3xl font-extrabold text-pitch-900 hover:underline">
            {name}
          </Link>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
            <span className="chip bg-pitch text-white">{award.points} pts</span>
            {award.runs > 0 && <span className="chip bg-white/80 text-pitch">🏏 {award.runs} run{award.runs === 1 ? "" : "s"}</span>}
            {award.wickets > 0 && <span className="chip bg-white/80 text-pitch">🎯 {award.wickets} wkt{award.wickets === 1 ? "" : "s"}</span>}
            {award.catches > 0 && <span className="chip bg-white/80 text-pitch">🙌 {award.catches} field</span>}
          </div>
        </div>
      </div>
      <p className="mt-4 text-[15px] font-medium leading-relaxed text-pitch-900">{text}</p>
      {runnersUp && runnersUp.length > 0 && (
        <p className="mt-3 text-sm text-pitch-900/70">
          Close behind: {runnersUp.map((r, i) => (
            <span key={r.playerId}>{i ? ", " : ""}{i === 0 ? "🥈" : "🥉"} {names[r.playerId]} ({r.points})</span>
          ))}
        </p>
      )}
    </section>
  );
}
