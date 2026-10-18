import Link from "next/link";
import { notFound } from "next/navigation";
import ActionForm, { ConfirmButton, Submit } from "@/components/ActionForm";
import ScorePad from "@/components/admin/ScorePad";
import Summary from "@/components/Summary";
import { deleteMatch, regenerateSummaryAction, saveSummary, startMatchAction, updateMatchSettings } from "../../../actions";
import { getDay, getMatchBundle, getPlayerNames, getPlayers } from "@/lib/data/queries";
import { isDayLocked } from "@/lib/lock";

export const dynamic = "force-dynamic";

export default async function ScorePage({ params }: { params: { id: string } }) {
  const [bundle, names, players] = await Promise.all([getMatchBundle(params.id), getPlayerNames(), getPlayers()]);
  if (!bundle) notFound();
  const { match, teamA, teamB } = bundle;
  const day = await getDay(match.match_day_id);
  const locked = day ? isDayLocked(day) : false;
  const commonOptions = players.filter((p) => !teamA.player_ids.includes(p.id) && !teamB.player_ids.includes(p.id));
  const started = bundle.innings.length > 0;

  return (
    <div className="space-y-5">
      <div>
        <Link href={`/admin/days/${match.match_day_id}`} className="text-sm font-semibold text-pitch hover:underline">← Back to the day</Link>
        <h1 className="h1 mt-1">Match {match.match_no}: {teamA.name} vs {teamB.name}</h1>
        <p className="muted">{match.overs} overs · {match.players_per_side} a side{match.common_player_id ? ` · common player: ${names[match.common_player_id]}` : ""}</p>
      </div>

      {locked && (
        <p className="card border-amber-300 bg-amber-50 p-4 text-sm">
          🔒 This match is from a locked Sunday, so its scores are kept exactly as they were. To correct something, unlock the day on the{" "}
          <Link href={`/admin/days/${match.match_day_id}`} className="font-semibold underline">day page</Link>.
        </p>
      )}

      {locked ? null : !started ? (
        <section className="card p-4">
          <h2 className="h2">🪙 Toss</h2>
          <ActionForm action={startMatchAction} className="mt-3 space-y-4">
            <input type="hidden" name="id" value={match.id} />
            <fieldset>
              <legend className="label">Who won the toss?</legend>
              <div className="grid grid-cols-2 gap-2">
                {[teamA, teamB].map((t, i) => (
                  <label key={t.id} className="flex cursor-pointer items-center gap-2 rounded-xl border border-black/10 p-3 has-[:checked]:border-pitch has-[:checked]:bg-pitch-50">
                    <input type="radio" name="toss_winner_id" value={t.id} defaultChecked={i === 0} className="accent-pitch" />
                    <span className="font-semibold">{t.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <fieldset>
              <legend className="label">They chose to…</legend>
              <div className="grid grid-cols-2 gap-2">
                {[["bat", "🏏 Bat first"], ["bowl", "🎯 Bowl first"]].map(([v, l], i) => (
                  <label key={v} className="flex cursor-pointer items-center gap-2 rounded-xl border border-black/10 p-3 has-[:checked]:border-pitch has-[:checked]:bg-pitch-50">
                    <input type="radio" name="toss_decision" value={v} defaultChecked={i === 0} className="accent-pitch" />
                    <span className="font-semibold">{l}</span>
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="block">
              <span className="label">Common player (optional) — plays for both teams</span>
              <select name="common_player_id" className="input" defaultValue="">
                <option value="">— no common player —</option>
                {commonOptions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
              <span className="mt-1 block text-xs muted">They can bat, bowl and field for either side. You can also set or change this during the match.</span>
            </label>
            <Submit className="btn-gold w-full py-3 text-lg">Start match</Submit>
          </ActionForm>
        </section>
      ) : (
        <ScorePad initial={bundle} names={names} allPlayers={players.map((p) => ({ id: p.id, name: p.name }))} />
      )}

      {match.status === "completed" && (
        <section className="card space-y-3 p-4">
          <h2 className="h2">📰 Match report</h2>
          <div className="rounded-xl bg-cream p-4"><Summary text={match.summary} compact /></div>
          {!locked && <><form action={regenerateSummaryAction}>
            <input type="hidden" name="id" value={match.id} />
            <button className="btn-ghost text-sm">🎲 Write a fresh version</button>
          </form>
          <details>
            <summary className="cursor-pointer text-sm font-semibold text-pitch">Edit the report by hand</summary>
            <ActionForm action={saveSummary} className="mt-2 space-y-2">
              <input type="hidden" name="id" value={match.id} />
              <textarea name="summary" defaultValue={match.summary ?? ""} rows={10} className="input font-mono text-sm" />
              <p className="text-xs muted">First line starting with “# ” is the headline. Lines starting with “- ” become highlight bullets.</p>
              <Submit>Save report</Submit>
            </ActionForm>
          </details></>}
        </section>
      )}

      {!locked && <details className="card p-4">
        <summary className="cursor-pointer font-semibold text-pitch">Match settings</summary>
        <ActionForm action={updateMatchSettings} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:items-end">
          <input type="hidden" name="id" value={match.id} />
          <label><span className="label">Overs</span><input type="number" name="overs" min={1} max={50} defaultValue={match.overs} className="input" /></label>
          <label><span className="label">Players a side</span><input type="number" name="players_per_side" min={2} max={15} defaultValue={match.players_per_side} className="input" /></label>
          <Submit className="btn-ghost">Save</Submit>
        </ActionForm>
        <p className="mt-2 text-xs muted">Handy if you agree to shorten a match because of time or rain.</p>
        <form action={deleteMatch} className="mt-4 border-t border-black/5 pt-4">
          <input type="hidden" name="id" value={match.id} />
          <ConfirmButton message="Delete this match and all its scores?">Delete match</ConfirmButton>
        </form>
      </details>}
    </div>
  );
}
