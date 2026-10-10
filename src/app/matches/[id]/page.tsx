import Link from "next/link";
import { notFound } from "next/navigation";
import AutoRefresh from "@/components/AutoRefresh";
import { StatusChip } from "@/components/MatchCard";
import ScorecardView, { BallDot } from "@/components/ScorecardView";
import Summary from "@/components/Summary";
import { computeMatch, ballSymbol, teamName } from "@/lib/cricket/engine";
import { getDay, getMatchBundle, getPlayerNames } from "@/lib/data/queries";
import { fmtDate } from "@/lib/format";
import { isAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function MatchPage({ params }: { params: { id: string } }) {
  const [bundle, names] = await Promise.all([getMatchBundle(params.id), getPlayerNames()]);
  if (!bundle) notFound();
  const day = await getDay(bundle.match.match_day_id);
  const st = computeMatch(bundle);
  const live = bundle.match.status === "live";
  const cur = st.phase === "second" ? st.second : st.first;
  const toss = bundle.match.toss_winner_id
    ? `${teamName(bundle, bundle.match.toss_winner_id)} won the toss and chose to ${bundle.match.toss_decision}`
    : null;
  return (
    <div className="space-y-5">
      {live && <AutoRefresh seconds={6} />}
      <div>
        {day && <Link href={`/days/${day.id}`} className="text-sm font-semibold text-pitch hover:underline">← {fmtDate(day.date)}</Link>}
        <div className="mt-1 flex items-center gap-2">
          <h1 className="h1">{bundle.teamA.name} vs {bundle.teamB.name}</h1>
        </div>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm muted">
          <StatusChip status={bundle.match.status} /> Match {bundle.match.match_no} · {bundle.match.overs} overs · {bundle.match.players_per_side} a side
        </p>
        {toss && <p className="mt-1 text-sm muted">🪙 {toss}</p>}
        {isAdmin() && <Link href={`/admin/matches/${bundle.match.id}/score`} className="btn-gold mt-3 text-sm">Open scorer</Link>}
      </div>

      {st.result ? (
        <p className="card border-gold-300 bg-gold-100/50 p-4 text-lg font-bold text-pitch-900">🏆 {st.result.text}</p>
      ) : live && cur ? (
        <section className="card p-4">
          <p className="text-sm font-semibold text-ink/60">{teamName(bundle, st.phase === "second" ? st.secondInnings!.batting_team_id : st.firstInnings!.batting_team_id)} batting</p>
          <p className="font-display text-4xl font-extrabold tabular-nums text-pitch-900">{cur.runs}/{cur.wickets} <span className="text-lg font-semibold muted">({cur.overs})</span></p>
          {st.phase === "second" && st.target && st.second && (
            <p className="mt-1 font-semibold text-ball">Need {st.target - st.second.runs} off {bundle.match.overs * 6 - st.second.legalBalls} balls</p>
          )}
          {st.phase === "break" && <p className="mt-1 font-semibold text-gold-700">Innings break — target {st.target}</p>}
          {cur.currentOver.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5"><span className="text-xs muted">This over:</span>{cur.currentOver.map((b) => <BallDot key={b.id} s={ballSymbol(b)} />)}</div>
          )}
        </section>
      ) : null}

      {bundle.match.summary && (
        <article className="card p-4 sm:p-5"><Summary text={bundle.match.summary} /></article>
      )}
      <ScorecardView bundle={bundle} names={names} />
    </div>
  );
}
