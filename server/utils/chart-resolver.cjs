/**
 * Bounded, time-boxed resolution of chart rows into full track objects.
 *
 * Why this exists
 * ---------------
 * Chart endpoints resolve up to 100 rows. That used to happen sequentially, and
 * each `musicService.getTrack` call can occupy up to ~17s when a provider is
 * degraded (providers abort at 12-15s, `safeProviderCall` waits 17s). Fifty slow
 * rows therefore produced 36-49s responses that still eventually returned 200.
 *
 * The trade-off
 * -------------
 * A 6s per-provider cap is deliberately shorter than a provider's own abort
 * timeout, so it *will* abandon some calls that would have succeeded given more
 * time. That is the point: a chart that renders in 6s with 40 of 50 rows beats
 * one that renders in 45s with all 50. Everything abandoned is served from the
 * last-good cache instead of being dropped, so the usual outcome is a complete
 * chart with slightly stale metadata rather than a short one.
 *
 * Concurrency is capped so a burst of chart requests cannot fan out into 100
 * simultaneous upstream calls per request. The default is deliberately low (4):
 * the same track resolved one-at-a-time succeeds, while eight simultaneous
 * lookups reliably trip provider rate limits and turn into null results. Raising
 * this makes charts look "faster" only by failing more of them.
 */

const RESOLVE_TIMEOUT_MS = Number(process.env.CHART_RESOLVE_TIMEOUT_MS) || 6000;
const RESOLVE_CONCURRENCY = Number(process.env.CHART_RESOLVE_CONCURRENCY) || 4;
/**
 * Wall-clock budget for the whole response.
 *
 * The per-call timeout alone still allows several waves of slow lookups to add
 * up, so the total is capped as well. Once the budget is spent, no new lookups
 * are started and any row not yet attempted is served from cache only (or
 * omitted). This is what makes the endpoint's latency predictable rather than
 * merely bounded per item.
 */
const RESOLVE_BUDGET_MS = Number(process.env.CHART_RESOLVE_BUDGET_MS) || 9000;
const MAX_CACHE_ENTRIES = 2000;

/** trackId -> last successfully resolved track object. */
const lastGood = new Map();

function withTimeout(promise, ms) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

function rememberTrack(trackId, track) {
  if (!trackId || !track) return;
  // Insertion-ordered eviction: the oldest entry goes first.
  if (lastGood.size >= MAX_CACHE_ENTRIES) {
    const oldest = lastGood.keys().next().value;
    lastGood.delete(oldest);
  }
  lastGood.set(trackId, track);
}

/**
 * Resolve rows concurrently, with a per-row timeout and cache fallback.
 *
 * @param {Array} rows                 Rows to resolve, already ordered.
 * @param {object} opts
 * @param {(row) => string} opts.trackIdOf  Extract the upstream track id.
 * @param {(id) => Promise<object>} opts.fetchTrack  Upstream lookup.
 * @param {(row, track) => object} opts.shape  Build the response entry.
 * @returns {Promise<{items: object[], stats: object}>}
 */
async function resolveRows(rows, { trackIdOf, fetchTrack, shape }) {
  const stats = { resolved: 0, fromCache: 0, timedOut: 0, failed: 0, skipped: 0 };
  const list = Array.from(rows || []);
  const output = new Array(list.length);
  const deadline = Date.now() + RESOLVE_BUDGET_MS;

  let cursor = 0;
  const worker = async () => {
    while (cursor < list.length) {
      const index = cursor++;
      const row = list[index];
      const trackId = trackIdOf(row);

      if (Date.now() >= deadline) {
        // Budget spent: do not start more upstream work.
        stats.skipped++;
      } else {
        try {
          const track = await withTimeout(fetchTrack(trackId), RESOLVE_TIMEOUT_MS);
          if (track) {
            rememberTrack(trackId, track);
            output[index] = shape(row, track);
            stats.resolved++;
            continue;
          }
          stats.failed++;
        } catch (err) {
          if (err && /timeout/i.test(err.message)) stats.timedOut++;
          else stats.failed++;
        }
      }

      // Missed, too slow, or never attempted: fall back to the last good
      // resolution rather than dropping the row, so rank order and chart length
      // survive a bad patch.
      const cached = trackId ? lastGood.get(trackId) : null;
      if (cached) {
        output[index] = shape(row, { ...cached, stale: true });
        stats.fromCache++;
      }
    }
  };

  await Promise.all(
    Array.from({ length: Math.min(RESOLVE_CONCURRENCY, list.length || 1) }, worker)
  );

  return { items: output.filter(Boolean), stats };
}

module.exports = {
  resolveRows,
  RESOLVE_TIMEOUT_MS,
  RESOLVE_BUDGET_MS,
  RESOLVE_CONCURRENCY,
  _lastGood: lastGood,
  _clearCache: () => lastGood.clear(),
};