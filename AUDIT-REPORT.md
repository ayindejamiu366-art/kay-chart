# NOCTURNE MUSIC SUPPLY AUDIT REPORT

Date: 2026-09-19
Status: AUDIT + ARCHITECTURE ONLY - No code changes

---

## A. PROVIDER STATUS (Live API)

All 4 providers currently HEALTHY (live health check passes):

| Provider  | Response | Full | Preview | External | DB Reqs | DB Fails |
|-----------|----------|------|---------|----------|---------|----------|
| Deezer    | 1177ms   | No   | Yes 30s | Yes      | 1514    | 87 5.7%  |
| Audius    | 2019ms   | Yes  | Yes     | No       | 2152    | 113 5.3% |
| Spotify   | 698ms    | No   | Yes*    | Yes      | 1472    | 99 6.7%  |
| Local     | 0ms      | Yes  | No      | No       | 1665    | 0 0%     |

*Spotify preview only available on some tracks.

DB health status shows "failed" for deezer/audius/spotify but live check passes.
Circuit breaker uses 5min reset timeout. DB status only updated on failure, never on recovery.

---

## B. DATABASE INVENTORY

- 50 songs (all status=approved)
- 16 artists
- 27 albums
- 8 genres: Afrobeats, Amapiano, Chill Vibe, Classical, EDM, Pop, Tamil Hits, UK Rap
- 0 cache entries
- ALL 50 tracks are seed/demo content - real artist metadata but NO actual audio files

---

## C. PROVIDER BEHAVIOR (Live Search Results)

Search for "Blinding Lights":
  Local: 1 result - "Blinding Lights" by The Weeknd - EXACT MATCH, full playback
  Audius: 1 result - "BLINDING LIGHTS" by XX PHATZ - COVER, full playback
  Deezer: 3 results - Emily Dawn, Loi, Pablo Cepeda - NOT The Weeknd, preview only
  Spotify: 0 results

Search for "Drake":
  Audius: 4 results - camoufly, Tanaya, super_tyte, OceanSkies - ALL covers/remixes
  Local: 1 result - "Come Closer" feat. Drake by Wizkid
  Others: 0 results

Search for "The Weeknd":
  Audius: 5 results - EDMWorld, DJ-M, BEECH, Juginz, Maison Ware - ALL covers/remixes
  Others: 0 results

Search for "Taylor Swift":
  Audius: 5 results - @davidjonnes099 uploads - unofficial rips from YouTube
  Others: 0 results

Search for "Beyonce":
  Audius: 5 results - beargatsby, Pollie Pop, DripKinG - remixes/edits
  Others: 0 results

Search for "Tems":
  Audius: 2 results - Abiodun Jamiu uploads - unofficial rips
  Spotify: 3 results - Dave/Tems, Wizkid/Tems Essence, Future/Drake/Tems - metadata only
  Others: 0 results

Search for "Wizkid":
  Audius: 4 results - Emmanuel, Latel Lulu, Adedamz1, Vybz Kartel - unofficial uploads
  Spotify: 1 result - Gunna/Wizkid - metadata only
  Others: 0 results

Search for "Bad Bunny":
  Audius: 5 results - smol.bean, Crypto Ravers, Alonso Coronel, PROPPAGANDA, STEPHO - ALL remixes
  Others: 0 results

---

## D. PROVIDER MERGING AND DEDUP ANALYSIS

Dedup Logic (music-service.cjs:52-80):
- Key: normalized title_artist (lowercase, strip non-alphanumeric)
- Priority: playbackScore (full=3 > preview=2 > external=1 > 0)
- When scores tie: keeps first occurrence (provider order: deezer, audius, spotify, local)
- Local Blinding Lights by The Weeknd (full) and Audius BLINDING LIGHTS by XX PHATZ (full) are different artist so NOT deduped

Search Relevance Scoring (music-service.cjs:109-161):
- Title match: exact=80, starts-with=65, contains=50, fuzzy=30
- Artist match: exact=25, contains=15, fuzzy=8
- Alt-version penalty: -30 (remix, cover, live, etc.)
- Playback bonus: +3 full, +2 preview, +1 external
- The Weeknds Blinding Lights scores highest (80+25+3=108), correctly ranked #1

Home Endpoint (music-service.cjs:411-437):
- Calls getTrendingTracks(30) which requests 90 tracks per provider
- Filters to playbackType=full only, returns 15 tracks
- Current result: trending=15 ALL from Local provider (stale cache)
- popular=10 ALL from Audius
- previewTracks=0

Country Tracks (/api/music/country/NG):
- Local provider returns ALL 50 tracks for any country (no country filtering)

---

## E. AUDIUS PROVIDER DEEP DIVE

Audius is a user-generated music platform (like SoundCloud).

What Audius actually returns for major artists:
  "Blinding Lights" -> XX PHATZ cover
  "Drake" -> camoufly remix, Tanaya, super_tyte, OceanSkies - all covers
  "The Weeknd" -> EDMWorld, DJ-M, BEECH, Juginz, Maison Ware - all covers
  "Taylor Swift" -> @davidjonnes099 - YouTube rips
  "Beyonce" -> beargatsby, Pollie Pop, DripKinG - remixes
  "Bad Bunny" -> smol.bean, Crypto Ravers, Alonso Coronel - remixes

Key finding: Audius does NOT have official releases from major labels.
It has covers, remixes, bootleg edits, type beats, and user-uploaded content.
Some legitimate independent artists exist but not the ones users search for.
Full playback works via https://api.audius.co/v1/tracks/{id}/stream

---

## F. SPOTIFY PROVIDER DEEP DIVE

Spotify returns metadata only (supportsFullTracks=false).

Known issue: Spotify rate limits aggressively. Many searches return 0 results.
When results appear, they include:
- preview_url (30s clip, only ~30% of tracks have this)
- external_url (link to open.spotify.com)
- NO streamable audio

Spotify credentials are configured in .env:
  SPOTIFY_CLIENT_ID=fdb8e0f1d7744a50a65b56d82874a587
  SPOTIFY_CLIENT_SECRET=5eb3c88c779244f585dd7ae192210a07

Spotify search uses market=US which limits non-US content.

---

## G. DEEZER PROVIDER DEEP DIVE

Deezer provides 30-second previews with external links to deezer.com.
No authentication required.
Rate limit: appears to be ~50 requests/5 minutes.

Deezer search for "Blinding Lights" returned covers by Emily Dawn, Loi, Pablo Cepeda.
NOT the original Weeknd track. This suggests Deezer search ranking
deprioritizes the exact match or the API returns by relevance differently.

Deezer trending uses chart endpoint (chart 0 / tracks) which returns
actual popular tracks, but only as 30s previews.

---

## H. LOCAL PROVIDER ISSUES

1. NO AUDIO FILES: All 50 seed tracks have real metadata (title, artist, cover)
   but audio_url values point to /uploads/audio/ paths that do not exist.
   Playing any local track will 404.

2. getTracksByCountry() just calls getTrendingTracks() - no country filtering.
   All 50 tracks appear for every country.

3. getPopularTracks() just calls getTrendingTracks() - no popularity logic.
   Ordered by play_counts which are all 0.

4. The local provider dominates Home trending because it always returns
   50 tracks with playbackType=full (score 3), while external providers
   are intermittent due to rate limits and circuit breakers.

---

## I. CRITICAL FINDINGS AND RECOMMENDATIONS

### Why the app feels like a demo:

1. AUDIUS = SOUNDCLOUD ALTERNATIVE
   Audius returns covers, remixes, and bootlegs for every major artist.
   Users searching for "The Weeknd" get "THE WEEKND ARIANA GRANDE" by EDMWorld.
   This is the single biggest quality problem.

2. SPOTIFY = METADATA ONLY
   Spotify returns correct metadata but no playable audio (except sparse previews).
   Rate limiting causes frequent 0-result searches.

3. DEEZER = 30S PREVIEWS OF WRONG TRACKS
   Deezer search returns covers/remixes, not originals.
   Even when originals appear, only 30s previews play.

4. LOCAL = BROKEN SEED DATA
   50 seed tracks with no audio files. They appear in results but can't play.

5. HOME IS INCONSISTENT
   Depending on cache timing, Home shows either all Local or all Audius tracks.
   No mix of providers. No Spotify previews. No Deezer previews.

6. COUNTRY = FAKE
   Local returns all 50 tracks for every country. No real geo-filtering.

### What would fix it:

1. Audius: Filter results to exclude tracks with remix/cover/bootleg indicators
   OR reduce Audius weight in dedup when better providers exist.

2. Spotify: Consider Spotify Connect / embedded player integration
   rather than trying to stream audio directly.

3. Deezer: Search quality issue needs investigation - why doesn't it return
   the original track for major artists?

4. Local: Either populate audio files for seed tracks or remove them
   from search/trending results.

5. Home: Mix trending from multiple providers instead of all-from-one.
   Add Spotify/Deezer preview tracks to "Fresh Discoveries" section.

6. Circuit breaker: Update DB health status on success too, not just failure.
   This explains why DB shows "failed" when providers are actually working.
