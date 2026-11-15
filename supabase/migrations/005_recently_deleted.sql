-- Sunday Cricket — "Recently deleted" bin for Sundays
-- Run this ONCE in Supabase → SQL Editor → New query → Run, BEFORE pushing the new code.
-- It only adds two empty columns. Nothing existing is changed or removed.
-- A deleted Sunday is now just marked as deleted (hidden from the app) and can be restored for 30 days.

alter table match_days add column if not exists deleted_at timestamptz;
alter table match_days add column if not exists deleted_by text;

-- quick check: the numbers should be the same as before
select (select count(*) from match_days) as sundays, (select count(*) from matches) as matches, (select count(*) from balls) as balls;
