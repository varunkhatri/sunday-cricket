import Link from "next/link";
import type { MatchBundle } from "@/lib/types";
import { computeMatch } from "@/lib/cricket/engine";

export function StatusChip({ status }: { status: string }) {
  if (status === "live")
    return <span className="chip bg-red-100 text-red-700"><span className="live-dot mr-1 h-1.5 w-1.5 rounded-full bg-red-600" />LIVE</span>;
  if (status === "completed") return <span className="chip bg-pitch-100 text-pitch-700">Result</span>;
  return <span className="chip bg-black/5 text-ink/60">Upcoming</span>;
}

export default function MatchCard({ bundle, href }: { bundle: MatchBundle; href?: string }) {
  const s = computeMatch(bundle);
  const { match, teamA, teamB } = bundle;
  const line = (teamId: string) => {
    const inn = s.firstInnings?.batting_team_id === teamId ? s.first : s.secondInnings?.batting_team_id === teamId ? s.second : null;
    return inn ? <span className="tabular-nums"><b className="text-lg">{inn.runs}/{inn.wickets}</b> <span className="text-sm muted">({inn.overs})</span></span> : <span className="text-sm muted">–</span>;
  };
  const winner = s.result?.winnerId;
  return (
    <Link href={href ?? `/matches/${match.id}`} className="card block p-4 transition hover:border-pitch/30 hover:shadow-md">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold uppercase tracking-wider text-ink/50">Match {match.match_no} · {match.overs} ov</span>
        <StatusChip status={match.status} />
      </div>
      <div className="mt-2 space-y-1">
        {[teamA, teamB].map((t) => (
          <div key={t.id} className="flex items-center justify-between gap-2">
            <span className={`truncate font-semibold ${winner === t.id ? "text-pitch-700" : ""}`}>{winner === t.id && "🏆 "}{t.name}</span>
            {line(t.id)}
          </div>
        ))}
      </div>
      <p className="mt-2 text-sm font-medium text-pitch-700">
        {s.result?.text ??
          (s.phase === "second" && s.second && s.target
            ? `Need ${s.target - s.second.runs} off ${match.overs * 6 - s.second.legalBalls} balls`
            : s.phase === "break" ? "Innings break" : s.phase === "setup" ? "Toss to come" : "In progress")}
      </p>
    </Link>
  );
}
