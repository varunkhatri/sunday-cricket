import Link from "next/link";

const STYLES = {
  bat: { icon: "🏏", label: "Best Batsman of the Day", box: "border-sky-300 bg-gradient-to-br from-sky-100 via-white to-sky-50", tag: "text-sky-800" },
  bowl: { icon: "🎯", label: "Best Bowler of the Day", box: "border-rose-300 bg-gradient-to-br from-rose-100 via-white to-rose-50", tag: "text-rose-800" },
  field: { icon: "🧤", label: "Best Fielder of the Day", box: "border-emerald-300 bg-gradient-to-br from-emerald-100 via-white to-emerald-50", tag: "text-emerald-800" },
} as const;

/** A showcase card for Best Batsman / Bowler / Fielder, in the same spirit as the Player of the Day card. */
export default function AwardCard({ kind, playerId, name, stat, points, text }: {
  kind: keyof typeof STYLES; playerId: string; name: string; stat: string; points: number; text: string;
}) {
  const st = STYLES[kind];
  return (
    <section className={`relative overflow-hidden rounded-2xl border p-5 shadow-card ${st.box}`}>
      <div className="flex items-start gap-4">
        <div className="relative shrink-0 text-5xl drop-shadow" aria-hidden>
          🏅<span className="absolute -bottom-1 -right-2 text-2xl">{st.icon}</span>
        </div>
        <div className="min-w-0">
          <p className={`text-xs font-bold uppercase tracking-widest ${st.tag}`}>{st.label}</p>
          <Link href={`/players/${playerId}`} className="font-display text-2xl font-extrabold text-pitch-900 hover:underline">{name}</Link>
          <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
            <span className="chip bg-pitch text-white">{points} pts</span>
            <span className="chip bg-white/80 text-pitch">{stat}</span>
          </div>
        </div>
      </div>
      <p className="mt-4 text-[15px] font-medium leading-relaxed text-pitch-900">{text}</p>
    </section>
  );
}
