/**
 * Small in-memory TTL cache with last-good retention.
 *
 * Why
 * ---
 * `/api/music/home`, `/trending` and `/country/:cc` are read-mostly and
 * country-scoped, and their upstream providers are unreliable: they rate limit,
 * time out, and their circuit breakers open for 5 minutes at a time. Without a
 * cache every one of those blips empties the Home screen for the listener, and
 * every retry adds load to an already struggling provider.
 *
 * So entries are held for a short TTL (fresh) and then for a much longer
 * "last good" window. A fresh hit short-circuits entirely. After the TTL, the
 * producer runs; if it fails or returns nothing usable, the last good value is
 * served and marked stale rather than dropping to an empty screen.
 *
 * Concurrent misses for the same key share one upstream call, so a cold cache
 * under load does not fan out into N identical provider requests.
 */

const DEFAULT_TTL_MS = 90 * 1000;          // inside the requested 60-120s band
const LAST_GOOD_MS = 30 * 60 * 1000;       // how long a stale value stays usable
const MAX_ENTRIES = 200;

/** key -> { value, fetchedAt, lastGoodAt } */
const store = new Map();
/** key -> in-flight promise */
const inFlight = new Map();

const stats = { hits: 0, misses: 0, staleServed: 0, coalesced: 0, producerFailures: 0 };

function evictIfNeeded() {
  while (store.size > MAX_ENTRIES) {
    // Insertion-ordered: the oldest inserted key goes first.
    const oldest = store.keys().next().value;
    store.delete(oldest);
  }
}

function read(key, ttlMs) {
  const entry = store.get(key);
  if (!entry) return null;
  const age = Date.now() - entry.fetchedAt;
  if (age < ttlMs) {
    stats.hits++;
    return { value: entry.value, stale: false };
  }
  return null;
}

function lastGood(key) {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() - entry.lastGoodAt > LAST_GOOD_MS) {
    store.delete(key);
    return null;
  }
  return entry.value;
}

function write(key, value) {
  const previous = store.get(key);
  store.set(key, {
    value,
    fetchedAt: Date.now(),
    // Only a genuinely usable result refreshes the last-good timestamp, so a
    // run of empty responses cannot pin a blank screen in place.
    lastGoodAt: previous ? previous.lastGoodAt : Date.now(),
  });
  evictIfNeeded();
}

/**
 * Return a cached value, refreshing it when stale.
 *
 * @param {string} key
 * @param {() => Promise<any>} producer
 * @param {object} opts
 * @param {number} [opts.ttlMs]
 * @param {(value: any) => boolean} [opts.isUsable] Rejects empty/error results.
 * @returns {Promise<{value: any, stale: boolean}>}
 */
async function cached(key, producer, { ttlMs = DEFAULT_TTL_MS, isUsable } = {}) {
  const fresh = read(key, ttlMs);
  if (fresh) return fresh;

  stats.misses++;

  const existing = inFlight.get(key);
  if (existing) {
    stats.coalesced++;
    return existing;
  }

  const run = (async () => {
    try {
      const value = await producer();
      const usable = isUsable ? isUsable(value) : value !== null && value !== undefined;
      if (usable) {
        write(key, value);
        return { value, stale: false };
      }
      // Producer came back empty or unusable: keep whatever we last knew good.
      const fallback = lastGood(key);
      if (fallback !== null && fallback !== undefined) {
        stats.staleServed++;
        return { value: fallback, stale: true };
      }
      return { value, stale: true };
    } catch (err) {
      stats.producerFailures++;
      const fallback = lastGood(key);
      if (fallback !== null && fallback !== undefined) {
        stats.staleServed++;
        return { value: fallback, stale: true };
      }
      throw err;
    } finally {
      inFlight.delete(key);
    }
  })();

  inFlight.set(key, run);
  return run;
}

function clear() {
  store.clear();
  inFlight.clear();
}

module.exports = {
  cached,
  clear,
  stats,
  DEFAULT_TTL_MS,
  LAST_GOOD_MS,
  MAX_ENTRIES,
  _store: store,
};