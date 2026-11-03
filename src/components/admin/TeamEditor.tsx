"use client";
import { useState } from "react";
import ActionForm, { Submit } from "@/components/ActionForm";
import { saveTeam } from "@/app/admin/actions";
import type { DayTeam, Player } from "@/lib/types";

export default function TeamEditor({ dayId, players, team, alsoIn }: {
  dayId: string; players: Player[]; team?: DayTeam;
  /** names of the day's other teams each player is already in (they can still be picked) */
  alsoIn: Record<string, { id: string; name: string }[]>;
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
            const others = (alsoIn[p.id] ?? []).filter((t) => t.id !== team?.id);
            const on = sel.includes(p.id);
            return (
              <label key={p.id} className={`flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-sm ${on ? "border-pitch bg-pitch-50 font-semibold" : "border-black/10"}`}>
                <input type="checkbox" name="player_ids" value={p.id} checked={on} onChange={() => toggle(p.id)} className="accent-pitch" />
                <span className="min-w-0">
                  <span className="block truncate">{p.name}</span>
                  {others.length > 0 && <span className="block truncate text-xs font-normal muted">also in {others.map((t) => t.name).join(", ")}</span>}
                </span>
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
