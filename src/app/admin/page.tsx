import Link from "next/link";
import ActionForm, { Submit } from "@/components/ActionForm";
import { createDay } from "./actions";
import { getPlayers, listDays } from "@/lib/data/queries";
import { fmtDate } from "@/lib/format";
import { dataMode } from "@/lib/data/store";

export const dynamic = "force-dynamic";

function nextSunday() {
  const d = new Date();
  const add = (7 - d.getDay()) % 7;
  d.setDate(d.getDate() + add);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export default async function AdminHome() {
  const [days, players] = await Promise.all([listDays(), getPlayers()]);
  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-semibold uppercase tracking-wider text-gold-700">Umpire desk</p>
        <h1 className="h1">Let&apos;s get scoring 🏏</h1>
        {dataMode() === "local" && <p className="mt-1 text-sm text-amber-700">Running in local mode — data is saved on this computer only.</p>}
      </div>

      <ol className="grid gap-3 sm:grid-cols-3 text-sm">
        <li className="card p-4"><b className="text-pitch">1. Players</b><p className="muted">Add everyone once — they&apos;re reused every Sunday.</p></li>
        <li className="card p-4"><b className="text-pitch">2. Sunday &amp; teams</b><p className="muted">Create the day, split into teams, pick captains.</p></li>
        <li className="card p-4"><b className="text-pitch">3. Matches</b><p className="muted">Add each match, do the toss, score ball by ball.</p></li>
      </ol>

      <section className="card p-4">
        <div className="flex items-center justify-between">
          <h2 className="h2">Players ({players.length})</h2>
          <Link href="/admin/players" className="btn-ghost text-sm">Manage players</Link>
        </div>
        {players.length === 0 && <p className="mt-2 text-sm text-amber-700">Start here — add your group&apos;s players first.</p>}
      </section>

      <section className="card p-4">
        <h2 className="h2">New Sunday</h2>
        <ActionForm action={createDay} className="mt-3 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <label><span className="label">Date</span><input type="date" name="date" defaultValue={nextSunday()} className="input" required /></label>
          <label><span className="label">Ground (optional)</span><input name="venue" className="input" placeholder="e.g. Victoria Park" /></label>
          <Submit>Create day</Submit>
        </ActionForm>
      </section>

      <section className="space-y-2">
        <h2 className="h2">Sundays</h2>
        {days.length === 0 && <p className="muted">None yet.</p>}
        {days.map((d) => (
          <Link key={d.id} href={`/admin/days/${d.id}`} className="card flex items-center justify-between p-4 hover:border-pitch/30">
            <span className="font-semibold">{fmtDate(d.date)}{d.venue ? <span className="font-normal muted"> · {d.venue}</span> : null}</span>
            <span className="text-pitch">Manage →</span>
          </Link>
        ))}
      </section>
    </div>
  );
}
