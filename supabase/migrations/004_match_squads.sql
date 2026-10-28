-- Sunday Cricket — remember exactly who played in each match
-- Run this ONCE in Supabase → SQL Editor → New query → Run, BEFORE pushing the new code.
-- It only adds two empty columns. Existing matches are not changed
-- (they keep using the day's team list until you correct them in the app).

alter table matches add column if not exists team_a_players uuid[];
alter table matches add column if not exists team_b_players uuid[];

-- quick check: the numbers should be the same as before
select (select count(*) from matches) as matches, (select count(*) from balls) as balls;
