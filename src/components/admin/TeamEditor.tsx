"use client";
import { useState } from "react";
import ActionForm, { Submit } from "@/components/ActionForm";
import { saveTeam } from "@/app/admin/actions";
import type { DayTeam, Player } from "@/lib/types";

export default function TeamEditor({ dayId, players, team, takenBy }: {
  dayId: string; players: Player[]; team?: DayTeam; takenBy: Record<string, string>;
}) {
  const [sel, setSel] = useState<string[]>(team?.player_ids ?? []);
  const [captain, setCaptain] = useState(team?.captain_id ?? "");
  const toggle = (id: string) => setSel((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  return (
    <ActionForm action={saveTeam} resetOnSuccess={!team} className="space-y-3">
      <input type="hidden" name="id" value={team?.id ?? ""} />
      <input type="hidden" name="match_day_id" value={dayId} />
      <label className="block"><span className="label">Team name</span><input name="name" defaultValue={team?.name ?? ""} className="input" placeholder="e.g. Thunder" required /></label>
      <div>
        <span className="label">Players ({sel.length} picked)</span>
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
          {players.map((p) => {
            const taken = takenBy[p.id] && takenBy[p.id] !== team?.id;
            const on = sel.includes(p.id);
            return (
              <label key={p.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm ${on ? "border-pitch bg-pitch-50 font-semibold" : "border-black/10"} ${taken ? "opacity-40" : ""}`}>
                <input type="checkbox" name="player_ids" value={p.id} checked={on} disabled={!!taken} onChange={() => toggle(p.id)} className="accent-pitch" />
                <span className="truncate">{p.name}</span>
              </label>
            );
          })}
        </div>
        {players.length === 0 && <p className="text-sm text-amber-700">Add players first (Umpire desk → Manage players).</p>}
      </div>
      <label className="block">
        <span className="label">Captain</span>
        <select name="captain_id" className="input" value={captain} onChange={(e) => setCaptain(e.target.value)}>
          <option value="">— choose —</option>
          {players.filter((p) => sel.includes(p.id)).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </label>
      <Submit>{team ? "Save team" : "Create team"}</Submit>
    </ActionForm>
  );
}
