// Where every network call is sent.
//
// - Web, dev or production behind the same origin as the API: the relative
//   "/api" works untouched (Vite proxies it in dev, Express serves it in prod).
// - Native (Capacitor): the app is served from its own origin (https://localhost)
//   and there is no backend there, so a relative "/api" can never work. An
//   absolute URL is required.
//
//   Because that URL is baked in at build time, a user-entered override is
//   stored in localStorage and takes priority, so one installed build can be
//   pointed at a laptop on the LAN or at a deployed API without being rebuilt.
//
// Native detection reads the bridge the WebView already exposes instead of
// importing @capacitor/core. config.js is imported by the API client, so an
// import here is on the critical path of every screen; keeping it out means a
// plugin problem can never stop the app from booting.

const API_BASE_STORAGE_KEY = 'nocturne_api_base';

function isNative() {
  try {
    // Capacitor's web bridge exposes this global inside the native WebView.
    const bridge = typeof window !== 'undefined' ? window.Capacitor : null;
    if (!bridge) return false;
    if (typeof bridge.isNativePlatform === 'function') return Boolean(bridge.isNativePlatform());
    // Fall back to the platform string the bridge reports.
    const platform = bridge.getPlatform ? bridge.getPlatform() : bridge.platform;
    return platform === 'android' || platform === 'ios';
  } catch {
    return false;
  }
}

// Accepts "192.168.1.5:3001", "http://host:3001/api", "https://api.site.com"
// and normalises all of them into a usable base ending in "/api".
export function normaliseApiBase(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';
  const withScheme = /^https?:\/\//i.test(raw) ? raw : `http://${raw}`;
  let url;
  try {
    url = new URL(withScheme);
  } catch {
    return '';
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return '';
  const path = url.pathname.replace(/\/+$/, '');
  url.pathname = /\/api$/i.test(path) ? path : `${path}/api`;
  return url.toString().replace(/\/+$/, '');
}

function readStoredApiBase() {
  try {
    return localStorage.getItem(API_BASE_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

function readBuildTimeApiBase() {
  const configured = import.meta.env?.VITE_API_BASE_URL || '';
  // A relative value is only meaningful on the web.
  return configured.startsWith('/') ? '' : configured;
}

export const IS_NATIVE = isNative();

/**
 * True on a native build that has no reachable API address configured. The app
 * shows a "connect to your server" screen in this state rather than rendering a
 * shell that silently fails every request.
 */
export const NEEDS_API_BASE = IS_NATIVE && !readStoredApiBase() && !readBuildTimeApiBase();

export const API_BASE = readStoredApiBase() || readBuildTimeApiBase() || '/api';

/** Persists an override and reloads so every module picks up the new base. */
export function setApiBase(input) {
  const normalised = normaliseApiBase(input);
  if (!normalised) return false;
  try {
    localStorage.setItem(API_BASE_STORAGE_KEY, normalised);
  } catch {
    return false;
  }
  window.location.reload();
  return true;
}

export function clearApiBase() {
  try {
    localStorage.removeItem(API_BASE_STORAGE_KEY);
  } catch { /* nothing to clear */ }
}
