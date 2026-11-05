// Runtime translation service — translates English UI strings to any language
// Uses server-side proxy for reliable translation

import { API_BASE } from '../config';

const CACHE_PREFIX = 'nocturne_i18n_';
const CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

// Languages that have local translation files
const LOCAL_LANGS = ['en', 'ar', 'es', 'fr', 'hi', 'ta'];

function getCached(lang) {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + lang);
    if (!raw) return null;
    const { ts, data } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) {
      localStorage.removeItem(CACHE_PREFIX + lang);
      return null;
    }
    return data;
  } catch { return null; }
}

function setCache(lang, data) {
  try {
    localStorage.setItem(CACHE_PREFIX + lang, JSON.stringify({ ts: Date.now(), data }));
  } catch { /* localStorage unavailable */ }
}

// Translate English keys via server-side proxy
async function serverTranslate(keys, targetLang) {
  const url = `${API_BASE}/translate`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keys, targetLang }),
    signal: AbortSignal.timeout(30000),
  });
  
  if (!res.ok) throw new Error(`Translation proxy ${res.status}`);
  const data = await res.json();
  return data.translations || {};
}

// Build a translation dictionary from English keys
export async function translateDictionary(targetLang, englishKeys) {
  if (targetLang === 'en') return {};
  if (LOCAL_LANGS.includes(targetLang)) return null; // Has local file

  // Check cache first
  const cached = getCached(targetLang);
  if (cached && Object.keys(cached).length > 0) return cached;

  try {
    const translated = await serverTranslate(englishKeys, targetLang);
    if (Object.keys(translated).length > 0) {
      setCache(targetLang, translated);
      return translated;
    }
  } catch (e) {
    console.warn('Translation failed:', e.message);
  }

  return null;
}

export function hasLocalTranslation(lang) {
  return LOCAL_LANGS.includes(lang);
}

export function clearTranslationCache(lang) {
  try {
    if (lang) {
      localStorage.removeItem(CACHE_PREFIX + lang);
    } else {
      const keys = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) keys.push(key);
      }
      keys.forEach(k => localStorage.removeItem(k));
    }
  } catch { /* localStorage unavailable */ }
}
