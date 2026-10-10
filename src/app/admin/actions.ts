"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { COOKIE, checkCredentials, cookieOptions, makeSessionToken, requireAdmin } from "@/lib/auth";
import { store } from "@/lib/data/store";
import type { DayTeam, Match, Photo, Player } from "@/lib/types";
import { deleteDayCascade, deleteMatchCascade, regenerateSummary, startMatch } from "@/lib/data/matchOps";

export type ActionState = { error?: string; ok?: string } | undefined;

const str = (fd: FormData, k: string) => String(fd.get(k) ?? "").trim();

function fail(e: unknown): ActionState {
  return { error: e instanceof Error ? e.message : "Something went wrong" };
}

/* ---------- Login ---------- */

export async function login(_: ActionState, fd: FormData): Promise<ActionState> {
  if (!checkCredentials(str(fd, "username"), String(fd.get("password") ?? ""))) {
    await new Promise((r) => setTimeout(r, 600));
    return { error: "Wrong username or password" };
  }
  cookies().set(COOKIE, makeSessionToken(), cookieOptions);
  redirect(str(fd, "next") || "/admin");
}

export async function logout() {
  cookies().delete(COOKIE);
  redirect("/");
}

/* ---------- Players ---------- */

export async function addPlayers(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    requireAdmin();
    // one name per line or comma-separated, so the umpire can paste the whole group in one go
    const names = str(fd, "names")
      .split(/[\n,]+/)
      .map((n) => n.trim())
      .filter(Boolean);
    if (!names.length) return { error: "Type at least one name" };
    const existing = await store().list<Player>("players");
    const have = new Set(existing.map((p) => p.name.toLowerCase()));
    let added = 0;
    for (const name of names) {
      if (name.length > 40) continue;
      if (have.has(name.toLowerCase())) continue;
      await store().insert("players", { name });
      have.add(name.toLowerCase());
      added++;
    }
    revalidatePath("/", "layout");
    return { ok: added ? `Added ${added} player${added === 1 ? "" : "s"}` : "Those players already exist" };
  } catch (e) {
    return fail(e);
  }
}

export async function updatePlayer(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    requireAdmin();
    const name = str(fd, "name");
    if (!name) return { error: "Name can't be empty" };
    await store().update("players", str(fd, "id"), { name, nickname: str(fd, "nickname") || null });
    revalidatePath("/", "layout");
    return { ok: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

/* ---------- Match days ---------- */

export async function createDay(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    requireAdmin();
    const date = str(fd, "date");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return { error: "Pick a date" };
    const day = await store().insert<{ id: string }>("match_days", {
      date,
      venue: str(fd, "venue") || null,
      notes: str(fd, "notes") || null,
    });
    id = day.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  redirect(`/admin/days/${id}`);
}

export async function updateDay(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    requireAdmin();
    await store().update("match_days", str(fd, "id"), {
      date: str(fd, "date"),
      venue: str(fd, "venue") || null,
      notes: str(fd, "notes") || null,
    });
    revalidatePath("/", "layout");
    return { ok: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteDay(fd: FormData) {
  requireAdmin();
  await deleteDayCascade(str(fd, "id"));
  revalidatePath("/", "layout");
  redirect("/admin");
}

/* ---------- Teams ---------- */

export async function saveTeam(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    requireAdmin();
    const id = str(fd, "id");
    const dayId = str(fd, "match_day_id");
    const name = str(fd, "name");
    const playerIds = fd.getAll("player_ids").map(String).filter(Boolean);
    const captain = str(fd, "captain_id") || null;
    if (!name) return { error: "Give the team a name" };
    if (playerIds.length < 2) return { error: "Pick at least 2 players" };
    if (captain && !playerIds.includes(captain)) return { error: "Captain must be in the team" };
    // a player can only be in one team on a given day
    const others = (await store().list<DayTeam>("day_teams", { match_day_id: dayId })).filter((t) => t.id !== id);
    const clash = others.find((t) => t.player_ids.some((p) => playerIds.includes(p)));
    if (clash) {
      const players = await store().list<Player>("players");
      const dup = playerIds.find((p) => clash.player_ids.includes(p));
      return { error: `${players.find((p) => p.id === dup)?.name ?? "A player"} is already in ${clash.name}` };
    }
    const row = { match_day_id: dayId, name, captain_id: captain, player_ids: playerIds };
    if (id) await store().update("day_teams", id, row);
    else await store().insert("day_teams", row);
    revalidatePath("/", "layout");
    return { ok: id ? "Team updated" : "Team created" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteTeam(fd: FormData) {
  requireAdmin();
  const id = str(fd, "id");
  const matches = await store().list<Match>("matches", { team_a_id: id });
  const matches2 = await store().list<Match>("matches", { team_b_id: id });
  for (const m of [...matches, ...matches2]) await deleteMatchCascade(m.id);
  await store().remove("day_teams", { id });
  revalidatePath("/", "layout");
}

/* ---------- Matches ---------- */

export async function createMatch(_: ActionState, fd: FormData): Promise<ActionState> {
  let id: string;
  try {
    requireAdmin();
    const dayId = str(fd, "match_day_id");
    const a = str(fd, "team_a_id");
    const b = str(fd, "team_b_id");
    const overs = Number(str(fd, "overs"));
    const pps = Number(str(fd, "players_per_side"));
    if (!a || !b || a === b) return { error: "Pick two different teams" };
    if (!Number.isInteger(overs) || overs < 1 || overs > 50) return { error: "Overs must be 1–50" };
    if (!Number.isInteger(pps) || pps < 2 || pps > 15) return { error: "Players per side must be 2–15" };
    const existing = await store().list<Match>("matches", { match_day_id: dayId });
    const m = await store().insert<{ id: string }>("matches", {
      match_day_id: dayId,
      match_no: existing.reduce((mx, x) => Math.max(mx, x.match_no), 0) + 1,
      team_a_id: a,
      team_b_id: b,
      overs,
      players_per_side: pps,
      status: "setup",
    });
    id = m.id;
  } catch (e) {
    return fail(e);
  }
  revalidatePath("/", "layout");
  redirect(`/admin/matches/${id}/score`);
}

export async function updateMatchSettings(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    requireAdmin();
    const overs = Number(str(fd, "overs"));
    const pps = Number(str(fd, "players_per_side"));
    if (!Number.isInteger(overs) || overs < 1 || overs > 50) return { error: "Overs must be 1–50" };
    if (!Number.isInteger(pps) || pps < 2 || pps > 15) return { error: "Players per side must be 2–15" };
    await store().update("matches", str(fd, "id"), { overs, players_per_side: pps });
    const { syncMatch } = await import("@/lib/data/matchOps");
    await syncMatch(str(fd, "id"));
    revalidatePath("/", "layout");
    return { ok: "Saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function startMatchAction(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    requireAdmin();
    const decision = str(fd, "toss_decision");
    if (decision !== "bat" && decision !== "bowl") return { error: "Choose bat or bowl" };
    await startMatch(str(fd, "id"), str(fd, "toss_winner_id"), decision);
    revalidatePath("/", "layout");
    return { ok: "Match started" };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteMatch(fd: FormData) {
  requireAdmin();
  const id = str(fd, "id");
  const m = await store().get<Match>("matches", id);
  await deleteMatchCascade(id);
  revalidatePath("/", "layout");
  redirect(m ? `/admin/days/${m.match_day_id}` : "/admin");
}

export async function saveSummary(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    requireAdmin();
    await store().update("matches", str(fd, "id"), { summary: str(fd, "summary") || null });
    revalidatePath("/", "layout");
    return { ok: "Summary saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function regenerateSummaryAction(fd: FormData) {
  requireAdmin();
  await regenerateSummary(str(fd, "id"));
  revalidatePath("/", "layout");
}

/* ---------- Photos ---------- */

export async function updatePhoto(_: ActionState, fd: FormData): Promise<ActionState> {
  try {
    requireAdmin();
    await store().update("photos", str(fd, "id"), { caption: str(fd, "caption").slice(0, 200) || null });
    revalidatePath("/", "layout");
    return { ok: "Caption saved" };
  } catch (e) {
    return fail(e);
  }
}

export async function deletePhoto(fd: FormData) {
  requireAdmin();
  const p = await store().get<Photo>("photos", str(fd, "id"));
  if (p) {
    await store().deleteFile(p.path).catch(() => undefined);
    await store().remove("photos", { id: p.id });
  }
  revalidatePath("/", "layout");
}

export async function movePhoto(fd: FormData) {
  requireAdmin();
  const p = await store().get<Photo>("photos", str(fd, "id"));
  if (!p) return;
  const all = (await store().list<Photo>("photos", { match_day_id: p.match_day_id })).sort(
    (a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at),
  );
  const i = all.findIndex((x) => x.id === p.id);
  const j = str(fd, "dir") === "up" ? i - 1 : i + 1;
  if (j < 0 || j >= all.length) return;
  [all[i], all[j]] = [all[j], all[i]];
  for (let k = 0; k < all.length; k++) if (all[k].sort !== k) await store().update("photos", all[k].id, { sort: k });
  revalidatePath("/", "layout");
}
