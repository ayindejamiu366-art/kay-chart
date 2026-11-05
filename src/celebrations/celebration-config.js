/**
 * Celebration configuration.
 *
 * Themes, activation windows and priorities live here rather than inside the
 * detection code, so the look of a celebration can be tuned without touching
 * when it is active — and vice versa.
 *
 * Priorities are deterministic, never random. The highest-priority active
 * celebration becomes the primary visual theme; lower-priority ones remain
 * available to the UI. The default bands follow the scope hierarchy
 * (regional > country > global) but each entry can override the band, because
 * that ordering is not always the right one.
 */

export const PRIORITY = {
  regional: 100,
  country: 60,
  global: 10,
  // Observances are real celebrations but never outrank an actual public
  // holiday in the same country.
  observance: 30,
  // Global catch-all observances (Christmas, New Year) sit below everything so
  // a country's own public holiday wins the theme where one exists.
  globalObservance: 20,
};

/** Default activation window when a celebration does not define its own. */
export const DEFAULT_WINDOW_DAYS = 7;

/**
 * Named priority adjustments for specific celebrations.
 *
 * Kept here rather than in the shared window table because priority is a
 * Nocturne concept, not a property of the holiday data. Only needed where a
 * specific celebration would otherwise rank incorrectly.
 */
export const CELEBRATION_PRIORITY = {
  // A religious observance falling on a public-holiday date should not outrank
  // the national day itself.
  'eid-al-adha': 55,
  'eid-al-fitr': 55,
};

/**
 * Per-theme presentation. Colours are intentionally restrained: Nocturne's
 * identity is a near-black surface with a lime accent, and a celebration should
 * feel like the same product on a different day, not a different website.
 *
 * `intensity` is a small enum rather than a free number, so a celebration can be
 * dialled up or down without touching the effect code:
 *   'subtle'  — ambient wash and edge only, no particles
 *   'restrained' — a light particle field (the default for most)
 *   'expressive' — a fuller particle field, still capped
 *
 * `accent` and `glow` are CSS colour values injected as CSS custom properties
 * only — never as raw CSS text assembled from external input, and never as
 * inline style values derived from provider data.
 */
export const CELEBRATION_THEMES = {
  christmas: {
    label: 'Christmas',
    intensity: 'expressive',
    accent: '#EAF2FF',
    secondary: '#9FD0FF',
    glow: '0 0 22px rgba(159, 208, 255, 0.35)',
    particle: 'snow',
    particleCount: 26,
    ambience: 'aurora',
  },
  'new-year': {
    label: "New Year",
    intensity: 'expressive',
    accent: '#FFE8A3',
    secondary: '#FFC857',
    glow: '0 0 22px rgba(255, 200, 87, 0.35)',
    particle: 'spark',
    particleCount: 22,
    ambience: 'confetti',
  },
  halloween: {
    label: 'Halloween',
    intensity: 'restrained',
    accent: '#FFB067',
    secondary: '#C77DFF',
    glow: '0 0 22px rgba(255, 176, 103, 0.3)',
    particle: 'ember',
    particleCount: 20,
    ambience: 'mist',
  },
  valentines: {
    label: "Valentine's Day",
    intensity: 'restrained',
    accent: '#FF9EB5',
    secondary: '#FFC2D1',
    glow: '0 0 20px rgba(255, 158, 181, 0.3)',
    particle: 'heart',
    particleCount: 14,
    ambience: 'soft',
  },
  'mothers-day': {
    label: "Mother's Day",
    intensity: 'subtle',
    accent: '#F2C2E0',
    secondary: '#FFD9EC',
    glow: '0 0 20px rgba(242, 194, 224, 0.28)',
    particle: 'petal',
    particleCount: 14,
    ambience: 'soft',
  },
  'fathers-day': {
    label: "Father's Day",
    intensity: 'subtle',
    accent: '#8FB8E8',
    secondary: '#BBD6F2',
    glow: '0 0 20px rgba(143, 184, 232, 0.28)',
    particle: 'spark',
    particleCount: 12,
    ambience: 'soft',
  },
  'childrens-day': {
    label: "Children's Day",
    intensity: 'restrained',
    accent: '#FFD166',
    secondary: '#8AE7C8',
    glow: '0 0 20px rgba(255, 209, 102, 0.28)',
    particle: 'confetti',
    particleCount: 18,
    ambience: 'playful',
  },
  independence: {
    label: 'Independence Day',
    intensity: 'expressive',
    accent: '#7FD4FF',
    secondary: '#FF8FA3',
    glow: '0 0 22px rgba(127, 212, 255, 0.3)',
    particle: 'spark',
    particleCount: 24,
    ambience: 'flare',
  },
  eid: {
    label: 'Eid',
    intensity: 'restrained',
    accent: '#8FE3C4',
    secondary: '#FFE1A8',
    glow: '0 0 22px rgba(143, 227, 196, 0.32)',
    particle: 'star',
    particleCount: 20,
    ambience: 'soft',
  },
  labour: {
    label: 'Labour Day',
    intensity: 'restrained',
    accent: '#FF9E7D',
    secondary: '#FFD1BC',
    glow: '0 0 20px rgba(255, 158, 125, 0.28)',
    particle: 'spark',
    particleCount: 16,
    ambience: 'soft',
  },
  festive: {
    label: 'Celebration',
    intensity: 'restrained',
    accent: '#D6FF3D',
    secondary: '#9AD8FF',
    glow: '0 0 20px rgba(214, 255, 61, 0.22)',
    particle: 'spark',
    particleCount: 14,
    ambience: 'soft',
  },
};

/** Fallback theme when a celebration has no theme of its own. */
export const DEFAULT_THEME = 'festive';

/** Local dismissal key prefix, scoped per user so accounts do not share it. */
export const dismissalKey = (userId) => `nocturne_celebration_dismissed_${userId || 'guest'}`;