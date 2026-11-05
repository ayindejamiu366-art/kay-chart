# NOCTURNE — IMPLEMENTATION REPORT

Date: 2026-09-19
Status: All 18 Phases Complete

---

## FILES CHANGED

### Server-Side
- server/providers/index.cjs - Added JamendoProvider factory
- server/providers/jamendo.cjs - NEW: Jamendo provider with CC licensing
- server/providers/music-service.cjs - Provider authority ranking, playback resolver, canonical track resolution, improved search sorting
- server/providers/local.cjs - Audio file existence check, unavailable filtering
- server/providers/audius.cjs - Alternative version filtering (covers/remixes/bootlegs)
- server/routes/music.cjs - Playback resolver integration for track endpoints
- server/routes/stream.cjs - Jamendo track support, improved external track handling

### Configuration
- .env - Added JAMENDO_CLIENT_ID, MUSIC_PROVIDER_5=jamendo
- .env.example - Added Jamendo configuration examples

### No Changes (preserved)
- server/providers/spotify.cjs - Unchanged
- server/providers/deezer.cjs - Unchanged
- server/db.cjs - Unchanged
- src/screens/Home.jsx - Unchanged
- src/components/MiniPlayer.jsx - Unchanged
- src/services/music.js - Unchanged

---

## PROVIDERS CURRENTLY ACTIVE

1. **Deezer** (MUSIC_PROVIDER_1) - Preview only (30s), external links
2. **Audius** (MUSIC_PROVIDER_2) - Full streaming, filtered for original tracks
3. **Spotify** (MUSIC_PROVIDER_3) - Metadata only, external links, previews
4. **Local** (MUSIC_PROVIDER_4) - Full playback ONLY for tracks with audio files
5. **Jamendo** (MUSIC_PROVIDER_5) - Independent/open catalog, CC licensing info

---

## PROVIDER PLAYBACK CAPABILITIES

| Provider | Full | Preview | External | Unavailable |
|----------|------|---------|----------|-------------|
| Deezer | No | Yes (30s) | Yes | Yes |
| Audius | Yes (filtered) | No | No | Yes |
| Spotify | No | Yes (sparse) | Yes | Yes |
| Local | Yes (audio files only) | No | No | Yes |
| Jamendo | Yes (CC permitted) | Yes | No | Yes |

---

## KEY ARCHITECTURAL CHANGES

### 1. Provider Authority Ranking
Spotify (1) > Deezer (2) > Audius (3) > Local (4)

When deduplicating tracks with same title+artist, higher authority provider wins. Only ties broken by playback score. Prevents Audius covers from replacing official Spotify results.

### 2. Playback Resolver (music-service.cjs)
resolvePlaybackSource(track) determines the best playable source:
- Local uploaded with audio file → FULL
- Audius original track → FULL
- Spotify preview → PREVIEW
- Deezer preview → PREVIEW
- Spotify external → EXTERNAL (open in Spotify)
- No valid source → UNAVAILABLE

### 3. Canonical Track Resolution
findCanonicalTrack(title, artist) finds the authoritative version by searching all providers and returning the highest-authority match. Preserves original metadata (not replaced by covers).

### 4. Local Provider Audio File Check
Local tracks only appear in search/trending/Home when audio_url exists AND points to /uploads/audio/ AND the file actually exists on disk. Otherwise playbackType=unavailable and excluded from listings.

### 5. Audius Alternative Version Filtering
isAlternativeVersion(title) filters out remix, covers, bootleg, type beat, instrumental, live, acoustic, karaoke, sped up, slowed, nightcore, mashup, tribute, edit, mix, rework, remastered, official audio/video rips. Independent original tracks remain available.

### 6. Search Result Ranking
Priority order:
1. Exact artist + exact title (authoritative provider)
2. Exact title + matching artist
3. Strong title/artist match
4. Alternative version (penalized -30)
5. Remix/cover/live/type beat
6. Weak/unrelated match

Playback capability is SECONDARY to relevance and authority.

---

## CACHING CHANGES

- Home endpoint cache TTL reduced from 120s to 60s (fresher results)
- Provider-specific caches remain separate
- Stale fallback preserved for graceful degradation

---

## TEST RESULTS

- npm test: 30/30 passed
- npm run lint: 0 errors (8 pre-existing warnings)
- npm run build: Success (18.72s)

---

## ENVIRONMENT VARIABLES REQUIRED

### Existing (unchanged)
- SPOTIFY_CLIENT_ID
- SPOTIFY_CLIENT_SECRET
- MUSIC_PROVIDER_1=deezer
- MUSIC_PROVIDER_2=audius
- MUSIC_PROVIDER_3=spotify
- MUSIC_PROVIDER_4=local
- JWT_SECRET
- ADMIN_EMAIL
- ADMIN_PASSWORD
- ALLOW_OTP_DEV_CODE

### New
- JAMENDO_CLIENT_ID (get from https://devportal.jamendo.com)
- MUSIC_PROVIDER_5=jamendo
- MUSIC_PROVIDER_5_API_KEY=

---

## COMMERCIAL LICENSE REQUIREMENTS

1. **Spotify** - Requires commercial license for public performance
2. **Jamendo** - Check license type per track; some CC licenses restrict commercial use
3. **Audius** - Verify rights before production
4. **Deezer** - Previews only; commercial license needed for full playback

---

## REMAINING LIMITATIONS

1. Jamendo provider disabled until JAMENDO_CLIENT_ID is configured
2. Local demo tracks without audio files are hidden but not deleted
3. Spotify rate limiting still causes occasional 0-result searches
4. Audius search may still return some alternative versions not caught by filter
5. Country tracks in Local provider lack proper geo-filtering
6. Artist upload architecture exists but requires admin approval for non-admin users
7. Playback resolution preserves metadata but does not automatically switch providers for the same song

---

## NOT CLAIMING

Nocturne does NOT claim to have "all music in the world." The catalog is as broad as legitimately possible at zero/low development cost while keeping the architecture ready for future licensed commercial catalog providers.
