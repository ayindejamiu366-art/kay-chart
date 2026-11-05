import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../hooks/useApp';
import api from '../services/api';
import { prefersReduced } from '../utils/gsap';
import {
  getActiveCelebrations,
  pickPrimaryCelebration,
} from '../celebrations/celebration-engine';
import { todayIso, isValidIso, describeCelebration } from '../celebrations/celebration-utils';
import { CELEBRATION_THEMES, dismissalKey } from '../celebrations/celebration-config';

const CelebrationContext = createContext(null);

const STORAGE_KEY = 'nocturne_celebrations_cache';
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;

/**
 * Cached provider data, so a failed request still leaves the app with real
 * holiday data rather than falling straight back to local rules.
 *
 * Stored per country: a listener who changes country must not see the previous
 * country's calendar.
 */
function readCache(countryCode) {
  try {
    const raw = localStorage.getItem(`${STORAGE_KEY}_${countryCode || 'none'}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.celebrations)) return null;
    if (Date.now() - (parsed.at || 0) > CACHE_TTL_MS) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(countryCode, celebrations) {
  try {
    localStorage.setItem(`${STORAGE_KEY}_${countryCode || 'none'}`, JSON.stringify({ at: Date.now(), celebrations }));
  } catch { /* private mode — the local rules still apply */ }
}

/**
 * Supplies the celebration state for the whole application.
 *
 * Rendering rules that keep this cheap and safe:
 *  - The external API is called at most once per country per session; after that
 *    the client recomputes from cached data.
 *  - The active set is recomputed from a local date, not a server date, so the
 *    window opens and closes in the listener's own evening.
 *  - Nothing here throws: a failed request or unexpected payload leaves the app
 *    on its normal theme.
 */
export function CelebrationProvider({ children }) {
  const { user, authChecked } = useApp();
  const countryCode = (user?.country || '').toUpperCase();

  // Recomputed on the local date. Held in a ref so the midnight tick handler can
  // read the current value without re-subscribing.
  const [date, setDate] = useState(() => todayIso());
  const [providerCelebrations, setProviderCelebrations] = useState(null);
  const [source, setSource] = useState('local');
  const [dismissedIds, setDismissedIds] = useState([]);
  const [bannerDismissed, setBannerDismissed] = useState(false);

  const requestedCountry = useRef(null);

  // Fetch provider data at most once per country.
  //
  // Gated on `authChecked` so the request is not issued twice: on first paint
  // the profile has not loaded yet, so `countryCode` is still '' and would fetch
  // the global-only calendar, then fetch again a moment later once the real
  // country arrives. Waiting for auth to settle means one correctly-scoped
  // request instead of a wasted one followed by a real one.
  useEffect(() => {
    if (!authChecked) return;
    if (requestedCountry.current === countryCode) return;
    requestedCountry.current = countryCode;

    const cached = readCache(countryCode);
    if (cached) {
      setProviderCelebrations(cached.celebrations);
      setSource('cache');
    }

    let cancelled = false;
    api.getActiveCelebrations({ date: todayIso(), countryCode })
      .then((result) => {
        if (cancelled) return;
        // Keep the whole year's data so the engine can work locally later.
        if (Array.isArray(result?.all) && result.all.length) {
          setProviderCelebrations(result.all);
          writeCache(countryCode, result.all);
          setSource('api');
        }
      })
      .catch(() => {
        // Provider unavailable: cached data (if any) or the local rules stand in.
        setSource(cached ? 'cache' : 'local');
      });

    return () => { cancelled = true; };
  }, [countryCode, authChecked]);

  // Re-evaluate when the local day changes, so a window that opens at midnight
  // appears without needing a reload. Checked on an interval rather than by
  // timer to stay correct across sleep/wake and timezone changes.
  useEffect(() => {
    const tick = () => {
      const now = todayIso();
      setDate(prev => (prev === now ? prev : now));
    };
    const id = setInterval(tick, 60 * 1000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  // Dismissal is per user so one account's choice never affects another.
  useEffect(() => {
    try {
      const raw = localStorage.getItem(dismissalKey(user?.id));
      setDismissedIds(raw ? JSON.parse(raw) : []);
    } catch {
      setDismissedIds([]);
    }
  }, [user?.id]);

  const dismissCelebration = useCallback((id) => {
    setDismissedIds(prev => {
      const next = prev.includes(id) ? prev : [...prev, id];
      try {
        localStorage.setItem(dismissalKey(user?.id), JSON.stringify(next));
      } catch { /* ignore */ }
      return next;
    });
  }, [user?.id]);

  const { active, primary } = useMemo(() => {
    const all = getActiveCelebrations({
      countryCode,
      date: isValidIso(date) ? date : todayIso(),
      celebrations: providerCelebrations,
    });
    const visible = all.filter(c => !dismissedIds.includes(c.id));
    const today = isValidIso(date) ? date : todayIso();
    return { active: visible, primary: pickPrimaryCelebration(visible, today) };
  }, [countryCode, date, providerCelebrations, dismissedIds]);

  const value = useMemo(() => {
    const theme = primary ? (CELEBRATION_THEMES[primary.theme] ? primary.theme : 'festive') : null;
    return {
      activeCelebrations: active,
      primaryCelebration: primary,
      isCelebrationActive: !!primary,
      theme,
      themeValues: theme ? CELEBRATION_THEMES[theme] : null,
      message: primary ? describeCelebration(primary) : '',
      countryCode: countryCode || null,
      source,
      reducedMotion: prefersReduced,
      dismissedIds,
      dismissCelebration,
      bannerDismissed,
      setBannerDismissed,
      date,
    };
  }, [active, primary, countryCode, source, dismissedIds, dismissCelebration, bannerDismissed, date]);

  return <CelebrationContext.Provider value={value}>{children}</CelebrationContext.Provider>;
}

export function useCelebration() {
  return useContext(CelebrationContext) || {
    activeCelebrations: [],
    primaryCelebration: null,
    isCelebrationActive: false,
    theme: null,
    themeValues: null,
    message: '',
    countryCode: null,
    source: 'local',
    reducedMotion: prefersReduced,
    dismissedIds: [],
    dismissCelebration: () => {},
    bannerDismissed: false,
    setBannerDismissed: () => {},
    date: todayIso(),
  };
}

export default CelebrationProvider;