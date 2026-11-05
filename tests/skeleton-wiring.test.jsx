/**
 * Static verification that each wired screen:
 *
 *  - gates its skeleton on a real loading state (not a timer),
 *  - checks the skeleton *before* its empty state, so "loading" is never
 *    mistaken for "empty",
 *  - does not re-arm that state during a background refresh,
 *  - and never renders placeholder text that could read as content.
 *
 * These read the source rather than mounting the screens: the screens need a
 * router, the app context and a live API, and a static assertion is what
 * actually pins the ordering and the absence of setTimeout.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const src = (name) => readFileSync(join(here, '..', 'src', ...name.split('/')), 'utf8');

/** Every screen touched by this task, and the state it keys off. */
const WIRED = [
  { file: 'screens/YourLibrary.jsx', state: 'collectionsLoading', skeleton: 'SkeletonLibraryList' },
  { file: 'screens/LikedSongs.jsx', state: 'collectionsLoading', skeleton: 'SkeletonTrackList' },
  { file: 'screens/Downloads.jsx', state: 'collectionsLoading', skeleton: 'SkeletonTrackList' },
  { file: 'screens/Notifications.jsx', state: 'collectionsLoading', skeleton: 'SkeletonTrackList' },
  { file: 'screens/ActivityFeed.jsx', state: 'loading', skeleton: 'SkeletonTrackList' },
];

/** Screens where a skeleton must NOT be introduced, and why. */
const UNCHANGED = [
  { file: 'screens/AlbumDetail.jsx', reason: 'synchronous local lookup' },
  { file: 'screens/ExploreGenres.jsx', reason: 'static module import' },
  { file: 'screens/AIDJ.jsx', reason: 'no initial request' },
];

describe('wired skeleton screens', () => {
  for (const { file, state, skeleton } of WIRED) {
    describe(file, () => {
      const code = src(file);

      it('renders a skeleton', () => {
        expect(code).toContain(skeleton);
      });

      it(`gates it on the real "${state}" state`, () => {
        expect(code).toMatch(new RegExp(`\\b${state}\\b`));
        // The skeleton branch itself must be conditioned on that state.
        expect(code).toMatch(new RegExp(`\\{[^}]*${state}[^}]*\\?`));
      });

      it('does not invent a loading state with a timer', () => {
        expect(code).not.toMatch(/setTimeout\([^)]*(hide|skeleton|loading)/i);
        // No fake-loading flag invented locally either.
        expect(code).not.toMatch(/const \[isFakeLoading|const \[fakeLoading/);
      });

      it('checks the skeleton before its empty state', () => {
        const skeletonAt = code.indexOf(skeleton);
        const emptyAt = Math.max(
          code.indexOf('.length === 0'),
          code.indexOf('length === 0'),
          code.indexOf('downloadedSongs.length'),
          code.indexOf('downloadGroups.length'),
          code.indexOf('feed.length'),
          code.indexOf('notifications.length'),
          code.indexOf('liked.length')
        );
        expect(skeletonAt).toBeGreaterThan(-1);
        if (emptyAt > -1) {
          expect(
            skeletonAt,
            'skeleton branch must be evaluated before the empty-state branch'
          ).toBeLessThan(emptyAt);
        }
      });

      it('imports its skeleton from the shared component directory', () => {
        expect(code).toMatch(/from '\.\.\/components\/skeleton'/);
      });
    });
  }

  it('keeps a pull-to-refresh from re-skeletonising the activity feed', () => {
    const code = src('screens/ActivityFeed.jsx');
    // `loading` is only set on mount; the refresh path uses `refreshing`.
    expect(code).toMatch(/setRefreshing\(true\)/);
    expect(code).toMatch(/await fetchData\(\);\s*\n\s*setRefreshing\(false\)/);
    // The refresh handler must not set the skeleton state.
    const handleRefresh = code.slice(code.indexOf('const handleRefresh'), code.indexOf('const toggleFollow'));
    expect(handleRefresh).not.toContain('setLoading(true)');
  });

  it('keeps a manual analytics refresh from replacing the dashboard', () => {
    const code = src('screens/Analytics.jsx');
    // The guard means a refresh with data already present skips the skeleton.
    expect(code).toContain('if (loading && !platform)');
  });

  it('ends the context loading state even when the request fails', () => {
    const code = src('hooks/useApp.jsx');
    // Cleared in `finally`, so an error cannot leave a skeleton on screen.
    expect(code).toMatch(/finally\s*\{[\s\S]{0,200}setCollectionsLoading\(false\)/);
  });

  it('never re-arms the context loading state after the first load', () => {
    const code = src('hooks/useApp.jsx');
    const armed = code.match(/setCollectionsLoading\(true\)/g) || [];
    expect(armed.length, 'the flag is initialised once via useState, never re-armed').toBe(0);
  });

  it('reserves the admin stat boxes without inventing numbers', () => {
    const code = src('screens/AdminPanel.jsx');
    expect(code).toContain('Skeleton width={38}');
    // The real counts still render once loaded.
    expect(code).toContain('stats.totalTracks');
    expect(code).toContain('stats.totalUsers');
    expect(code).toContain('stats.totalPending');
    // The authorization gate is untouched and still runs before rendering.
    expect(code.indexOf('if (!isAdmin)')).toBeGreaterThan(-1);
  });

  it('holds only the Now Playing artwork, not the playing track', () => {
    const code = src('screens/NowPlaying.jsx');
    // The empty state for "nothing playing" is preserved.
    expect(code).toContain('NOW_PLAYING_EMPTY_HEADING');
    // Artwork is the only skeletonised element.
    expect(code).toContain('Skeleton className="w-full h-full"');
    // Transport controls and playback calls are untouched.
    expect(code).toContain('togglePlay');
    expect(code).toContain('onSeek');
    // No page-level skeleton replacing a playing track.
    expect(code).not.toMatch(/<NowPlayingSkeleton/);
  });
});

describe('screens intentionally left unchanged', () => {
  for (const { file, reason } of UNCHANGED) {
    it(`${file} has no skeleton (${reason})`, () => {
      const code = src(file);
      expect(code).not.toMatch(/from '\.\.\/components\/skeleton'/);
      expect(code).not.toContain('[data-skeleton]');
      // And the reason is documented in the file for the next reader.
      expect(code).toMatch(/deliberately|no skeleton|No skeleton|no initial data request/i);
    });
  }
});
