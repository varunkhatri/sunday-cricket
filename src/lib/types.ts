export type ID = string;

export interface Player {
  id: ID;
  name: string;
  nickname?: string | null;
  created_at: string;
}

export interface MatchDay {
  id: ID;
  date: string; // YYYY-MM-DD
  venue?: string | null;
  notes?: string | null;
  created_at: string;
}

export interface DayTeam {
  id: ID;
  match_day_id: ID;
  name: string;
  captain_id: ID | null;
  player_ids: ID[];
  created_at: string;
}

export type MatchStatus = "setup" | "live" | "completed";

export interface Match {
  id: ID;
  match_day_id: ID;
  match_no: number;
  team_a_id: ID;
  team_b_id: ID;
  overs: number;
  players_per_side: number;
  toss_winner_id: ID | null;
  toss_decision: "bat" | "bowl" | null;
  status: MatchStatus;
  winner_team_id: ID | null;
  result_text: string | null;
  summary: string | null;
  created_at: string;
}

export interface Innings {
  id: ID;
  match_id: ID;
  innings_no: 1 | 2;
  batting_team_id: ID;
  bowling_team_id: ID;
  closed: boolean;
  created_at: string;
}

export type ExtraType = "wide" | "no_ball" | "bye" | "leg_bye";
export type WicketType =
  | "bowled"
  | "caught"
  | "lbw"
  | "run_out"
  | "stumped"
  | "hit_wicket"
  | "retired";

export interface Ball {
  id: ID;
  innings_id: ID;
  match_id: ID;
  seq: number;
  striker_id: ID;
  non_striker_id: ID | null;
  bowler_id: ID;
  runs_bat: number;
  extra_type: ExtraType | null;
  extra_runs: number;
  wicket_type: WicketType | null;
  dismissed_id: ID | null;
  fielder_id: ID | null;
  created_at: string;
}

export interface Photo {
  id: ID;
  match_day_id: ID;
  path: string;
  url: string;
  caption: string | null;
  sort: number;
  created_at: string;
}

/** Everything needed to render/compute one match. */
export interface MatchBundle {
  match: Match;
  teamA: DayTeam;
  teamB: DayTeam;
  innings: Innings[]; // sorted by innings_no
  balls: Ball[]; // all balls of the match, sorted by innings then seq
}
