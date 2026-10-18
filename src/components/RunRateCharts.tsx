"use client";
import { useState } from "react";
import type { InningsSeries } from "@/lib/cricket/runrate";

// Validated categorical pair (light surface, CVD-safe): batting first = blue, chasing = orange
const SERIES_COLORS = ["#2a62c9", "#d9771e"];
const INK = "#18211d";
const MUTED = "rgba(24,33,29,.55)";
const GRID = "rgba(24,33,29,.08)";

// sized for a phone screen so the text stays readable
const W = 380;
const H = 210;
const M = { top: 22, right: 12, bottom: 32, left: 34 };
const PW = W - M.left - M.right;
const PH = H - M.top - M.bottom;

function niceMax(v: number) {
  const steps = [8, 12, 16, 20, 24, 28, 32, 36, 40];
  return steps.find((s) => s >= v) ?? Math.ceil(v / 4) * 4;
}

function Axes({ overs, yMax, label }: { overs: number; yMax: number; label: string }) {
  const ticks = [0, yMax / 4, yMax / 2, (3 * yMax) / 4, yMax];
  const step = overs > 12 ? Math.ceil(overs / 10) : 1;
  const x = (i: number) => M.left + ((i + 0.5) * PW) / overs;
  return (
    <g fontSize="11" fill={MUTED}>
      {ticks.map((t) => {
        const y = M.top + PH - (t / yMax) * PH;
        return (
          <g key={t}>
            <line x1={M.left} x2={W - M.right} y1={y} y2={y} stroke={GRID} />
            <text x={M.left - 6} y={y + 4} textAnchor="end">{t}</text>
          </g>
        );
      })}
      {Array.from({ length: overs }, (_, i) => i).filter((i) => (i + 1) % step === 0 || i === 0).map((i) => (
        <text key={i} x={x(i)} y={H - M.bottom + 15} textAnchor="middle">{i + 1}</text>
      ))}
      <text x={M.left + PW / 2} y={H - 4} textAnchor="middle">Over</text>
      <text x={9} y={M.top + PH / 2} textAnchor="middle" transform={`rotate(-90 9 ${M.top + PH / 2})`}>{label}</text>
    </g>
  );
}

function Tooltip({ x, lines }: { x: number; lines: string[] }) {
  const w = 168;
  const left = Math.min(Math.max(x - w / 2, 2), W - w - 2);
  return (
    <g pointerEvents="none">
      <rect x={left} y={2} width={w} height={14 + lines.length * 15} rx={8} fill="#fff" stroke="rgba(0,0,0,.12)" />
      {lines.map((l, i) => (
        <text key={i} x={left + 10} y={18 + i * 15} fontSize="11.5" fill={i === 0 ? INK : MUTED} fontWeight={i === 0 ? 700 : 500}>{l}</text>
      ))}
    </g>
  );
}

/** One innings: bars = runs in each over, line = run rate after each over, red W = wickets. */
function InningsChart({ s, color, overs, yMax }: { s: InningsSeries; color: string; overs: number; yMax: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const bw = Math.min(28, Math.max(4, PW / overs - 4));
  const x = (i: number) => M.left + ((i + 0.5) * PW) / overs;
  const y = (v: number) => M.top + PH - (Math.min(v, yMax) / yMax) * PH;
  const line = s.points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.runRate)}`).join(" ");
  const hp = hover != null ? s.points[hover] : null;
  return (
    <figure className="card p-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <span className="font-display font-bold">{s.teamName}</span>
        <span className="flex items-center gap-3 text-xs muted">
          <span className="flex items-center gap-1"><span className="inline-block h-3 w-3 rounded-sm" style={{ background: color }} />Runs in over</span>
          <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4" style={{ background: INK }} />Run rate</span>
          <span className="flex items-center gap-1"><span className="font-bold text-ball">W</span>Wicket</span>
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto mt-1 h-auto w-full max-w-2xl" role="img" aria-label={`${s.teamName} runs per over and run rate`} onMouseLeave={() => setHover(null)}>
        <Axes overs={overs} yMax={yMax} label="Runs per over" />
        {s.points.map((p, i) => {
          const top = y(p.runs);
          const h = M.top + PH - top;
          return (
            <g key={i}>
              {h > 0 && (
                <path
                  d={`M${x(i) - bw / 2},${M.top + PH} V${top + Math.min(4, h)} Q${x(i) - bw / 2},${top} ${x(i) - bw / 2 + Math.min(4, bw / 2)},${top} H${x(i) + bw / 2 - Math.min(4, bw / 2)} Q${x(i) + bw / 2},${top} ${x(i) + bw / 2},${top + Math.min(4, h)} V${M.top + PH} Z`}
                  fill={color} opacity={hover == null || hover === i ? (p.partial ? 0.5 : 0.9) : 0.35}
                />
              )}
              {p.wickets > 0 && (
                <text x={x(i)} y={top - 5} textAnchor="middle" fontSize="11" fontWeight="800" fill="#b3261e">{"W".repeat(Math.min(p.wickets, 3))}</text>
              )}
            </g>
          );
        })}
        <path d={line} fill="none" stroke={INK} strokeWidth={2} strokeLinejoin="round" />
        {s.points.map((p, i) => (
          <circle key={i} cx={x(i)} cy={y(p.runRate)} r={hover === i ? 5 : 3.5} fill="#fff" stroke={INK} strokeWidth={2} />
        ))}
        {s.points.map((_, i) => (
          <rect key={i} x={M.left + (i * PW) / overs} y={M.top} width={PW / overs} height={PH} fill="transparent"
            onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} onClick={() => setHover(i)} />
        ))}
        {hp && (
          <Tooltip x={x(hover!)} lines={[
            `Over ${hp.over}${hp.partial ? " (in progress)" : ""}`,
            `${hp.runs} run${hp.runs === 1 ? "" : "s"}${hp.wickets ? ` · ${hp.wickets} wkt` : ""} · score ${hp.totalRuns}`,
            `Run rate ${hp.runRate.toFixed(2)}`,
          ]} />
        )}
      </svg>
    </figure>
  );
}

/** Both innings on one chart: run rate after each over. */
function ComparisonChart({ series, overs, yMax }: { series: InningsSeries[]; overs: number; yMax: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const x = (i: number) => M.left + ((i + 0.5) * PW) / overs;
  const y = (v: number) => M.top + PH - (Math.min(v, yMax) / yMax) * PH;
  const maxLen = Math.max(...series.map((s) => s.points.length));
  return (
    <figure className="card p-3">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2 px-1">
        <span className="font-display font-bold">Run rate — both teams</span>
        <span className="flex items-center gap-3 text-xs muted">
          {series.map((s, k) => (
            <span key={s.teamId} className="flex items-center gap-1">
              <span className="inline-block h-1 w-4 rounded" style={{ background: SERIES_COLORS[k] }} />{s.teamName}
            </span>
          ))}
        </span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mx-auto mt-1 h-auto w-full max-w-2xl" role="img" aria-label="Run rate of both teams by over" onMouseLeave={() => setHover(null)}>
        <Axes overs={overs} yMax={yMax} label="Run rate" />
        {hover != null && <line x1={x(hover)} x2={x(hover)} y1={M.top} y2={M.top + PH} stroke="rgba(24,33,29,.25)" strokeDasharray="3 3" />}
        {series.map((s, k) => (
          <g key={s.teamId}>
            <path d={s.points.map((p, i) => `${i ? "L" : "M"}${x(i)},${y(p.runRate)}`).join(" ")} fill="none" stroke={SERIES_COLORS[k]} strokeWidth={2} strokeLinejoin="round" />
            {s.points.map((p, i) => (
              <circle key={i} cx={x(i)} cy={y(p.runRate)} r={hover === i ? 5 : 3.5} fill={SERIES_COLORS[k]} stroke="#fff" strokeWidth={2} />
            ))}
            {s.points.length > 0 && (() => {
              const last = s.points[s.points.length - 1];
              const lx = x(s.points.length - 1);
              return (
                <text x={lx + 70 > W ? lx - 8 : lx + 8} y={y(last.runRate) + (k === 0 ? -9 : 16)} fontSize="11" fontWeight="700" fill={INK}
                  textAnchor={lx + 70 > W ? "end" : "start"}>
                  {s.teamName} {last.runRate.toFixed(2)}
                </text>
              );
            })()}
          </g>
        ))}
        {Array.from({ length: maxLen }, (_, i) => (
          <rect key={i} x={M.left + (i * PW) / overs} y={M.top} width={PW / overs} height={PH} fill="transparent"
            onMouseEnter={() => setHover(i)} onTouchStart={() => setHover(i)} onClick={() => setHover(i)} />
        ))}
        {hover != null && (
          <Tooltip x={x(hover)} lines={[
            `After over ${hover + 1}`,
            ...series.map((s) => {
              const p = s.points[hover];
              return p ? `${s.teamName}: ${p.runRate.toFixed(2)} (${p.totalRuns})` : `${s.teamName}: –`;
            }),
          ]} />
        )}
      </svg>
    </figure>
  );
}

export default function RunRateCharts({ series, overs }: { series: InningsSeries[]; overs: number }) {
  const withData = series.filter((s) => s.points.length > 0);
  if (!withData.length) return null;
  const n = Math.max(overs, ...withData.map((s) => s.points.length));
  const peak = Math.max(...withData.flatMap((s) => s.points.flatMap((p) => [p.runs, p.runRate])), 6);
  const yMax = niceMax(peak);
  const rrMax = niceMax(Math.max(...withData.flatMap((s) => s.points.map((p) => p.runRate)), 6));
  return (
    <section className="space-y-3">
      <h2 className="h2">📈 Run rate</h2>
      {withData.length > 1 && <ComparisonChart series={withData} overs={n} yMax={rrMax} />}
      <div className="grid gap-3 md:grid-cols-2">
        {withData.map((s) => (
          <InningsChart key={s.teamId + s.inningsNo} s={s} color={SERIES_COLORS[s.inningsNo - 1]} overs={n} yMax={yMax} />
        ))}
      </div>
      <p className="text-xs muted">Tap or hover an over for details. The exact numbers are in each scorecard&apos;s “Over by over” section.</p>
    </section>
  );
}
