-- Daypad phase 1a: profiles, settings, lists, tasks and notes, locked down with Row Level Security.
--
-- Access model
--   * Signed-out visitors (anon) get nothing.
--   * Signed-in users (authenticated) can only read and write their own rows.
--   * Roles live on profiles and can only be changed by set_user_role(), which checks for a super admin.
--
-- Sync model (used by the app's sync engine, step 1c)
--   * updated_at: when the item was last edited, set by the device. The newest edit wins; an older write is
--     ignored instead of overwriting a newer one.
--   * server_updated_at: when the row last changed on the server, set here. Devices pull "everything changed since
--     my last sync" with it.
--   * deleted_at: soft delete, so deletes reach other devices; rows are purged 30 days later (next migration).

-- Types ------------------------------------------------------------------------------------------------------------

create type public.app_role as enum ('user', 'admin', 'super_admin');
create type public.task_priority as enum ('low', 'normal', 'high');

-- Tables -----------------------------------------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text check (char_length(display_name) <= 80),
  avatar_url text check (char_length(avatar_url) <= 2048),
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
comment on table public.profiles is 'One row per user. Users may edit display_name and avatar_url only.';

create table public.settings (
  user_id uuid primary key default auth.uid() references auth.users (id) on delete cascade,
  prefs jsonb not null default '{}'::jsonb
    check (jsonb_typeof(prefs) = 'object' and pg_column_size(prefs) <= 65536),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now()
);
comment on table public.settings is 'Synced app preferences (theme, colours, tour seen...) as one JSON object per user.';

create table public.lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 100),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  -- lets tasks reference (list, owner) together, so a task can never point at someone else's list
  unique (id, user_id)
);

create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  list_id uuid not null,
  title text not null check (char_length(title) between 1 and 500),
  done boolean not null default false,
  due_at timestamptz,
  tag text check (char_length(tag) <= 50),
  priority public.task_priority not null default 'normal',
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  foreign key (list_id, user_id) references public.lists (id, user_id) on delete cascade
);

create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  title text not null default '' check (char_length(title) <= 500),
  body text not null default '' check (char_length(body) <= 100000),
  calc jsonb check (calc is null or (jsonb_typeof(calc) = 'array' and pg_column_size(calc) <= 65536)),
  reminder_at timestamptz,
  pinned boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  server_updated_at timestamptz not null default now(),
  deleted_at timestamptz
);

-- "what changed since my last sync" lookups
create index lists_sync_idx on public.lists (user_id, server_updated_at);
create index tasks_sync_idx on public.tasks (user_id, server_updated_at);
create index notes_sync_idx on public.notes (user_id, server_updated_at);
create index tasks_list_idx on public.tasks (list_id, user_id);

-- Triggers ---------------------------------------------------------------------------------------------------------

-- Stamps server_updated_at, keeps device clocks from writing the future, and drops writes older than what's stored.
create function public.sync_stamp()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := least(new.updated_at, now() + interval '5 minutes');
  if tg_op = 'UPDATE' then
    if new.updated_at < old.updated_at then
      return null; -- an older edit arrived late: keep the newer row
    end if;
    if new.user_id is distinct from old.user_id then
      raise exception 'rows cannot change owner' using errcode = '42501';
    end if;
  end if;
  new.server_updated_at := now();
  return new;
end;
$$;

create trigger settings_sync_stamp before insert or update on public.settings
  for each row execute function public.sync_stamp();
create trigger lists_sync_stamp before insert or update on public.lists
  for each row execute function public.sync_stamp();
create trigger tasks_sync_stamp before insert or update on public.tasks
  for each row execute function public.sync_stamp();
create trigger notes_sync_stamp before insert or update on public.notes
  for each row execute function public.sync_stamp();

create function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- New sign-up: create the profile, empty settings and a first list called "Tasks".
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (
    new.id,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'), 80),
    left(new.raw_user_meta_data ->> 'avatar_url', 2048)
  );
  insert into public.settings (user_id) values (new.id);
  insert into public.lists (user_id, name) values (new.id, 'Tasks');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Roles ------------------------------------------------------------------------------------------------------------

-- The only way to change a role: the caller must be a super admin. (The first super admin is set by hand in SQL.)
create function public.set_user_role(target uuid, new_role public.app_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'super_admin') then
    raise exception 'only a super admin can change roles' using errcode = '42501';
  end if;
  update public.profiles set role = new_role where id = target;
end;
$$;

-- Row Level Security -----------------------------------------------------------------------------------------------

alter table public.profiles enable row level security;
alter table public.settings enable row level security;
alter table public.lists enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;

create policy "Read own profile" on public.profiles
  for select to authenticated using ((select auth.uid()) = id);
create policy "Edit own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create policy "Read own settings" on public.settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own settings" on public.settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Edit own settings" on public.settings
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);

create policy "Read own lists" on public.lists
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own lists" on public.lists
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Edit own lists" on public.lists
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own lists" on public.lists
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Read own tasks" on public.tasks
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own tasks" on public.tasks
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Edit own tasks" on public.tasks
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own tasks" on public.tasks
  for delete to authenticated using ((select auth.uid()) = user_id);

create policy "Read own notes" on public.notes
  for select to authenticated using ((select auth.uid()) = user_id);
create policy "Add own notes" on public.notes
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "Edit own notes" on public.notes
  for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "Delete own notes" on public.notes
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Grants: nothing is reachable from the app unless granted here ----------------------------------------------------

revoke all on public.profiles, public.settings, public.lists, public.tasks, public.notes from anon, authenticated;

grant select on public.profiles to authenticated;
grant update (display_name, avatar_url) on public.profiles to authenticated;
grant select, insert, update on public.settings to authenticated;
grant select, insert, update, delete on public.lists, public.tasks, public.notes to authenticated;

revoke all on function public.sync_stamp() from public, anon, authenticated;
revoke all on function public.touch_updated_at() from public, anon, authenticated;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_user_role(uuid, public.app_role) from public, anon;
grant execute on function public.set_user_role(uuid, public.app_role) to authenticated;
