-- Sunday Cricket — October update (common player, MVP vote, retire batter, out of box, history lock)
-- Run this ONCE in Supabase → SQL Editor → New query → Run, BEFORE pushing the new code.
-- It only ADDS new columns and allows one new way of getting out.
-- It does not delete or change any existing players, matches, balls or photos.

alter table match_days add column if not exists mvp_player_id uuid references players(id) on delete set null;
alter table match_days add column if not exists mvp_note text;
alter table match_days add column if not exists locked boolean;

alter table matches add column if not exists common_player_id uuid references players(id) on delete set null;

alter table balls add column if not exists non_delivery boolean not null default false;

-- allow the new "out of box" dismissal (existing rows are unaffected)
alter table balls drop constraint if exists balls_wicket_type_check;
alter table balls add constraint balls_wicket_type_check
  check (wicket_type in ('bowled','caught','lbw','run_out','stumped','hit_wicket','out_of_box','retired'));

-- quick check: shows how many matches and balls you have — the numbers should be the same as before
select (select count(*) from matches) as matches, (select count(*) from balls) as balls;
