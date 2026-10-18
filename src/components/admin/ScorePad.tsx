"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Ball, ExtraType, MatchBundle, WicketType } from "@/lib/types";
import { ballSymbol, computeMatch, teamName } from "@/lib/cricket/engine";
import { buildScorecard } from "@/lib/cricket/scorecard";
import { matchSquad } from "@/lib/cricket/stats";
import { BallDot } from "@/components/ScorecardView";

type Names = Record<string, string>;
type SheetKind = null | "wide" | "no_ball" | "bye" | "leg_bye" | "wicket" | "retire" | "overs" | "player" | "common";

const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : "10000000-1000-4000-8000-100000000000".replace(/[018]/g, (c) =>
        (+c ^ (Math.random() * 16) >> (+c / 4)).toString(16),
      );

const WICKETS: { t: WicketType; label: string }[] = [
  { t: "bowled", label: "Bowled" },
  { t: "caught", label: "Caught" },
  { t: "lbw", label: "LBW" },
  { t: "run_out", label: "Run out" },
  { t: "stumped", label: "Stumped" },
  { t: "hit_wicket", label: "Hit wicket" },
  { t: "out_of_box", label: "Out of box" },
];

export default function ScorePad({ initial, names: initialNames, allPlayers }: {
  initial: MatchBundle; names: Names; allPlayers: { id: string; name: string }[];
}) {
  const router = useRouter();
  const qKey = `sc-queue-${initial.match.id}`;
  const [bundle, setBundle] = useState(initial);
  const [queue, setQueueState] = useState<Ball[]>([]);
  const queueRef = useRef<Ball[]>([]);
  const setQueue = useCallback((fn: Ball[] | ((q: Ball[]) => Ball[])) => {
    queueRef.current = typeof fn === "function" ? fn(queueRef.current) : fn;
    setQueueState(queueRef.current);
  }, []);
  const [busy, setBusy] = useState(false);
  const [offline, setOffline] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [override, setOverride] = useState<{ striker?: string | null; nonStriker?: string | null; bowler?: string | null }>({});
  const [sheet, setSheet] = useState<SheetKind>(null);
  const flushing = useRef(false);
  const [names, setNames] = useState(initialNames);
  useEffect(() => setNames((n) => ({ ...n, ...initialNames })), [initialNames]);

  // restore unsent balls (e.g. phone lost signal and the page was reloaded)
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(qKey) ?? "[]") as Ball[];
      if (saved.length) setQueue(saved.filter((b) => !initial.balls.some((x) => x.id === b.id)));
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // pick up fresh server data (e.g. 2nd innings created) when nothing is waiting to be sent
  useEffect(() => {
    if (!queueRef.current.length) setBundle(initial);
  }, [initial]);
  useEffect(() => {
    try {
      if (queue.length) localStorage.setItem(qKey, JSON.stringify(queue));
      else localStorage.removeItem(qKey);
    } catch {}
  }, [queue, qKey]);

  const post = useCallback(
    async (body: object) => {
      const res = await fetch(`/api/matches/${initial.match.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json().catch(() => ({}));
      if (json.bundle) setBundle(json.bundle);
      if (json.names) setNames(json.names);
      if (res.status === 401) throw Object.assign(new Error("Your login has expired — please log in again"), { fatal: true });
      if (!res.ok) throw Object.assign(new Error(json.error ?? "Error"), { fatal: true, conflict: res.status === 409 });
      return json;
    },
    [initial.match.id],
  );

  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      for (;;) {
        const next = queueRef.current[0];
        if (!next) break;
        try {
          await post({ action: "add", ball: next });
          setOffline(false);
          setQueue((q) => q.filter((b) => b.id !== next.id));
        } catch (e) {
          const err = e as Error & { fatal?: boolean; conflict?: boolean };
          if (err.fatal) {
            setQueue([]);
            setMsg(err.conflict ? "Scores were out of sync, so I refreshed them. Please check the last ball and re-enter it if needed." : err.message);
          } else {
            setOffline(true);
            setTimeout(() => flush(), 4000);
          }
          break;
        }
      }
    } finally {
      flushing.current = false;
      router.refresh();
    }
  }, [post, router, setQueue]);

  useEffect(() => {
    if (queue.length && !flushing.current) flush();
  }, [queue.length, flush]);

  /* ---------- derived state ---------- */
  const view: MatchBundle = useMemo(() => ({ ...bundle, balls: [...bundle.balls, ...queue] }), [bundle, queue]);
  const st = computeMatch(view);
  const inn = bundle.innings[bundle.innings.length - 1];
  const cur = inn?.innings_no === 2 ? st.second : st.first;
  const innBalls = view.balls.filter((b) => b.innings_id === inn?.id);
  const sc = useMemo(() => buildScorecard(innBalls), [innBalls]);
  const battingTeam = inn?.batting_team_id === bundle.teamA.id ? bundle.teamA : bundle.teamB;
  const bowlingTeam = inn?.batting_team_id === bundle.teamA.id ? bundle.teamB : bundle.teamA;

  const striker = override.striker !== undefined ? override.striker : cur?.striker ?? null;
  const nonStriker = override.nonStriker !== undefined ? override.nonStriker : cur?.nonStriker ?? null;
  const autoBowler = cur && innBalls.length && !cur.overJustCompleted ? cur.lastBowler : null;
  const bowler = override.bowler !== undefined ? override.bowler : autoBowler;
  const prevOverBowler = cur?.overJustCompleted ? cur.lastBowler : null;

  const battingSquad = matchSquad(bundle, battingTeam.id);
  const bowlingSquad = matchSquad(bundle, bowlingTeam.id);
  const common = bundle.match.common_player_id ?? null;
  const dismissed = cur?.dismissed ?? new Set<string>();
  const available = battingSquad.filter((p) => !dismissed.has(p) && p !== striker && p !== nonStriker);
  const retiredIds = new Set(sc.batting.filter((r) => r.retired).map((r) => r.playerId));
  const nm = (id: string | null | undefined) => (id ? names[id] ?? "?" : "—");
  const bat = (id: string | null) => sc.batting.find((r) => r.playerId === id);
  const bowlRow = sc.bowling.find((r) => r.playerId === bowler);

  const inPlay = st.phase === "first" || st.phase === "second";
  const needNonStriker = !nonStriker && available.length > 0;
  const ready = inPlay && !!striker && !!bowler && !needNonStriker && !sheet;
  const settled = queue.length === 0 && !busy;
  const noBattersLeft = inPlay && !striker && available.length === 0;

  /* ---------- actions ---------- */
  function record(p: { runs_bat?: number; extra_type?: ExtraType | null; extra_runs?: number; wicket_type?: WicketType | null; dismissed_id?: string | null; fielder_id?: string | null; non_delivery?: boolean }) {
    // retiring a batter isn't a delivery, so it doesn't need a bowler to have been picked
    const bowlerId = p.non_delivery ? bowler ?? cur?.lastBowler ?? bowlingSquad[0] : bowler;
    if (!inn || !striker || !bowlerId) return;
    const lastSeq = innBalls[innBalls.length - 1]?.seq ?? 0;
    const b: Ball = {
      id: uuid(),
      innings_id: inn.id,
      match_id: bundle.match.id,
      seq: lastSeq + 1,
      striker_id: striker,
      non_striker_id: nonStriker,
      bowler_id: bowlerId,
      runs_bat: p.runs_bat ?? 0,
      extra_type: p.extra_type ?? null,
      extra_runs: p.extra_runs ?? 0,
      wicket_type: p.wicket_type ?? null,
      dismissed_id: p.wicket_type ? p.dismissed_id ?? striker : null,
      fielder_id: p.fielder_id ?? null,
      non_delivery: !!p.non_delivery,
      created_at: new Date().toISOString(),
    };
    setMsg(null);
    setSheet(null);
    // keep a freshly-picked bowler when only a batter retires
    setOverride((o) => (p.non_delivery && o.bowler ? { bowler: o.bowler } : {}));
    setQueue((q) => [...q, b]);
    if (navigator.vibrate) navigator.vibrate(15);
  }

  async function undo() {
    setMsg(null);
    setOverride({});
    if (queue.length) return setQueue((q) => q.slice(0, -1));
    setBusy(true);
    try {
      await post({ action: "undo" });
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }
  /** One-off admin actions that change the match itself (not a ball). */
  async function matchAction(body: object, okMsg?: string) {
    setBusy(true);
    setMsg(null);
    try {
      await post(body);
      setSheet(null);
      if (okMsg) setNotice(okMsg);
      return true;
    } catch (e) {
      setMsg((e as Error).message);
      return false;
    } finally {
      setBusy(false);
      router.refresh();
    }
  }
  const [notice, setNotice] = useState<string | null>(null);
  useEffect(() => {
    if (!notice) return;
    const t = setTimeout(() => setNotice(null), 3500);
    return () => clearTimeout(t);
  }, [notice]);

  async function endInnings() {
    if (!confirm("End this innings now? (e.g. ran out of time or players)")) return;
    setBusy(true);
    try {
      await post({ action: "end_innings" });
      setOverride({});
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
      router.refresh();
    }
  }

  /* ---------- UI ---------- */
  const PlayerSelect = ({ label, value, options, onChange, hint }: { label: string; value: string | null; options: string[]; onChange: (v: string) => void; hint?: (id: string) => string }) => (
    <label className="block">
      <span className="label">{label}</span>
      <select className="input border-gold bg-gold-100/40 font-semibold" value={value ?? ""} onChange={(e) => onChange(e.target.value)}>
        <option value="">— select —</option>
        {options.map((id) => <option key={id} value={id}>{nm(id)}{hint ? hint(id) : ""}</option>)}
      </select>
    </label>
  );

  if (!inn || !cur) return null;

  const ballsLeft = bundle.match.overs * 6 - cur.legalBalls;
  const rrr = st.phase === "second" && st.target && ballsLeft > 0 ? ((st.target - cur.runs) / ballsLeft) * 6 : null;

  return (
    <div className="space-y-4">
      {/* Scoreboard */}
      <section className="overflow-hidden rounded-2xl bg-pitch text-white shadow-card">
        <div className="flex items-start justify-between gap-3 p-4">
          <div>
            <p className="text-sm text-white/70">{battingTeam.name} · {inn.innings_no === 1 ? "1st" : "2nd"} innings</p>
            <p className="font-display text-5xl font-extrabold tabular-nums leading-none">{cur.runs}/{cur.wickets}</p>
            <p className="mt-1 tabular-nums text-white/80">{cur.overs} / {bundle.match.overs} ov · RR {cur.runRate.toFixed(2)}</p>
          </div>
          <div className="text-right text-sm">
            {queue.length > 0 && <p className={`chip ${offline ? "bg-red-500" : "bg-white/20"} text-white`}>{offline ? `⚠ Offline · ${queue.length} unsent` : "Saving…"}</p>}
            {st.phase === "second" && st.target && (
              <p className="mt-2 rounded-lg bg-gold px-2 py-1 font-bold text-pitch-900">
                Need {Math.max(0, st.target - cur.runs)} off {ballsLeft}
              </p>
            )}
            {rrr != null && <p className="mt-1 text-white/70">Req RR {rrr.toFixed(2)}</p>}
            {inn.innings_no === 2 && st.first && <p className="mt-1 text-white/70">{teamName(bundle, st.firstInnings!.batting_team_id)} {st.first.runs}/{st.first.wickets}</p>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 bg-pitch-900/50 px-4 py-2 text-sm">
          <span className="text-white/60">This over:</span>
          {cur.currentOver.length ? cur.currentOver.map((b) => <BallDot key={b.id} s={ballSymbol(b)} />) : <span className="text-white/50">—</span>}
        </div>
      </section>

      {msg && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm font-medium text-red-700">{msg}</p>}

      {st.phase === "done" && st.result && (
        <section className="card border-gold-300 bg-gold-100/60 p-4 text-center">
          <p className="text-4xl">🏆</p>
          <p className="font-display text-xl font-extrabold text-pitch-900">{st.result.text}</p>
          <p className="mt-1 text-sm muted">The match report has been written automatically.</p>
          <div className="mt-3 flex flex-wrap justify-center gap-2">
            <Link href={`/matches/${bundle.match.id}`} className="btn-primary">See report &amp; scorecard</Link>
            <Link href={`/admin/days/${bundle.match.match_day_id}`} className="btn-ghost">Back to the day</Link>
          </div>
        </section>
      )}
      {st.phase === "break" && <p className="card p-4 text-center font-semibold">Innings complete — setting up the chase…</p>}

      {inPlay && (
        <>
          {/* Crease */}
          <section className="card divide-y divide-black/5">
            {[{ id: striker, on: true }, { id: nonStriker, on: false }].map(({ id, on }) => (
              <div key={on ? "s" : "n"} className="flex items-center justify-between gap-2 p-3">
                {id ? (
                  <>
                    <span className="font-semibold">{on ? "🏏 " : ""}{nm(id)}{on && <span className="text-ball"> *</span>}</span>
                    <span className="tabular-nums muted">{bat(id)?.runs ?? 0} ({bat(id)?.balls ?? 0})</span>
                  </>
                ) : (
                  <div className="w-full">
                    {available.length ? (
                      <PlayerSelect label={on ? "Next batter (on strike)" : "Next batter (non-striker)"} value={null} options={available}
                        hint={(pid) => (retiredIds.has(pid) ? " (retired – can come back)" : pid === common ? " (common player)" : "")}
                        onChange={(v) => setOverride((o) => ({ ...o, [on ? "striker" : "nonStriker"]: v || null }))} />
                    ) : <p className="text-sm muted">No batters left.</p>}
                  </div>
                )}
              </div>
            ))}
            <div className="flex items-center justify-between gap-2 p-3">
              {bowler ? (
                <>
                  <span className="font-semibold">🎯 {nm(bowler)}</span>
                  <span className="flex items-center gap-3">
                    <span className="tabular-nums muted">{bowlRow ? `${bowlRow.overs}-${bowlRow.maidens}-${bowlRow.runs}-${bowlRow.wickets}` : "0.0-0-0-0"}</span>
                    <button className="text-xs font-semibold text-pitch underline" onClick={() => setOverride((o) => ({ ...o, bowler: null }))}>change</button>
                  </span>
                </>
              ) : (
                <div className="w-full">
                  <PlayerSelect label={cur.legalBalls ? "Bowler for the next over" : "Opening bowler"} value={null}
                    options={[...bowlingSquad.filter((p) => p !== prevOverBowler), ...(prevOverBowler ? [prevOverBowler] : [])].filter((p) => p !== striker && p !== nonStriker)}
                    hint={(id) => (id === prevOverBowler ? " (bowled last over)" : id === common ? " (common player)" : "")}
                    onChange={(v) => setOverride((o) => ({ ...o, bowler: v || null }))} />
                </div>
              )}
            </div>
            {striker && nonStriker && (
              <div className="p-2 text-right">
                <button className="text-xs font-semibold text-pitch underline" onClick={() => setOverride((o) => ({ ...o, striker: nonStriker, nonStriker: striker }))}>⇄ swap strike</button>
              </div>
            )}
          </section>

          {/* Pad */}
          <section className={`space-y-2 ${ready ? "" : "pointer-events-none opacity-40"}`}>
            <div className="grid grid-cols-3 gap-2">
              {[0, 1, 2, 3, 4, 6].map((r) => (
                <button key={r} onClick={() => record({ runs_bat: r })}
                  className={`h-16 rounded-2xl font-display text-2xl font-extrabold shadow-card active:scale-95 ${r === 4 ? "bg-sky-600 text-white" : r === 6 ? "bg-gold text-pitch-900" : "bg-white text-pitch-900"}`}>
                  {r === 0 ? "•" : r}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-5 gap-2">
              {([["wide", "Wide"], ["no_ball", "No ball"], ["bye", "Bye"], ["leg_bye", "Leg bye"]] as const).map(([k, l]) => (
                <button key={k} onClick={() => setSheet(k)} className="h-14 rounded-xl bg-amber-100 text-sm font-bold text-amber-900 active:scale-95">{l}</button>
              ))}
              <button onClick={() => setSheet("wicket")} className="h-14 rounded-xl bg-ball text-sm font-extrabold text-white active:scale-95">OUT</button>
            </div>
          </section>
        </>
      )}

      {(sheet === "wide" || sheet === "no_ball" || sheet === "bye" || sheet === "leg_bye") && (
        <ExtraSheet kind={sheet} onCancel={() => setSheet(null)} onPick={(n) => {
          if (sheet === "wide") record({ extra_type: "wide", extra_runs: 1 + n });
          else if (sheet === "no_ball") record({ extra_type: "no_ball", extra_runs: 1, runs_bat: n });
          else record({ extra_type: sheet, extra_runs: n });
        }} />
      )}
      {sheet === "wicket" && striker && (
        <WicketSheet striker={striker} nonStriker={nonStriker} fielders={bowlingSquad.filter((p) => p !== striker && p !== nonStriker)} bowler={bowler} nm={nm}
          onCancel={() => setSheet(null)} onConfirm={(w) => record(w)} />
      )}

      {sheet === "retire" && striker && (
        <Sheet title="Retire a batter" onCancel={() => setSheet(null)}>
          <p className="mb-3 text-sm muted">The batter leaves without being out, no ball is used, and they can come back later to continue their innings.</p>
          <div className="grid gap-2">
            {[striker, nonStriker].filter(Boolean).map((id) => (
              <button key={id} onClick={() => record({ wicket_type: "retired", dismissed_id: id, non_delivery: true })}
                className="h-12 rounded-xl bg-pitch-50 font-semibold text-pitch-900 active:scale-95">
                Retire {nm(id)} ({bat(id!)?.runs ?? 0})
              </button>
            ))}
          </div>
        </Sheet>
      )}
      {sheet === "overs" && (
        <OversSheet current={bundle.match.overs} min={Math.max(1, Math.ceil(cur.legalBalls / 6))} busy={busy}
          onCancel={() => setSheet(null)} onSave={(n) => matchAction({ action: "set_overs", overs: n }, `Match is now ${n} overs a side`)} />
      )}
      {sheet === "player" && (
        <AddPlayerSheet teams={[bundle.teamA, bundle.teamB]} defaultTeam={battingTeam.id} busy={busy}
          candidates={allPlayers.filter((p) => !bundle.teamA.player_ids.includes(p.id) && !bundle.teamB.player_ids.includes(p.id) && p.id !== common)}
          onCancel={() => setSheet(null)}
          onSave={(b) => matchAction({ action: "add_player", ...b }, "Player added")} />
      )}
      {sheet === "common" && (
        <Sheet title="Common player" onCancel={() => setSheet(null)}>
          <p className="mb-3 text-sm muted">The common player can bat, bowl and field for both teams in this match.</p>
          <CommonForm current={common} busy={busy} nm={nm}
            options={allPlayers.filter((p) => !bundle.teamA.player_ids.includes(p.id) && !bundle.teamB.player_ids.includes(p.id))}
            onSave={(pid) => matchAction({ action: "set_common", playerId: pid }, pid ? `${nm(pid)} is the common player` : "Common player removed")} />
        </Sheet>
      )}

      {noBattersLeft && (
        <button onClick={endInnings} disabled={busy} className="btn w-full bg-ball py-3 text-white">All batters are out — end innings</button>
      )}
      {notice && <p role="status" className="rounded-lg bg-pitch-50 px-3 py-2 text-sm font-medium text-pitch-700">✓ {notice}</p>}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        <button onClick={undo} disabled={busy || (queue.length > 0 && !offline)} className="btn-ghost">↶ Undo last</button>
        {inPlay && <button onClick={() => setSheet("retire")} disabled={!striker || !!sheet || !settled} className="btn-ghost">🚶 Retire batter</button>}
        {(inPlay || st.phase === "break") && <button onClick={() => setSheet("player")} disabled={!settled} className="btn-ghost">➕ Add player</button>}
        {(inPlay || st.phase === "break") && <button onClick={() => setSheet("overs")} disabled={!settled} className="btn-ghost">⏱ Overs ({bundle.match.overs})</button>}
        {(inPlay || st.phase === "break") && <button onClick={() => setSheet("common")} disabled={!settled} className="btn-ghost">🤝 {common ? `Common: ${nm(common)}` : "Common player"}</button>}
        {inPlay && <button onClick={endInnings} disabled={busy} className="btn-ghost">End innings</button>}
      </div>
    </div>
  );
}

function Sheet({ title, children, onCancel }: { title: string; children: React.ReactNode; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={onCancel}>
      <div className="w-full max-w-md rounded-t-3xl bg-white p-5 pb-8 shadow-2xl sm:rounded-3xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="h2">{title}</h3>
          <button onClick={onCancel} className="rounded-full px-2 text-2xl leading-none muted" aria-label="Close">×</button>
        </div>
        {children}
      </div>
    </div>
  );
}

function ExtraSheet({ kind, onPick, onCancel }: { kind: "wide" | "no_ball" | "bye" | "leg_bye"; onPick: (n: number) => void; onCancel: () => void }) {
  const cfg = {
    wide: { title: "Wide", q: "Extra runs taken? (1 wide is added automatically)", opts: [0, 1, 2, 3, 4], lab: (n: number) => (n === 0 ? "Just wide" : n === 4 ? "+4 (boundary)" : `+${n}`) },
    no_ball: { title: "No ball", q: "Runs off the bat? (1 no-ball is added automatically)", opts: [0, 1, 2, 3, 4, 6], lab: (n: number) => (n === 0 ? "No runs" : `+${n}`) },
    bye: { title: "Byes", q: "How many byes?", opts: [1, 2, 3, 4], lab: (n: number) => String(n) },
    leg_bye: { title: "Leg byes", q: "How many leg byes?", opts: [1, 2, 3, 4], lab: (n: number) => String(n) },
  }[kind];
  return (
    <Sheet title={cfg.title} onCancel={onCancel}>
      <p className="mb-3 text-sm muted">{cfg.q}</p>
      <div className="grid grid-cols-3 gap-2">
        {cfg.opts.map((n) => <button key={n} onClick={() => onPick(n)} className="h-14 rounded-xl bg-amber-100 font-bold text-amber-900 active:scale-95">{cfg.lab(n)}</button>)}
      </div>
    </Sheet>
  );
}

function WicketSheet({ striker, nonStriker, fielders, bowler, nm, onConfirm, onCancel }: {
  striker: string; nonStriker: string | null; fielders: string[]; bowler: string | null; nm: (id: string | null) => string;
  onConfirm: (w: { wicket_type: WicketType; dismissed_id: string; fielder_id: string | null; runs_bat: number; extra_type: ExtraType | null; extra_runs: number }) => void;
  onCancel: () => void;
}) {
  const [type, setType] = useState<WicketType | null>(null);
  const [out, setOut] = useState(striker);
  const [fielder, setFielder] = useState<string>("");
  const [runs, setRuns] = useState(0);
  const [delivery, setDelivery] = useState<"legal" | "wide" | "no_ball">("legal");
  const needFielder = type === "caught" || type === "run_out" || type === "stumped";
  const canPickBatter = type === "run_out";
  const deliveries = type === "run_out" ? (["legal", "wide", "no_ball"] as const) : type === "stumped" ? (["legal", "wide"] as const) : (["legal"] as const);
  const ok = type && (!needFielder || fielder || type === "run_out");
  return (
    <Sheet title="Wicket!" onCancel={onCancel}>
      <div className="grid grid-cols-2 gap-2">
        {WICKETS.map((w) => (
          <button key={w.t} onClick={() => { setType(w.t); setOut(striker); setDelivery("legal"); setRuns(0); if (w.t === "caught" || w.t === "stumped") setFielder(""); }}
            className={`h-12 rounded-xl text-sm font-bold ${type === w.t ? "bg-ball text-white" : "bg-red-50 text-red-800"}`}>
            {w.label}
          </button>
        ))}
      </div>
      {type && (
        <div className="mt-4 space-y-3">
          {canPickBatter && nonStriker && (
            <div>
              <span className="label">Who is out?</span>
              <div className="grid grid-cols-2 gap-2">
                {[striker, nonStriker].map((id) => (
                  <button key={id} onClick={() => setOut(id)} className={`h-11 rounded-xl text-sm font-semibold ${out === id ? "bg-pitch text-white" : "bg-pitch-50"}`}>{nm(id)}</button>
                ))}
              </div>
            </div>
          )}
          {needFielder && (
            <label className="block">
              <span className="label">{type === "caught" ? "Caught by" : type === "stumped" ? "Wicket-keeper" : "Fielder (optional)"}</span>
              <select className="input" value={fielder} onChange={(e) => setFielder(e.target.value)}>
                <option value="">— select —</option>
                {fielders.map((f) => <option key={f} value={f}>{nm(f)}{f === bowler ? " (bowler)" : ""}</option>)}
              </select>
            </label>
          )}
          {deliveries.length > 1 && (
            <div>
              <span className="label">Delivery</span>
              <div className="flex gap-2">
                {deliveries.map((d) => (
                  <button key={d} onClick={() => setDelivery(d)} className={`h-10 flex-1 rounded-xl text-sm font-semibold ${delivery === d ? "bg-pitch text-white" : "bg-pitch-50"}`}>
                    {d === "legal" ? "Normal" : d === "wide" ? "Wide" : "No ball"}
                  </button>
                ))}
              </div>
            </div>
          )}
          {type === "run_out" && (
            <div>
              <span className="label">Runs completed before the run out</span>
              <div className="flex gap-2">
                {[0, 1, 2, 3].map((n) => (
                  <button key={n} onClick={() => setRuns(n)} className={`h-10 flex-1 rounded-xl font-semibold ${runs === n ? "bg-pitch text-white" : "bg-pitch-50"}`}>{n}</button>
                ))}
              </div>
            </div>
          )}
          <button
            disabled={!ok}
            className="btn w-full bg-ball py-3 text-white"
            onClick={() =>
              onConfirm({
                wicket_type: type!,
                dismissed_id: out,
                fielder_id: needFielder ? fielder || null : null,
                runs_bat: delivery === "wide" ? 0 : runs,
                extra_type: delivery === "legal" ? null : delivery,
                extra_runs: delivery === "wide" ? 1 + runs : delivery === "no_ball" ? 1 : 0,
              })
            }
          >
            Confirm: {nm(out)} is out
          </button>
        </div>
      )}
    </Sheet>
  );
}

function OversSheet({ current, min, busy, onSave, onCancel }: { current: number; min: number; busy: boolean; onSave: (n: number) => void; onCancel: () => void }) {
  const [n, setN] = useState(current);
  return (
    <Sheet title="Change overs" onCancel={onCancel}>
      <p className="mb-3 text-sm muted">Overs per side for this match. Both innings use the new number; the target stays the same.</p>
      <div className="flex items-center justify-center gap-4">
        <button onClick={() => setN((x) => Math.max(min, x - 1))} disabled={n <= min} className="h-14 w-14 rounded-full bg-pitch-50 text-3xl font-bold text-pitch">−</button>
        <span className="w-20 text-center font-display text-5xl font-extrabold tabular-nums" aria-live="polite">{n}</span>
        <button onClick={() => setN((x) => Math.min(50, x + 1))} disabled={n >= 50} className="h-14 w-14 rounded-full bg-pitch-50 text-3xl font-bold text-pitch">+</button>
      </div>
      {min > 1 && <p className="mt-2 text-center text-xs muted">Can&apos;t go below {min} — that many overs have already been started this innings.</p>}
      <button onClick={() => onSave(n)} disabled={busy || n === current} className="btn-primary mt-4 w-full py-3">Save — {n} overs</button>
    </Sheet>
  );
}

function AddPlayerSheet({ teams, defaultTeam, candidates, busy, onSave, onCancel }: {
  teams: { id: string; name: string }[]; defaultTeam: string; candidates: { id: string; name: string }[]; busy: boolean;
  onSave: (b: { teamId: string; playerId?: string; name?: string }) => void; onCancel: () => void;
}) {
  const [teamId, setTeamId] = useState(defaultTeam);
  const [mode, setMode] = useState<"existing" | "new">(candidates.length ? "existing" : "new");
  const [pid, setPid] = useState("");
  const [name, setName] = useState("");
  const ok = mode === "existing" ? !!pid : name.trim().length > 0;
  return (
    <Sheet title="Add a player" onCancel={onCancel}>
      <span className="label">Join which team?</span>
      <div className="mb-3 grid grid-cols-2 gap-2">
        {teams.map((t) => (
          <button key={t.id} onClick={() => setTeamId(t.id)} className={`h-11 rounded-xl text-sm font-semibold ${teamId === t.id ? "bg-pitch text-white" : "bg-pitch-50"}`}>{t.name}</button>
        ))}
      </div>
      <div className="mb-3 grid grid-cols-2 gap-2">
        <button onClick={() => setMode("existing")} disabled={!candidates.length} className={`h-10 rounded-xl text-sm font-semibold ${mode === "existing" ? "bg-gold text-pitch-900" : "bg-gold-100/60"}`}>From player list</button>
        <button onClick={() => setMode("new")} className={`h-10 rounded-xl text-sm font-semibold ${mode === "new" ? "bg-gold text-pitch-900" : "bg-gold-100/60"}`}>New player</button>
      </div>
      {mode === "existing" ? (
        <label className="block"><span className="label">Player</span>
          <select className="input" value={pid} onChange={(e) => setPid(e.target.value)}>
            <option value="">— select —</option>
            {candidates.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </label>
      ) : (
        <label className="block"><span className="label">New player&apos;s name</span>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={40} placeholder="e.g. Rahul" />
        </label>
      )}
      <button disabled={!ok || busy} onClick={() => onSave(mode === "existing" ? { teamId, playerId: pid } : { teamId, name: name.trim() })} className="btn-primary mt-4 w-full py-3">
        {busy ? "Adding…" : "Add to team"}
      </button>
    </Sheet>
  );
}

function CommonForm({ current, options, busy, nm, onSave }: {
  current: string | null; options: { id: string; name: string }[]; busy: boolean; nm: (id: string | null) => string; onSave: (id: string | null) => void;
}) {
  const [pid, setPid] = useState(current ?? "");
  return (
    <div className="space-y-3">
      <select className="input" value={pid} onChange={(e) => setPid(e.target.value)} aria-label="Common player">
        <option value="">— no common player —</option>
        {options.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      <button disabled={busy || pid === (current ?? "")} onClick={() => onSave(pid || null)} className="btn-primary w-full py-3">
        {pid ? `Make ${nm(pid)} the common player` : "Remove common player"}
      </button>
    </div>
  );
}
