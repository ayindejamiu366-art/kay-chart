// Shared profile-setup rules used by the routes, the auth responses and the
// tests. Kept in one place so the client can never be the only thing enforcing
// a rule that the database also has to agree with.
const db = require('./db.cjs');
const { PROFILE_SETUP_LAUNCHED_AT } = require('./db.cjs');

const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,20}$/;
const USERNAME_MAX = 20;

// Names that would be confusing or unsafe to hand out: they either collide with
// the product, the auth surface, or the routes the SPA serves.
const RESERVED_USERNAMES = new Set([
  'admin', 'administrator', 'root', 'superuser', 'staff', 'team', 'support',
  'help', 'security', 'moderator', 'nocturne', 'nocturnemusic', 'api', 'null',
  'undefined', 'anonymous', 'everyone', 'official', 'verified', 'me', 'you',
  'login', 'logout', 'signin', 'signup', 'sign-in', 'sign-up', 'signout',
  'account', 'accounts', 'settings', 'about', 'help', 'privacy', 'terms',
  'contact', 'support', 'legal', 'copyright', 'billing', 'payment', 'payments',
]);

const SETUP_STEPS = ['profile', 'genres', 'artists', 'personalization', 'summary'];

const COUNTRY_PATTERN = /^[A-Z]{2}$/;

function normalizeUsername(value) {
  return String(value == null ? '' : value).trim().toLowerCase();
}

/**
 * Validate a username against the public rules.
 * @returns {{ ok: true, username: string, normalized: string }
 *          | { ok: false, status: number, error: string }}
 */
function validateUsername(value) {
  const username = String(value == null ? '' : value).trim();

  if (!username) return { ok: false, status: 400, error: 'Username is required' };
  if (username.length > USERNAME_MAX) {
    return { ok: false, status: 400, error: `Username must be ${USERNAME_MAX} characters or fewer` };
  }
  if (/\s/.test(username)) {
    return { ok: false, status: 400, error: 'Username cannot contain spaces' };
  }
  if (!USERNAME_PATTERN.test(username)) {
    return {
      ok: false,
      status: 400,
      error: 'Username can only contain letters, numbers and underscores (3-20 characters)',
    };
  }

  const normalized = normalizeUsername(username);
  if (RESERVED_USERNAMES.has(normalized)) {
    return { ok: false, status: 400, error: 'That username is reserved' };
  }

  return { ok: true, username, normalized };
}

/**
 * Check whether a username can be claimed.
 *
 * `currentUsername` is the caller's own current username so that re-saving an
 * unchanged username reports as available instead of conflicting with itself.
 */
function checkUsernameAvailable(value, currentUsername) {
  const validated = validateUsername(value);
  if (!validated.ok) return validated;

  const currentNormalized = currentUsername ? normalizeUsername(currentUsername) : null;
  if (currentNormalized && currentNormalized === validated.normalized) {
    return { ok: true, username: validated.username, normalized: validated.normalized, available: true };
  }

  const taken = db.prepare('SELECT id FROM users WHERE username_normalized = ?').get(validated.normalized);
  if (taken) return { ok: false, status: 409, error: 'USERNAME_TAKEN' };

  return { ok: true, username: validated.username, normalized: validated.normalized, available: true };
}

function normalizeCountry(value) {
  const code = String(value == null ? '' : value).trim().toUpperCase();
  if (!code) return { ok: false, status: 400, error: 'Country is required' };
  if (!COUNTRY_PATTERN.test(code)) {
    return { ok: false, status: 400, error: 'Country must be a 2-letter code' };
  }
  return { ok: true, country: code };
}

/** Read the persisted wizard state for a user. Never throws on a missing prefs row. */
function readProfileState(userId) {
  const user = db.prepare('SELECT username, avatar, country, genres, selected_artists FROM users WHERE id = ?').get(userId);
  const prefs = db.prepare('SELECT profile_setup_completed, profile_setup_step FROM user_preferences WHERE user_id = ?').get(userId);

  const completed = !!(prefs && prefs.profile_setup_completed);
  let step = prefs && prefs.profile_setup_step && SETUP_STEPS.includes(prefs.profile_setup_step)
    ? prefs.profile_setup_step
    : 'profile';

  // Resume cannot land on a step the user has already finished.
  if (completed) step = 'summary';

  return {
    username: (user && user.username) || null,
    avatar: (user && user.avatar) || null,
    country: (user && user.country) || null,
    genres: parseJsonArray(user && user.genres),
    selectedArtists: parseJsonArray(user && user.selected_artists),
    profileSetupCompleted: completed,
    profileSetupStep: step,
  };
}

function parseJsonArray(value) {
  if (Array.isArray(value)) return value;
  if (typeof value !== 'string' || !value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/** Merge the profile-setup fields into an existing auth user payload. */
function withProfileState(user) {
  return { ...user, ...readProfileState(user.id) };
}

module.exports = {
  PROFILE_SETUP_LAUNCHED_AT,
  USERNAME_PATTERN,
  USERNAME_MAX,
  RESERVED_USERNAMES,
  SETUP_STEPS,
  normalizeUsername,
  validateUsername,
  checkUsernameAvailable,
  normalizeCountry,
  readProfileState,
  withProfileState,
  parseJsonArray,
};
