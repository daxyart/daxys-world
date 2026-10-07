-- Exécuter dans Supabase > SQL Editor. Migration idempotente pour données privées et forum public.

create table if not exists public.private_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  phone text not null default '' check (char_length(phone) <= 40),
  address_line1 text not null default '' check (char_length(address_line1) <= 160),
  address_line2 text not null default '' check (char_length(address_line2) <= 160),
  postal_code text not null default '' check (char_length(postal_code) <= 20),
  city text not null default '' check (char_length(city) <= 100),
  country text not null default '' check (char_length(country) <= 100),
  updated_at timestamptz not null default now()
);
alter table public.private_profiles enable row level security;
revoke all on table public.private_profiles from anon, authenticated;
grant select, insert, update on table public.private_profiles to authenticated;
drop policy if exists "Members read their private details" on public.private_profiles;
create policy "Members read their private details" on public.private_profiles for select to authenticated using ((select auth.uid()) = id);
drop policy if exists "Members add their private details" on public.private_profiles;
create policy "Members add their private details" on public.private_profiles for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "Members update their private details" on public.private_profiles;
create policy "Members update their private details" on public.private_profiles for update to authenticated using ((select auth.uid()) = id) with check ((select auth.uid()) = id);

create table if not exists public.forum_messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('design', 'tech', 'community')),
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);
create index if not exists forum_messages_created_at_idx on public.forum_messages (created_at desc);
create index if not exists forum_messages_category_created_at_idx on public.forum_messages (category, created_at desc);
alter table public.forum_messages enable row level security;
revoke all on table public.forum_messages from anon, authenticated;
grant select on table public.forum_messages to anon, authenticated;
grant insert on table public.forum_messages to authenticated;
drop policy if exists "Anyone can read forum messages" on public.forum_messages;
create policy "Anyone can read forum messages" on public.forum_messages for select to anon, authenticated using (true);
drop policy if exists "Members post as themselves in forum" on public.forum_messages;
create policy "Members post as themselves in forum" on public.forum_messages for insert to authenticated with check ((select auth.uid()) = sender_id);

-- Expose the author profile relationship to PostgREST for forum previews.
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'forum_messages_sender_profile_fkey' and conrelid = 'public.forum_messages'::regclass) then
    alter table public.forum_messages add constraint forum_messages_sender_profile_fkey foreign key (sender_id) references public.profiles(id) on delete cascade not valid;
  end if;
end $$;
notify pgrst, 'reload schema';
