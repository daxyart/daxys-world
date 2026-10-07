-- Migration Supabase : confidentialité des publications et suivi entre membres.
-- Compatible avec la table posts déjà créée par account-community.sql.
alter table public.posts add column if not exists visibility text not null default 'public';
alter table public.posts drop constraint if exists posts_visibility_check;
alter table public.posts add constraint posts_visibility_check check (visibility in ('public', 'private'));

drop policy if exists "Public can read posts" on public.posts;
drop policy if exists "Everyone reads public posts and authors read their own" on public.posts;
create policy "Everyone reads public posts and authors read their own" on public.posts
  for select to anon, authenticated using (visibility = 'public' or (select auth.uid()) = author_id);

create table if not exists public.follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self_follow check (follower_id <> following_id)
);
create index if not exists follows_following_idx on public.follows (following_id);
alter table public.follows enable row level security;
revoke all on table public.follows from anon, authenticated;
grant select on table public.follows to anon, authenticated;
grant insert, delete on table public.follows to authenticated;

drop policy if exists "Anyone can view follows" on public.follows;
create policy "Anyone can view follows" on public.follows for select to anon, authenticated using (true);
drop policy if exists "Members follow as themselves" on public.follows;
create policy "Members follow as themselves" on public.follows for insert to authenticated
  with check ((select auth.uid()) = follower_id and follower_id <> following_id);
drop policy if exists "Members unfollow as themselves" on public.follows;
create policy "Members unfollow as themselves" on public.follows for delete to authenticated
  using ((select auth.uid()) = follower_id);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('private-posts', 'private-posts', false, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Members view their private post images" on storage.objects;
create policy "Members view their private post images" on storage.objects for select to authenticated
  using (bucket_id = 'private-posts' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists "Members upload their private post images" on storage.objects;
create policy "Members upload their private post images" on storage.objects for insert to authenticated
  with check (bucket_id = 'private-posts' and (storage.foldername(name))[1] = (select auth.uid()::text));
drop policy if exists "Members delete their private post images" on storage.objects;
create policy "Members delete their private post images" on storage.objects for delete to authenticated
  using (bucket_id = 'private-posts' and (storage.foldername(name))[1] = (select auth.uid()::text));
