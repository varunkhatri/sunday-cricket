-- Sunday Cricket — player profile pictures
-- Run this ONCE in Supabase → SQL Editor → New query → Run, BEFORE pushing the new code.
-- It only adds two empty columns to players. Nothing existing is changed or removed.
-- (Pictures go in the existing "day-photos" storage bucket, in a "players" folder.)

alter table players add column if not exists photo_url text;
alter table players add column if not exists photo_path text;

-- quick check: the numbers should be the same as before
select (select count(*) from players) as players, (select count(*) from matches) as matches, (select count(*) from balls) as balls;
