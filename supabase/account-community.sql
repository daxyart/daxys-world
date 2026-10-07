-- Exécuter une seule fois dans Supabase > SQL Editor > New query.
-- Ce script crée les profils publics, les publications et le bucket d'images.
-- Seules les colonnes publiques du profil sont exposées; les e-mails restent dans Auth.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default 'Membre' check (char_length(display_name) <= 60),
  bio text not null default '' check (char_length(bio) <= 300),
  avatar_url text,
  updated_at timestamptz not null default now()
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  body text not null default '' check (char_length(body) <= 1000),
  image_url text,
  created_at timestamptz not null default now(),
  constraint posts_have_content check (char_length(trim(body)) > 0 or image_url is not null)
);

create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_author_created_at_idx on public.posts (author_id, created_at desc);

alter table public.profiles enable row level security;
alter table public.posts enable row level security;

revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to anon, authenticated;
grant insert, update on table public.profiles to authenticated;

revoke all on table public.posts from anon, authenticated;
grant select on table public.posts to anon, authenticated;
grant insert, update, delete on table public.posts to authenticated;

drop policy if exists "Public profiles are visible" on public.profiles;
create policy "Public profiles are visible" on public.profiles
  for select to anon, authenticated using (true);
drop policy if exists "Members create their own profile" on public.profiles;
create policy "Members create their own profile" on public.profiles
  for insert to authenticated with check ((select auth.uid()) = id);
drop policy if exists "Members update their own profile" on public.profiles;
create policy "Members update their own profile" on public.profiles
  for update to authenticated using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

drop policy if exists "Public can read posts" on public.posts;
create policy "Public can read posts" on public.posts
  for select to anon, authenticated using (true);
drop policy if exists "Members publish as themselves" on public.posts;
create policy "Members publish as themselves" on public.posts
  for insert to authenticated with check ((select auth.uid()) = author_id);
drop policy if exists "Members edit their own posts" on public.posts;
create policy "Members edit their own posts" on public.posts
  for update to authenticated using ((select auth.uid()) = author_id)
  with check ((select auth.uid()) = author_id);
drop policy if exists "Members delete their own posts" on public.posts;
create policy "Members delete their own posts" on public.posts
  for delete to authenticated using ((select auth.uid()) = author_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('public-content', 'public-content', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Anyone can view community images" on storage.objects;
create policy "Anyone can view community images" on storage.objects
  for select to anon, authenticated using (bucket_id = 'public-content');
drop policy if exists "Members upload to their own folder" on storage.objects;
create policy "Members upload to their own folder" on storage.objects
  for insert to authenticated with check (
    bucket_id = 'public-content' and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
drop policy if exists "Members update files in their own folder" on storage.objects;
create policy "Members update files in their own folder" on storage.objects
  for update to authenticated using (
    bucket_id = 'public-content' and (storage.foldername(name))[1] = (select auth.uid()::text)
  ) with check (
    bucket_id = 'public-content' and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
drop policy if exists "Members delete files in their own folder" on storage.objects;
create policy "Members delete files in their own folder" on storage.objects
  for delete to authenticated using (
    bucket_id = 'public-content' and (storage.foldername(name))[1] = (select auth.uid()::text)
  );
