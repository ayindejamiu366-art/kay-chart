/**
 * First-time onboarding configuration.
 *
 * Copy here describes only features that actually exist in the Nocturne app
 * today. Notably there is NO listening-history screen (only login history and a
 * "Recently Played" rail on Home), so no step claims one.
 *
 * Tour targets are resolved by `data-tour="<key>"` attributes rather than by
 * route, because the same destination is rendered by two different components:
 * AppSidebar on desktop and BottomNav on mobile. Both carry the same key and the
 * tour picks whichever one is actually visible.
 */

// Per-user storage key. Scoped to the user id so one account's completion can
// never affect another account on the same browser.
export const onboardingStorageKey = (userId) => `nocturne_onboarding_${userId}`;

export const TOUR_STEPS = [
  {
    id: 'home',
    icon: 'home',
    target: 'home',
    title: 'Your Home',
    description:
      'Start here. See trending music, new releases, genres, artists worth knowing, and a quick-pick row built around what you play.',
  },
  {
    id: 'search',
    icon: 'search',
    target: 'search',
    title: 'Find your music',
    description:
      'Search for songs, artists and albums, then filter the results to jump straight to what you are after.',
  },
  {
    id: 'discover',
    icon: 'explore',
    target: 'discover',
    title: 'Discover something new',
    description:
      'Browse genres and moods, check the live charts, and stumble onto artists you have not heard before.',
  },
  {
    id: 'player',
    icon: 'graphic_eq',
    target: 'player',
    title: 'Your music player',
    description:
      'Play, pause and skip tracks, queue up what plays next, follow synced lyrics, and open the full Now Playing screen.',
  },
  {
    id: 'library',
    icon: 'library_music',
    target: 'library',
    title: 'Your space',
    description:
      'Keep playlists and liked songs, download tracks for offline listening, and manage your account, security and preferences in Profile.',
  },
  {
    id: 'done',
    icon: 'auto_awesome',
    target: null,
    title: "You're all set",
    description:
      'You are ready to explore Kay Chart. Find something you love and start listening.',
  },
];

// Maps a nav destination to its tour key. Imported by AppSidebar and BottomNav so
// both nav surfaces stay in sync with the tour.
export const TOUR_KEY_BY_PATH = {
  '/home': 'home',
  '/search': 'search',
  '/explore': 'discover',
  '/library': 'library',
  '/profile': 'profile',
  '/charts': 'charts',
  '/liked-songs': 'library',
};

// Routes that must never show the tour. The profile setup wizard runs first and
// owns the whole first-run experience; the legacy genre and artist pickers are
// still registered but are no longer part of the new-user path. The auth
// screens have no app shell to spotlight.
export const ONBOARDING_BLOCKED_ROUTES = new Set([
  '/',
  '/splash',
  '/welcome',
  '/sign-in',
  '/sign-up',
  '/verify-otp',
  '/forgot-password',
  '/profile-setup',
  '/select-genres',
  '/select-artists',
  '/edit-profile',
]);

export const isOnboardingRoute = (pathname) => !ONBOARDING_BLOCKED_ROUTES.has(pathname);

// Small delay so the tour does not fight the route transition animation that
// plays as a screen settles.
export const WELCOME_DELAY_MS = 700;
