-- Sunday Cricket — "last batter can bat alone" option
-- Run this ONCE in Supabase → SQL Editor → New query → Run, BEFORE pushing the new code.
-- It only adds one new setting to matches. Existing matches keep the old rule (off), so their results don't change.

alter table matches add column if not exists last_man_stands boolean not null default false;

-- quick check: the numbers should be the same as before
select (select count(*) from matches) as matches, (select count(*) from balls) as balls;
