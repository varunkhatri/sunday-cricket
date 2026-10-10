"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import type { PlayerAgg } from "@/lib/cricket/stats";

type Col = { key: string; label: string; get: (a: PlayerAgg) => number | null; fmt?: (a: PlayerAgg) => string; asc?: boolean; title?: string };

const f = (n: number | null, d = 1) => (n == null || !isFinite(n) ? "–" : n.toFixed(d));

const TABS: Record<string, { label: string; cols: Col[]; filter: (a: PlayerAgg) => boolean; sort: string }> = {
  overall: {
    label: "🏆 Overall",
    sort: "points",
    filter: (a) => a.matches > 0,
    cols: [
      { key: "points", label: "Pts", get: (a) => a.points, title: "MVP points" },
      { key: "matches", label: "M", get: (a) => a.matches },
      { key: "wins", label: "Won", get: (a) => a.wins },
      { key: "runs", label: "Runs", get: (a) => a.runs },
      { key: "wickets", label: "Wkts", get: (a) => a.wickets },
      { key: "catches", label: "Ct", get: (a) => a.catches },
    ],
  },
  batting: {
    label: "🏏 Batting",
    sort: "runs",
    filter: (a) => a.innings > 0,
    cols: [
      { key: "runs", label: "Runs", get: (a) => a.runs },
      { key: "innings", label: "Inn", get: (a) => a.innings },
      { key: "highest", label: "HS", get: (a) => a.highest, fmt: (a) => `${a.highest}${a.highestNotOut ? "*" : ""}` },
      { key: "average", label: "Avg", get: (a) => a.average, fmt: (a) => f(a.average) },
      { key: "sr", label: "SR", get: (a) => (a.balls ? a.strikeRate : null), fmt: (a) => f(a.balls ? a.strikeRate : null) },
      { key: "fours", label: "4s", get: (a) => a.fours },
      { key: "sixes", label: "6s", get: (a) => a.sixes },
      { key: "thirties", label: "30s", get: (a) => a.thirties },
      { key: "fifties", label: "50s", get: (a) => a.fifties },
      { key: "ducks", label: "🦆", get: (a) => a.ducks, title: "Ducks" },
    ],
  },
  bowling: {
    label: "🎯 Bowling",
    sort: "wickets",
    filter: (a) => a.bowlBalls > 0,
    cols: [
      { key: "wickets", label: "Wkts", get: (a) => a.wickets },
      { key: "overs", label: "Ov", get: (a) => a.bowlBalls, fmt: (a) => `${Math.floor(a.bowlBalls / 6)}.${a.bowlBalls % 6}` },
      { key: "runsC", label: "Runs", get: (a) => a.bowlRuns, asc: true },
      { key: "econ", label: "Econ", get: (a) => a.economy, fmt: (a) => f(a.economy, 2), asc: true },
      { key: "bavg", label: "Avg", get: (a) => a.bowlAverage, fmt: (a) => f(a.bowlAverage), asc: true },
      { key: "best", label: "Best", get: (a) => a.bestW * 1000 - a.bestR, fmt: (a) => `${a.bestW}/${a.bestR}` },
      { key: "maidens", label: "Mdn", get: (a) => a.maidens },
      { key: "threeFors", label: "3w", get: (a) => a.threeFors },
    ],
  },
  fielding: {
    label: "🙌 Fielding",
    sort: "dismissals",
    filter: (a) => a.catches + a.runOuts + a.stumpings > 0,
    cols: [
      { key: "dismissals", label: "Total", get: (a) => a.catches + a.runOuts + a.stumpings },
      { key: "catches", label: "Catches", get: (a) => a.catches },
      { key: "runOuts", label: "Run outs", get: (a) => a.runOuts },
      { key: "stumpings", label: "Stumpings", get: (a) => a.stumpings },
    ],
  },
};

export default function Leaderboard({ rows, names }: { rows: PlayerAgg[]; names: Record<string, string> }) {
  const [tab, setTab] = useState<keyof typeof TABS>("overall");
  const [q, setQ] = useState("");
  const [minInn, setMinInn] = useState(0);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null);
  const t = TABS[tab];
  const sortKey = sort?.key ?? t.sort;
  const col = t.cols.find((c) => c.key === sortKey) ?? t.cols[0];
  const dir = sort?.dir ?? (col.asc ? 1 : -1);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows
      .filter(t.filter)
      .filter((a) => !needle || (names[a.playerId] ?? "").toLowerCase().includes(needle))
      .filter((a) => (tab === "bowling" ? a.bowlInnings : tab === "batting" ? a.innings : a.matches) >= minInn)
      .sort((a, b) => {
        const va = col.get(a), vb = col.get(b);
        if (va == null && vb == null) return 0;
        if (va == null) return 1;
        if (vb == null) return -1;
        return (va - vb) * dir || (names[a.playerId] ?? "").localeCompare(names[b.playerId] ?? "");
      });
  }, [rows, t, q, minInn, col, dir, names, tab]);

  return (
    <div className="space-y-3">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-white p-1 shadow-card [scrollbar-width:none]">
        {Object.entries(TABS).map(([k, v]) => (
          <button key={k} onClick={() => { setTab(k as keyof typeof TABS); setSort(null); }}
            className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-semibold ${tab === k ? "bg-pitch text-white" : "text-ink/70 hover:bg-pitch-50"}`}>
            {v.label}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        <input className="input max-w-xs flex-1" placeholder="🔍 Search player…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search player" />
        <label className="flex items-center gap-2 text-sm">
          <span className="muted">Min {tab === "bowling" ? "spells" : tab === "batting" ? "innings" : "matches"}</span>
          <select className="input w-20" value={minInn} onChange={(e) => setMinInn(Number(e.target.value))}>
            {[0, 1, 2, 3, 5, 8, 10].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <div className="card overflow-x-auto">
        <table className="tbl">
          <thead>
            <tr>
              <th className="w-8">#</th>
              <th>Player</th>
              {t.cols.map((c) => (
                <th key={c.key} className="num">
                  <button title={c.title} className={`font-semibold ${c.key === sortKey ? "text-pitch" : ""}`}
                    onClick={() => setSort({ key: c.key, dir: c.key === sortKey ? (dir === 1 ? -1 : 1) : c.asc ? 1 : -1 })}>
                    {c.label}{c.key === sortKey ? (dir === -1 ? " ↓" : " ↑") : ""}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((a, i) => (
              <tr key={a.playerId} className={i === 0 && !q ? "bg-gold-100/50" : ""}>
                <td className="muted">{i === 0 && !q ? "🥇" : i === 1 && !q ? "🥈" : i === 2 && !q ? "🥉" : i + 1}</td>
                <td className="font-semibold"><Link href={`/players/${a.playerId}`} className="hover:underline">{names[a.playerId] ?? "?"}</Link></td>
                {t.cols.map((c) => <td key={c.key} className={`num ${c.key === sortKey ? "font-bold" : ""}`}>{c.fmt ? c.fmt(a) : c.get(a) ?? "–"}</td>)}
              </tr>
            ))}
            {!list.length && <tr><td colSpan={t.cols.length + 2} className="py-6 text-center muted">No players match.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
