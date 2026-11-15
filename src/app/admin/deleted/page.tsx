import Link from "next/link";
import ActionForm, { Submit } from "@/components/ActionForm";
import { deleteDayForever, restoreDay } from "../actions";
import { isSuperAdmin } from "@/lib/auth";
import { listDeletedDays } from "@/lib/data/queries";
import { binDaysLeft, BIN_DAYS, purgeExpiredBin } from "@/lib/data/matchOps";
import { store } from "@/lib/data/store";
import { fmtDate } from "@/lib/format";
import type { DayTeam, Match, Photo } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function RecentlyDeleted({ searchParams }: { searchParams: { gone?: string } }) {
  if (!isSuperAdmin())
    return <p className="card p-6 text-center muted">Only the super admin can see deleted Sundays.</p>;
  await purgeExpiredBin();
  const days = await listDeletedDays();
  const ids = days.map((d) => d.id);
  const [matches, teams, photos] = ids.length
    ? await Promise.all([
        store().list<Match>("matches", { match_day_id: ids }),
        store().list<DayTeam>("day_teams", { match_day_id: ids }),
        store().list<Photo>("photos", { match_day_id: ids }),
      ])
    : [[], [], []];
  return (
    <div className="space-y-5">
      <Link href="/admin" className="text-sm font-semibold text-pitch hover:underline">← Umpire desk</Link>
      <div>
        <h1 className="h1">🗑 Recently deleted</h1>
        <p className="muted">Deleted Sundays stay here for {BIN_DAYS} days with all their matches, scores and photos. Restore puts one back exactly as it was.</p>
      </div>
      {searchParams.gone && <p role="status" className="card border-amber-300 bg-amber-50 p-4 text-sm">The Sunday was deleted for good.</p>}
      {days.length === 0 && <p className="card p-6 text-center muted">Nothing here — no Sundays have been deleted.</p>}
      {days.map((d) => {
        const ms = matches.filter((m) => m.match_day_id === d.id);
        const done = ms.filter((m) => m.status === "completed").length;
        const left = binDaysLeft(d.deleted_at!);
        return (
          <section key={d.id} className="card space-y-3 p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-display text-lg font-bold">{fmtDate(d.date)}{d.venue ? <span className="font-normal muted"> · {d.venue}</span> : null}</p>
                <p className="text-sm muted">
                  {teams.filter((t) => t.match_day_id === d.id).length} teams · {ms.length} match{ms.length === 1 ? "" : "es"} ({done} finished)
                  {photos.some((p) => p.match_day_id === d.id) ? ` · 📸 ${photos.filter((p) => p.match_day_id === d.id).length}` : ""}
                </p>
                <p className="text-xs muted">
                  Deleted {new Date(d.deleted_at!).toLocaleString("en-GB", { timeZone: "Europe/London", dateStyle: "medium", timeStyle: "short" })}
                  {" · "}<b className={left <= 3 ? "text-red-700" : ""}>removed for good in {left} day{left === 1 ? "" : "s"}</b>
                </p>
              </div>
              <form action={restoreDay}>
                <input type="hidden" name="id" value={d.id} />
                <button className="btn-primary">↩ Restore</button>
              </form>
            </div>
            <details className="border-t border-black/5 pt-3">
              <summary className="cursor-pointer text-sm font-semibold text-red-700">Delete for good now…</summary>
              <ActionForm action={deleteDayForever} className="mt-3 flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={d.id} />
                <label className="min-w-40 flex-1">
                  <span className="label">This can&apos;t be undone. Type DELETE to confirm</span>
                  <input name="confirm" className="input" autoComplete="off" autoCapitalize="characters" placeholder="DELETE" aria-label="Type DELETE to delete for good" />
                </label>
                <Submit className="btn-danger" pendingText="Deleting…">Delete for good</Submit>
              </ActionForm>
            </details>
          </section>
        );
      })}
    </div>
  );
}
