-- ============================================================
-- DOTCOM (DOTA Companion) — ACES DOTA REBOOT 2026 · Bus Attendance Tracker
-- Run this entire file in the Supabase SQL editor
-- ============================================================

-- ── Rooms (created first so profiles can FK into it) ────────
create table if not exists public.rooms (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  floor       text,
  notes       text,
  capacity    int,
  created_at  timestamptz not null default now()
);

-- Profiles (1:1 with auth.users)
-- NOTE: sensitive PII (student_id, phone, qr_token) lives in member_private, NOT here.
-- profiles is readable by all authenticated users (roster + opt-in location), so it
-- must never hold data a member shouldn't see about other members.
create table if not exists public.profiles (
  id             uuid        primary key references auth.users(id) on delete cascade,
  full_name      text        not null,
  role           text        not null default 'member' check (role in ('admin', 'committee', 'member')),
  group_label    text,
  photo_url      text,
  status         text        not null default 'off_bus' check (status in ('on_bus', 'off_bus')),
  bus_number        int         check (bus_number in (1, 2)),
  seat_number       int         check (seat_number between 1 and 31),
  room_id           uuid        references public.rooms(id) on delete set null,
  latitude          float8,
  longitude         float8,
  location_sharing     boolean     not null default false,
  location_updated_at  timestamptz,
  last_changed_at      timestamptz,
  created_at        timestamptz not null default now(),
  -- prevent two people sharing a seat on the same bus
  unique (bus_number, seat_number)
);

-- Member private data (1:1 with profiles) — sensitive PII + attendance credential.
-- Split out from profiles so that the broadly-readable roster can't leak this.
-- RLS: a user may read ONLY their own row; admins/committee read all.
create table if not exists public.member_private (
  id          uuid        primary key references public.profiles(id) on delete cascade,
  student_id  text,
  phone       text,
  qr_token    uuid        not null unique default gen_random_uuid()
);

-- Groups (registry of group names, so empty groups persist like rooms do).
-- Membership itself stays as profiles.group_label (text) matching a group name.
create table if not exists public.groups (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null unique,
  created_at  timestamptz not null default now()
);

-- Status logs (audit trail)
create table if not exists public.status_logs (
  id          uuid        primary key default gen_random_uuid(),
  member_id   uuid        not null references public.profiles(id) on delete cascade,
  action      text        not null check (action in ('out', 'in')),
  changed_by  uuid        not null references public.profiles(id),
  created_at  timestamptz not null default now()
);

-- Helper: check if calling user is admin or committee (SECURITY DEFINER avoids RLS recursion)
-- 'committee' has the same data access as 'admin' but also has personal trip data
create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'committee')
  );
$$;

-- Auto-create profile row when a new auth user is created
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, full_name, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    'member'
  );
  -- Guarantee every member has a private row (and thus a qr_token).
  insert into public.member_private (id) values (new.id)
  on conflict (id) do nothing;
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── Row Level Security ──────────────────────────────────────

alter table public.profiles       enable row level security;
alter table public.member_private enable row level security;
alter table public.status_logs    enable row level security;
alter table public.rooms          enable row level security;
alter table public.groups         enable row level security;

-- profiles: all authenticated users can read all profiles (roster + opt-in location).
-- Safe because profiles holds no PII — sensitive fields live in member_private.
create policy "admin_select_all"      on public.profiles for select using (public.is_admin());
create policy "member_select_all"     on public.profiles for select using (auth.uid() is not null);
create policy "admin_insert"        on public.profiles for insert with check (public.is_admin());
create policy "admin_update"        on public.profiles for update using (public.is_admin());
create policy "admin_delete"        on public.profiles for delete using (public.is_admin());

-- member_private: own row only for members; full access for admins/committee.
create policy "mp_select_own"   on public.member_private for select using (auth.uid() = id or public.is_admin());
create policy "mp_admin_insert" on public.member_private for insert with check (public.is_admin());
create policy "mp_admin_update" on public.member_private for update using (public.is_admin());
create policy "mp_admin_delete" on public.member_private for delete using (public.is_admin());

-- status_logs
create policy "admin_logs_insert" on public.status_logs for insert with check (public.is_admin());
create policy "admin_logs_select" on public.status_logs for select using (public.is_admin());
create policy "member_logs_own"   on public.status_logs for select using (auth.uid() = member_id);

-- rooms: all authenticated users can read; only admin can write
create policy "all_select_rooms"   on public.rooms for select using (auth.uid() is not null);
create policy "admin_insert_rooms" on public.rooms for insert with check (public.is_admin());
create policy "admin_update_rooms" on public.rooms for update using (public.is_admin());
create policy "admin_delete_rooms" on public.rooms for delete using (public.is_admin());

-- groups: all authenticated users can read; only admin can write
create policy "all_select_groups"  on public.groups for select using (auth.uid() is not null);
create policy "admin_write_groups" on public.groups for all using (public.is_admin()) with check (public.is_admin());

-- ── Realtime ────────────────────────────────────────────────
-- Run if supabase_realtime publication doesn't already include these tables:
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.rooms;
alter publication supabase_realtime add table public.groups;

-- ── Indexes ─────────────────────────────────────────────────
-- qr_token is indexed by its UNIQUE constraint on member_private (no extra index needed)
create index if not exists profiles_status_idx    on public.profiles(status);
create index if not exists profiles_bus_seat_idx  on public.profiles(bus_number, seat_number);
create index if not exists profiles_room_idx      on public.profiles(room_id);
create index if not exists logs_member_id_idx     on public.status_logs(member_id);

-- ── Migration (run only if adding to an existing deployment) ──
-- Step 1: create the rooms table first
-- create table if not exists public.rooms ( ... ); -- see above

-- Step 2: add new columns to profiles
-- alter table public.profiles
--   add column if not exists bus_number          int check (bus_number in (1, 2)),
--   add column if not exists seat_number         int check (seat_number between 1 and 31),
--   add column if not exists room_id             uuid references public.rooms(id) on delete set null,
--   add column if not exists latitude            float8,
--   add column if not exists longitude           float8,
--   add column if not exists location_sharing    boolean not null default false,
--   add column if not exists location_updated_at timestamptz,
--   add column if not exists has_seen_onboarding boolean not null default false,
--   add constraint profiles_bus_seat_unique unique (bus_number, seat_number);

-- Step 3: add new policies
-- create policy "member_select_all" on public.profiles for select using (auth.uid() is not null);
-- alter table public.rooms enable row level security;
-- create policy "all_select_rooms" on public.rooms for select using (auth.uid() is not null);
-- create policy "admin_insert_rooms" on public.rooms for insert with check (public.is_admin());
-- create policy "admin_update_rooms" on public.rooms for update using (public.is_admin());
-- create policy "admin_delete_rooms" on public.rooms for delete using (public.is_admin());
-- alter publication supabase_realtime add table public.rooms;

-- Step 4: add committee role support (run on existing deployments)
-- alter table public.profiles drop constraint profiles_role_check;
-- alter table public.profiles add constraint profiles_role_check check (role in ('admin', 'committee', 'member'));
-- create or replace function public.is_admin() returns boolean language sql security definer stable as $$ select exists (select 1 from public.profiles where id = auth.uid() and role in ('admin', 'committee')); $$;

-- Step 5: change default status to off_bus (run on existing deployments)
-- alter table public.profiles alter column status set default 'off_bus';

-- Step 6: split sensitive PII out of profiles into member_private (run on existing deployments)
-- Run this AS A SINGLE TRANSACTION. It preserves existing student_id / phone / qr_token.
-- begin;
--   create table if not exists public.member_private (
--     id          uuid primary key references public.profiles(id) on delete cascade,
--     student_id  text,
--     phone       text,
--     qr_token    uuid not null unique default gen_random_uuid()
--   );
--   -- copy existing values across (qr_token must move so existing printed QRs keep working)
--   insert into public.member_private (id, student_id, phone, qr_token)
--     select id, student_id, phone, qr_token from public.profiles
--   on conflict (id) do nothing;
--   alter table public.member_private enable row level security;
--   create policy "mp_select_own"   on public.member_private for select using (auth.uid() = id or public.is_admin());
--   create policy "mp_admin_insert" on public.member_private for insert with check (public.is_admin());
--   create policy "mp_admin_update" on public.member_private for update using (public.is_admin());
--   create policy "mp_admin_delete" on public.member_private for delete using (public.is_admin());
--   -- drop the now-migrated columns from the broadly-readable profiles table
--   drop index if exists public.profiles_qr_token_idx;
--   alter table public.profiles drop column student_id, drop column phone, drop column qr_token;
--   -- make the trigger seed member_private for future users
--   create or replace function public.handle_new_user()
--   returns trigger language plpgsql security definer set search_path = public as $$
--   begin
--     insert into public.profiles (id, full_name, role)
--     values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)), 'member');
--     insert into public.member_private (id) values (new.id) on conflict (id) do nothing;
--     return new;
--   end; $$;
-- commit;

-- Step 7: onboarding is now device-locked (localStorage), not per-user — drop the
-- unused flag (run on existing deployments):
-- alter table public.profiles drop column if exists has_seen_onboarding;

-- Step 8: groups registry so empty groups persist (run on existing deployments)
-- create table if not exists public.groups (
--   id uuid primary key default gen_random_uuid(),
--   name text not null unique,
--   created_at timestamptz not null default now()
-- );
-- insert into public.groups (name)
--   select distinct group_label from public.profiles where group_label is not null
--   on conflict (name) do nothing;
-- alter table public.groups enable row level security;
-- create policy "all_select_groups"  on public.groups for select using (auth.uid() is not null);
-- create policy "admin_write_groups" on public.groups for all using (public.is_admin()) with check (public.is_admin());
-- alter publication supabase_realtime add table public.groups;
