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
  /** Player voted Most Valuable Player of the day by the players */
  mvp_player_id?: string | null;
  mvp_note?: string | null;
  /** null = automatic (locked once the day is in the past), true = locked, false = unlocked for corrections */
  locked?: boolean | null;
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
  /** A player who plays for both teams in this match */
  common_player_id?: string | null;
  /** The last batter can carry on alone until the innings ends */
  last_man_stands?: boolean;
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
  | "out_of_box"
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
  /** true for an event that isn't a delivery (e.g. retiring a batter) — doesn't use up a ball */
  non_delivery?: boolean;
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
