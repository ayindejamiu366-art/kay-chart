# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click "New Project"
3. Enter project name: `nocturne-music`
4. Set a strong database password
5. Choose a region close to your users
6. Click "Create new project"

## 2. Get API Keys

1. In your project, go to **Settings > API**
2. Copy these values:
   - **Project URL** (e.g., `https://xxxx.supabase.co`)
   - **Anon public key** (starts with `eyJ...`)

3. Add to your `.env` file:
```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

## 3. Run Database Migration

1. In your project, go to **SQL Editor**
2. Click "New query"
3. Paste the contents of `migrations/001_initial_schema.sql`
4. Click "Run" to execute

This creates:
- `users` table (auto-populated on signup)
- `playlists` table
- `songs` table
- Row Level Security policies
- Storage bucket for media files

## 4. Enable Email Auth (Optional)

1. Go to **Authentication > Providers**
2. Enable **Email** provider
3. Configure email templates if needed

## 5. Enable Social Logins (Optional)

### Google
1. Go to **Authentication > Providers > Google**
2. Enable and add your Google OAuth credentials

### GitHub
1. Go to **Authentication > Providers > GitHub**
2. Enable and add your GitHub OAuth credentials

## 6. Storage Setup

The migration creates a `media` bucket automatically. To configure:

1. Go to **Storage**
2. Click on `media` bucket
3. Set file size limit (default 50MB)
4. Allowed MIME types: `audio/*`, `image/*`

## 7. Test the Connection

Run your app:
```bash
npm run dev
```

Check the browser console for any Supabase connection errors.

## Database Schema

### users
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Auth user ID |
| display_name | text | User's display name |
| email | text | User's email |
| avatar_url | text | Profile picture URL |
| role | text | 'user' or 'admin' |
| liked_songs | text[] | Array of liked song IDs |
| downloads | text[] | Array of downloaded song IDs |
| play_history | text[] | Array of played song IDs |

### playlists
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Playlist ID |
| user_id | uuid | Owner's user ID |
| name | text | Playlist name |
| description | text | Playlist description |
| songs | text[] | Array of song IDs |
| is_public | boolean | Public visibility |
| cover_url | text | Playlist cover image |

### songs
| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Song ID |
| title | text | Song title |
| artist | text | Artist name |
| album | text | Album name |
| genre | text | Genre category |
| duration | integer | Duration in seconds |
| audio_url | text | Audio file URL |
| cover_url | text | Cover image URL |
| uploaded_by | uuid | Uploader's user ID |
| plays | integer | Play count |

## Useful SQL Queries

### Get user profile
```sql
select * from public.users where id = auth.uid();
```

### Get user playlists
```sql
select * from public.playlists where user_id = auth.uid() order by created_at desc;
```

### Search songs
```sql
select * from public.search_songs('search term');
```

### Get popular songs
```sql
select * from public.songs order by plays desc limit 20;
```