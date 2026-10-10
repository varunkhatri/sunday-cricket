import type { Ball, DayTeam, ID, Innings, Match, MatchBundle, MatchDay, Photo, Player } from "../types";
import { store } from "./store";

export async function getPlayers(): Promise<Player[]> {
  const ps = await store().list<Player>("players");
  return ps.sort((a, b) => a.name.localeCompare(b.name));
}

export async function getPlayerNames(): Promise<Record<ID, string>> {
  const ps = await store().list<Player>("players");
  return Object.fromEntries(ps.map((p) => [p.id, p.nickname?.trim() || p.name]));
}

export async function listDays(): Promise<MatchDay[]> {
  const ds = await store().list<MatchDay>("match_days");
  return ds.sort((a, b) => b.date.localeCompare(a.date) || b.created_at.localeCompare(a.created_at));
}

export const getDay = (id: ID) => store().get<MatchDay>("match_days", id);
export const getMatch = (id: ID) => store().get<Match>("matches", id);

export interface DayFull {
  day: MatchDay;
  teams: DayTeam[];
  bundles: MatchBundle[];
  photos: Photo[];
}

function assemble(day: MatchDay, teams: DayTeam[], matches: Match[], innings: Innings[], balls: Ball[], photos: Photo[]): DayFull {
  const tm = new Map(teams.map((t) => [t.id, t]));
  const innNo = new Map(innings.map((i) => [i.id, i.innings_no]));
  const bundles = matches
    .filter((m) => m.match_day_id === day.id)
    .sort((a, b) => a.match_no - b.match_no)
    .map((m) => ({
      match: m,
      teamA: tm.get(m.team_a_id)!,
      teamB: tm.get(m.team_b_id)!,
      innings: innings.filter((i) => i.match_id === m.id).sort((a, b) => a.innings_no - b.innings_no),
      balls: balls
        .filter((b) => b.match_id === m.id)
        .sort((a, b) => (innNo.get(a.innings_id) ?? 0) - (innNo.get(b.innings_id) ?? 0) || a.seq - b.seq),
    }))
    .filter((b) => b.teamA && b.teamB);
  return {
    day,
    teams: teams.filter((t) => t.match_day_id === day.id).sort((a, b) => a.created_at.localeCompare(b.created_at)),
    bundles,
    photos: photos.filter((p) => p.match_day_id === day.id).sort((a, b) => a.sort - b.sort || a.created_at.localeCompare(b.created_at)),
  };
}

/** Load full data (teams, matches, balls, photos) for many days at once. */
export async function loadDays(days: MatchDay[]): Promise<DayFull[]> {
  if (!days.length) return [];
  const s = store();
  const ids = days.map((d) => d.id);
  const [teams, matches, photos] = await Promise.all([
    s.list<DayTeam>("day_teams", { match_day_id: ids }),
    s.list<Match>("matches", { match_day_id: ids }),
    s.list<Photo>("photos", { match_day_id: ids }),
  ]);
  const mids = matches.map((m) => m.id);
  const [innings, balls] = await Promise.all([
    s.list<Innings>("innings", { match_id: mids }),
    s.list<Ball>("balls", { match_id: mids }),
  ]);
  return days.map((d) => assemble(d, teams, matches, innings, balls, photos));
}

export async function getDayFull(id: ID): Promise<DayFull | null> {
  const day = await getDay(id);
  if (!day) return null;
  return (await loadDays([day]))[0];
}

export async function getMatchBundle(id: ID): Promise<MatchBundle | null> {
  const s = store();
  const match = await s.get<Match>("matches", id);
  if (!match) return null;
  const [teamA, teamB, innings, balls] = await Promise.all([
    s.get<DayTeam>("day_teams", match.team_a_id),
    s.get<DayTeam>("day_teams", match.team_b_id),
    s.list<Innings>("innings", { match_id: id }),
    s.list<Ball>("balls", { match_id: id }),
  ]);
  if (!teamA || !teamB) return null;
  innings.sort((a, b) => a.innings_no - b.innings_no);
  const order = new Map(innings.map((i) => [i.id, i.innings_no]));
  balls.sort((a, b) => (order.get(a.innings_id)! - order.get(b.innings_id)!) || a.seq - b.seq);
  return { match, teamA, teamB, innings, balls };
}

/** Days whose date falls within [from, to] (inclusive, YYYY-MM-DD). */
export async function daysInRange(from?: string, to?: string) {
  const all = await listDays();
  return all.filter((d) => (!from || d.date >= from) && (!to || d.date <= to));
}

export function monthRange(ym: string) {
  const [y, m] = ym.split("-").map(Number);
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { from: `${ym}-01`, to: `${ym}-${String(last).padStart(2, "0")}` };
}
