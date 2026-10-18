import Link from "next/link";
import { notFound } from "next/navigation";
import ActionForm, { ConfirmButton, Submit } from "@/components/ActionForm";
import MatchCard from "@/components/MatchCard";
import PhotoUploader from "@/components/admin/PhotoUploader";
import TeamEditor from "@/components/admin/TeamEditor";
import { createMatch, deleteDay, deletePhoto, deleteTeam, movePhoto, setDayLock, setMvp, updateDay, updatePhoto } from "../../actions";
import { isDayLocked, londonToday } from "@/lib/lock";
import { dayOverview } from "@/lib/dayView";
import { getDayFull, getPlayers } from "@/lib/data/queries";
import { fmtDate } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AdminDay({ params }: { params: { id: string } }) {
  const [data, players] = await Promise.all([getDayFull(params.id), getPlayers()]);
  if (!data) notFound();
  const { day, teams, bundles, photos } = data;
  const names = Object.fromEntries(players.map((p) => [p.id, p.name]));
  const takenBy: Record<string, string> = {};
  for (const t of teams) for (const p of t.player_ids) takenBy[p] = t.id;
  const last = bundles[bundles.length - 1]?.match;
  const locked = isDayLocked(day);
  const isPast = day.date < londonToday();
  const ov = dayOverview(data, names);
  const playedIds = [...new Set([...teams.flatMap((t) => t.player_ids), ...bundles.map((b) => b.match.common_player_id).filter(Boolean) as string[]])];
  const defaultPps = last?.players_per_side ?? (teams.length >= 2 ? Math.min(teams[0].player_ids.length, teams[1].player_ids.length) : 6);

  return (
    <div className="space-y-6">
      <Link href="/admin" className="text-sm font-semibold text-pitch hover:underline">← Umpire desk</Link>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h1 className="h1">{fmtDate(day.date)}</h1>
        <Link href={`/days/${day.id}`} className="btn-ghost text-sm">View public page</Link>
      </div>

      {locked ? (
        <section className="card flex flex-wrap items-center justify-between gap-3 border-amber-300 bg-amber-50 p-4">
          <p className="text-sm">
            <b>🔒 This Sunday is locked</b> so its scores, teams and matches can&apos;t be changed by accident.
            You can still add photos and pick the MVP.
          </p>
          <form action={setDayLock}>
            <input type="hidden" name="id" value={day.id} />
            <input type="hidden" name="locked" value="false" />
            <ConfirmButton className="btn-ghost text-sm" message="Unlock this Sunday so you can correct its scores? Remember to lock it again afterwards.">Unlock for corrections</ConfirmButton>
          </form>
        </section>
      ) : isPast ? (
        <section className="card flex flex-wrap items-center justify-between gap-3 border-amber-300 bg-amber-50 p-4">
          <p className="text-sm"><b>🔓 Unlocked for corrections.</b> Lock it again when you&apos;re done.</p>
          <form action={setDayLock}>
            <input type="hidden" name="id" value={day.id} />
            <input type="hidden" name="locked" value="auto" />
            <button className="btn-primary text-sm">🔒 Lock again</button>
          </form>
        </section>
      ) : null}

      {/* MVP vote */}
      {playedIds.length > 0 && (
        <section className="card p-4">
          <h2 className="h2">🗳️ MVP of the day — players&apos; vote</h2>
          <p className="text-sm muted">Ask everyone who played to nominate a player, then pick the winner here. This is separate from the points-based Player of the Day{ov.potd ? ` (currently ${names[ov.potd.playerId]})` : ""}.</p>
          <ActionForm action={setMvp} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1.4fr_auto] sm:items-end">
            <input type="hidden" name="id" value={day.id} />
            <label><span className="label">Most Valuable Player</span>
              <select name="mvp_player_id" defaultValue={day.mvp_player_id ?? ""} className="input">
                <option value="">— not chosen yet —</option>
                {[...playedIds].sort((a, b) => (names[a] ?? "").localeCompare(names[b] ?? "")).map((p) => <option key={p} value={p}>{names[p]}</option>)}
              </select>
            </label>
            <label><span className="label">Why? (optional)</span><input name="mvp_note" defaultValue={day.mvp_note ?? ""} maxLength={200} className="input" placeholder="e.g. Kept the team going and took that screamer at long-on" /></label>
            <Submit>Save MVP</Submit>
          </ActionForm>
        </section>
      )}

      {/* Matches */}
      <section className="space-y-3">
        <h2 className="h2">Matches</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {bundles.map((b) => <MatchCard key={b.match.id} bundle={b} href={`/admin/matches/${b.match.id}/score`} />)}
        </div>
        {locked ? null : teams.length < 2 ? (
          <p className="card p-4 text-sm text-amber-700">Create at least two teams below before adding a match.</p>
        ) : (
          <div className="card p-4">
            <h3 className="font-semibold">Add match {bundles.length + 1}</h3>
            <ActionForm action={createMatch} className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-5 sm:items-end">
              <input type="hidden" name="match_day_id" value={day.id} />
              <label><span className="label">Team 1</span>
                <select name="team_a_id" className="input" defaultValue={teams[0].id}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </label>
              <label><span className="label">Team 2</span>
                <select name="team_b_id" className="input" defaultValue={teams[1].id}>{teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}</select>
              </label>
              <label><span className="label">Overs</span><input type="number" name="overs" min={1} max={50} defaultValue={last?.overs ?? 6} className="input" /></label>
              <label><span className="label">Players a side</span><input type="number" name="players_per_side" min={2} max={15} defaultValue={defaultPps} className="input" /></label>
              <label className="col-span-2 flex items-center gap-2 text-sm sm:col-span-5">
                <input type="checkbox" name="last_man_stands" defaultChecked={last ? !!last.last_man_stands : true} className="h-4 w-4 accent-pitch" />
                Last batter can bat alone until the end of the innings (no strike change)
              </label>
              <Submit className="btn-primary col-span-2 sm:col-span-1">Add &amp; go to toss</Submit>
            </ActionForm>
          </div>
        )}
      </section>

      {/* Teams */}
      <section className="space-y-3">
        <h2 className="h2">Teams</h2>
        {locked && teams.map((t) => (
          <div key={t.id} className="card p-4 text-sm"><b>{t.name}</b> <span className="muted">· {t.player_ids.map((p) => names[p]).join(", ")}{t.captain_id ? ` · c ${names[t.captain_id]}` : ""}</span></div>
        ))}
        {!locked && teams.map((t) => (
          <details key={t.id} className="card p-4">
            <summary className="cursor-pointer">
              <b>{t.name}</b> <span className="text-sm muted">· {t.player_ids.length} players{t.captain_id ? ` · c ${names[t.captain_id]}` : ""}</span>
            </summary>
            <div className="mt-3"><TeamEditor dayId={day.id} players={players} team={t} takenBy={takenBy} /></div>
            <form action={deleteTeam} className="mt-3">
              <input type="hidden" name="id" value={t.id} />
              <ConfirmButton message={`Delete ${t.name}? Any matches involving this team will be deleted too.`} className="btn-danger text-sm">Delete team</ConfirmButton>
            </form>
          </details>
        ))}
        {!locked && <details className="card p-4" open={teams.length < 2}>
          <summary className="cursor-pointer font-semibold text-pitch">+ New team</summary>
          <div className="mt-3"><TeamEditor dayId={day.id} players={players} takenBy={takenBy} /></div>
        </details>}
      </section>

      {/* Photos */}
      <section className="space-y-3">
        <h2 className="h2">📸 Photos of the day ({photos.length}/4)</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {photos.map((p, i) => (
            <div key={p.id} className="card overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt={p.caption ?? ""} className="aspect-[4/3] w-full object-cover" />
              <div className="space-y-2 p-3">
                <ActionForm action={updatePhoto} className="flex gap-2">
                  <input type="hidden" name="id" value={p.id} />
                  <input name="caption" defaultValue={p.caption ?? ""} maxLength={200} className="input" placeholder="Caption" aria-label="Caption" />
                  <Submit className="btn-ghost">Save</Submit>
                </ActionForm>
                <div className="flex gap-2">
                  {i > 0 && <form action={movePhoto}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="dir" value="up" /><button className="btn-ghost text-sm">↑ Earlier</button></form>}
                  {i < photos.length - 1 && <form action={movePhoto}><input type="hidden" name="id" value={p.id} /><input type="hidden" name="dir" value="down" /><button className="btn-ghost text-sm">↓ Later</button></form>}
                  <form action={deletePhoto} className="ml-auto"><input type="hidden" name="id" value={p.id} /><ConfirmButton message="Delete this photo?" className="btn-danger text-sm">Delete</ConfirmButton></form>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="card p-4"><PhotoUploader dayId={day.id} remaining={4 - photos.length} /></div>
      </section>

      {/* Day details */}
      {!locked && <section className="card p-4">
        <h2 className="h2">Day details</h2>
        <ActionForm action={updateDay} className="mt-3 grid gap-3 sm:grid-cols-2">
          <input type="hidden" name="id" value={day.id} />
          <label><span className="label">Date</span><input type="date" name="date" defaultValue={day.date} className="input" required /></label>
          <label><span className="label">Ground</span><input name="venue" defaultValue={day.venue ?? ""} className="input" /></label>
          <label className="sm:col-span-2"><span className="label">Note for everyone (optional)</span><textarea name="notes" defaultValue={day.notes ?? ""} rows={2} className="input" placeholder="e.g. Great turnout today — 14 players!" /></label>
          <div><Submit>Save details</Submit></div>
        </ActionForm>
        <form action={deleteDay} className="mt-4 border-t border-black/5 pt-4">
          <input type="hidden" name="id" value={day.id} />
          <ConfirmButton message="Delete this whole Sunday, including all matches, scores and photos? This can't be undone.">Delete this Sunday</ConfirmButton>
        </form>
      </section>}
    </div>
  );
}
