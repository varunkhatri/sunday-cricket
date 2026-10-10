import Link from "next/link";
import ActionForm, { Submit } from "@/components/ActionForm";
import { addPlayers, updatePlayer } from "../actions";
import { getPlayers } from "@/lib/data/queries";

export const dynamic = "force-dynamic";

export default async function AdminPlayers() {
  const players = await getPlayers();
  return (
    <div className="space-y-5">
      <Link href="/admin" className="text-sm font-semibold text-pitch hover:underline">← Umpire desk</Link>
      <h1 className="h1">Players</h1>
      <section className="card p-4">
        <h2 className="h2">Add players</h2>
        <p className="text-sm muted">One name per line (or separated by commas). Paste the whole group in one go.</p>
        <ActionForm action={addPlayers} resetOnSuccess className="mt-3 space-y-3">
          <textarea name="names" rows={4} className="input" placeholder={"Raj Patel\nSam Khan\nArjun"} />
          <Submit>Add</Submit>
        </ActionForm>
      </section>
      <section className="space-y-2">
        <h2 className="h2">Roster ({players.length})</h2>
        {players.map((p) => (
          <ActionForm key={p.id} action={updatePlayer} className="card grid grid-cols-[1fr_1fr_auto] items-center gap-2 p-3">
            <input type="hidden" name="id" value={p.id} />
            <input name="name" defaultValue={p.name} className="input" aria-label="Name" />
            <input name="nickname" defaultValue={p.nickname ?? ""} className="input" placeholder="Nickname" aria-label="Nickname" />
            <Submit className="btn-ghost">Save</Submit>
          </ActionForm>
        ))}
      </section>
    </div>
  );
}
