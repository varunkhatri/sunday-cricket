"use client";
import Link from "next/link";
import Avatar from "./Avatar";
import { useState } from "react";

export default function PlayerSearch({ players }: { players: { id: string; name: string; nickname?: string | null; photo_url?: string | null; matches: number; runs: number; wickets: number }[] }) {
  const [q, setQ] = useState("");
  const n = q.trim().toLowerCase();
  const list = players.filter((p) => !n || p.name.toLowerCase().includes(n) || (p.nickname ?? "").toLowerCase().includes(n));
  return (
    <div className="space-y-3">
      <input className="input" placeholder="🔍 Search players…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search players" />
      <div className="grid gap-2 sm:grid-cols-2">
        {list.map((p) => (
          <Link key={p.id} href={`/players/${p.id}`} className="card flex items-center gap-3 p-3 transition hover:border-pitch/30">
            <Avatar name={p.name} url={p.photo_url} size={44} />
            <span className="min-w-0">
              <span className="block truncate font-semibold">{p.name}{p.nickname ? <span className="font-normal muted"> “{p.nickname}”</span> : null}</span>
              <span className="text-sm muted tabular-nums">{p.matches} match{p.matches === 1 ? "" : "es"} · {p.runs} runs · {p.wickets} wkts</span>
            </span>
          </Link>
        ))}
        {!list.length && <p className="muted">No one by that name.</p>}
      </div>
    </div>
  );
}
