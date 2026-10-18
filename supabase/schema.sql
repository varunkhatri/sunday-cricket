-- Sunday Cricket — database schema
-- For a NEW installation: paste this whole file into Supabase → SQL Editor → New query → Run.
-- Already running the app? Run the files in supabase/migrations/ instead (they never delete data).
-- Safe to re-run: it only creates things that don't exist yet.

create table if not exists players (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  nickname text,
  created_at timestamptz not null default now()
);

create table if not exists match_days (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  venue text,
  notes text,
  mvp_player_id uuid references players(id) on delete set null,
  mvp_note text,
  locked boolean,
  created_at timestamptz not null default now()
);

create table if not exists day_teams (
  id uuid primary key default gen_random_uuid(),
  match_day_id uuid not null references match_days(id) on delete cascade,
  name text not null,
  captain_id uuid references players(id) on delete set null,
  player_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

create table if not exists matches (
  id uuid primary key default gen_random_uuid(),
  match_day_id uuid not null references match_days(id) on delete cascade,
  match_no int not null,
  team_a_id uuid not null references day_teams(id) on delete cascade,
  team_b_id uuid not null references day_teams(id) on delete cascade,
  overs int not null check (overs between 1 and 50),
  players_per_side int not null check (players_per_side between 2 and 15),
  toss_winner_id uuid references day_teams(id) on delete set null,
  toss_decision text check (toss_decision in ('bat','bowl')),
  status text not null default 'setup' check (status in ('setup','live','completed')),
  winner_team_id uuid references day_teams(id) on delete set null,
  result_text text,
  summary text,
  common_player_id uuid references players(id) on delete set null,
  last_man_stands boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists innings (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references matches(id) on delete cascade,
  innings_no int not null check (innings_no in (1,2)),
  batting_team_id uuid not null references day_teams(id) on delete cascade,
  bowling_team_id uuid not null references day_teams(id) on delete cascade,
  closed boolean not null default false,
  created_at timestamptz not null default now(),
  unique (match_id, innings_no)
);

create table if not exists balls (
  id uuid primary key default gen_random_uuid(),
  innings_id uuid not null references innings(id) on delete cascade,
  match_id uuid not null references matches(id) on delete cascade,
  seq int not null,
  striker_id uuid not null references players(id),
  non_striker_id uuid references players(id),
  bowler_id uuid not null references players(id),
  runs_bat int not null default 0,
  extra_type text check (extra_type in ('wide','no_ball','bye','leg_bye')),
  extra_runs int not null default 0,
  wicket_type text check (wicket_type in ('bowled','caught','lbw','run_out','stumped','hit_wicket','out_of_box','retired')),
  dismissed_id uuid references players(id),
  fielder_id uuid references players(id),
  non_delivery boolean not null default false,
  created_at timestamptz not null default now(),
  unique (innings_id, seq)
);

create table if not exists photos (
  id uuid primary key default gen_random_uuid(),
  match_day_id uuid not null references match_days(id) on delete cascade,
  path text not null,
  url text not null,
  caption text,
  sort int not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists idx_teams_day on day_teams(match_day_id);
create index if not exists idx_matches_day on matches(match_day_id);
create index if not exists idx_innings_match on innings(match_id);
create index if not exists idx_balls_innings on balls(innings_id, seq);
create index if not exists idx_balls_match on balls(match_id);
create index if not exists idx_photos_day on photos(match_day_id);

-- At most 4 photos per Sunday
create or replace function enforce_photo_limit() returns trigger as $$
begin
  if (select count(*) from photos where match_day_id = new.match_day_id) >= 4 then
    raise exception 'A day can have at most 4 photos';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists photo_limit on photos;
create trigger photo_limit before insert on photos
  for each row execute function enforce_photo_limit();

-- Security: Row Level Security is ON for every table and there are NO write policies.
-- That means nobody can change data using the public (anon) key. Only the app's server,
-- which uses the secret service-role key after checking the admin login, can write.
alter table players enable row level security;
alter table match_days enable row level security;
alter table day_teams enable row level security;
alter table matches enable row level security;
alter table innings enable row level security;
alter table balls enable row level security;
alter table photos enable row level security;

do $$
declare t text;
begin
  foreach t in array array['players','match_days','day_teams','matches','innings','balls','photos'] loop
    if not exists (select 1 from pg_policies where tablename = t and policyname = 'public read') then
      execute format('create policy "public read" on %I for select using (true)', t);
    end if;
  end loop;
end $$;

-- Photo storage bucket (public to view, only the server can upload)
insert into storage.buckets (id, name, public)
values ('day-photos', 'day-photos', true)
on conflict (id) do nothing;
