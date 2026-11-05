-- ============================================
-- Nocturne App - Supabase Schema
-- Run this in Supabase SQL Editor
-- ============================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ============================================
-- USERS TABLE
-- ============================================
create table public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  email text unique,
  avatar_url text,
  role text default 'user' check (role in ('user', 'admin')),
  liked_songs text[] default '{}',
  downloads text[] default '{}',
  play_history text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-create user profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, display_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'avatar_url', null)
  );
  return new;
end;
$$ language plpgsql security definer;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================
-- PLAYLISTS TABLE
-- ============================================
create table public.playlists (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null,
  description text default '',
  songs text[] default '{}',
  is_public boolean default false,
  cover_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_playlists_user_id on public.playlists(user_id);

-- ============================================
-- SONGS TABLE
-- ============================================
create table public.songs (
  id uuid primary key default uuid_generate_v4(),
  title text not null,
  artist text not null,
  album text default '',
  genre text default '',
  duration integer default 0,
  audio_url text not null,
  cover_url text default '',
  uploaded_by uuid references public.users(id) on delete set null,
  plays integer default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_songs_genre on public.songs(genre);
create index idx_songs_artist on public.songs(artist);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS
alter table public.users enable row level security;
alter table public.playlists enable row level security;
alter table public.songs enable row level security;

-- USERS policies
create policy "Users can view own profile"
  on public.users for select
  using (auth.uid() = id);

create policy "Users can update own profile"
  on public.users for update
  using (auth.uid() = id);

create policy "Admin can view all users"
  on public.users for select
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- PLAYLISTS policies
create policy "Anyone can view public playlists"
  on public.playlists for select
  using (is_public = true);

create policy "Users can view own playlists"
  on public.playlists for select
  using (auth.uid() = user_id);

create policy "Users can create playlists"
  on public.playlists for insert
  with check (auth.uid() = user_id);

create policy "Users can update own playlists"
  on public.playlists for update
  using (auth.uid() = user_id);

create policy "Users can delete own playlists"
  on public.playlists for delete
  using (auth.uid() = user_id);

-- SONGS policies
create policy "Anyone can view songs"
  on public.songs for select
  using (true);

create policy "Admin can insert songs"
  on public.songs for insert
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admin can update songs"
  on public.songs for update
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "Admin can delete songs"
  on public.songs for delete
  using (
    exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================
-- STORAGE BUCKETS
-- ============================================

insert into storage.buckets (id, name, public)
values ('media', 'media', true)
on conflict (id) do nothing;

-- Storage policies
create policy "Anyone can view media"
  on storage.objects for select
  using (bucket_id = 'media');

create policy "Authenticated users can upload media"
  on storage.objects for insert
  with check (
    bucket_id = 'media'
    and auth.role() = 'authenticated'
  );

create policy "Users can update own media"
  on storage.objects for update
  using (
    bucket_id = 'media'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "Admin can delete media"
  on storage.objects for delete
  using (
    bucket_id = 'media'
    and exists (
      select 1 from public.users
      where id = auth.uid() and role = 'admin'
    )
  );

-- ============================================
-- FUNCTIONS
-- ============================================

-- Function to increment play count
create or replace function public.increment_play_count(song_id uuid)
returns void as $$
begin
  update public.songs
  set plays = plays + 1
  where id = song_id;
end;
$$ language plpgsql security definer;

-- Function to search songs
create or replace function public.search_songs(search_query text)
returns setof public.songs as $$
begin
  return query
  select *
  from public.songs
  where
    title ilike '%' || search_query || '%'
    or artist ilike '%' || search_query || '%'
    or album ilike '%' || search_query || '%'
  order by plays desc;
end;
$$ language plpgsql security definer;