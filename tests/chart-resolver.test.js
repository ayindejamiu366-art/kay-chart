/**
 * Chart resolver: deterministic tests with a fake upstream.
 *
 * These never touch the network. The resolver's contract — per-call timeout,
 * overall budget, last-good cache fallback, partial responses, concurrency cap —
 * is verified against a scripted fake so the results do not depend on whether a
 * music provider happens to be healthy.
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';

// The resolver reads its limits from the environment at require time, so it has
// to be re-imported for each configuration under test. A dynamic import is used
// (not `require`) because only `import` goes through vitest's module registry and
// therefore honours `vi.resetModules()`.
async function loadResolver({ timeout = 6000, budget = 9000, concurrency = 4 } = {}) {
  vi.resetModules();
  process.env.CHART_RESOLVE_TIMEOUT_MS = String(timeout);
  process.env.CHART_RESOLVE_BUDGET_MS = String(budget);
  process.env.CHART_RESOLVE_CONCURRENCY = String(concurrency);
  return import('../server/utils/chart-resolver.cjs');
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function rows(n) {
  return Array.from({ length: n }, (_, i) => ({ track_id: `t${i}`, rank: i + 1 }));
}

describe('chart-resolver', () => {
  beforeEach(() => {
    delete process.env.CHART_RESOLVE_TIMEOUT_MS;
    delete process.env.CHART_RESOLVE_BUDGET_MS;
    delete process.env.CHART_RESOLVE_CONCURRENCY;
  });

  it('resolves everything when the upstream is healthy', async () => {
    const { resolveRows, _clearCache } = await loadResolver();
    _clearCache();

    const { items, stats } = await resolveRows(rows(10), {
      trackIdOf: (r) => r.track_id,
      fetchTrack: async (id) => ({ id, title: `Track ${id}` }),
      shape: (row, track) => ({ ...track, chartRank: row.rank }),
    });

    expect(items).toHaveLength(10);
    expect(stats.resolved).toBe(10);
    expect(stats.fromCache).toBe(0);
    expect(stats.failed).toBe(0);
    expect(stats.timedOut).toBe(0);
    // Rank order must survive resolution.
    expect(items.map(i => i.chartRank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('times out a hanging lookup and still returns the rest (partial response)', async () => {
    const { resolveRows, _clearCache } = await loadResolver({ timeout: 120, budget: 5000 });
    _clearCache();

    const { items, stats } = await resolveRows(rows(8), {
      trackIdOf: (r) => r.track_id,
      // Every third track hangs forever.
      fetchTrack: (id) => {
        const n = Number(id.slice(1));
        if (n % 3 === 0) return new Promise(() => {}); // never settles
        return Promise.resolve({ id, title: `Track ${id}` });
      },
      shape: (row, track) => ({ ...track, chartRank: row.rank }),
    });

    expect(stats.timedOut).toBeGreaterThan(0);
    expect(items.length).toBeGreaterThan(0);
    expect(items.length).toBeLessThan(8);
    // The hung rows are dropped rather than blocking the response.
    expect(items.every(i => typeof i.chartRank === 'number')).toBe(true);
  });

  it('serves the last good value when a later lookup fails', async () => {
    const { resolveRows, _clearCache } = await loadResolver({ timeout: 200, budget: 5000 });
    _clearCache();

    const good = async (id) => ({ id, title: `Original ${id}` });

    // First pass populates the cache.
    const first = await resolveRows(rows(3), {
      trackIdOf: (r) => r.track_id,
      fetchTrack: good,
      shape: (row, track) => ({ ...track, chartRank: row.rank }),
    });
    expect(first.stats.resolved).toBe(3);

    // Second pass: upstream is now broken.
    const second = await resolveRows(rows(3), {
      trackIdOf: (r) => r.track_id,
      fetchTrack: async () => { throw new Error('upstream down'); },
      shape: (row, track) => ({ ...track, chartRank: row.rank }),
    });

    expect(second.stats.resolved).toBe(0);
    expect(second.stats.fromCache).toBe(3);
    // Chart length is preserved from cache, and the staleness is visible.
    expect(second.items).toHaveLength(3);
    expect(second.items[0].title).toBe('Original t0');
    expect(second.items[0].stale).toBe(true);
  });

  it('does not start new lookups once the overall budget is spent', async () => {
    const { resolveRows, _clearCache } = await loadResolver({ timeout: 400, budget: 250 });
    _clearCache();

    let started = 0;
    const { items, stats } = await resolveRows(rows(40), {
      trackIdOf: (r) => r.track_id,
      fetchTrack: async (id) => {
        started++;
        await sleep(300);
        return { id, title: `Track ${id}` };
      },
      shape: (row, track) => ({ ...track, chartRank: row.rank }),
    });

    // The budget must cut the work short rather than resolving all 40.
    expect(started).toBeLessThan(40);
    expect(stats.skipped).toBeGreaterThan(0);
    expect(items.length).toBeLessThanOrEqual(started);
  });

  it('respects the concurrency cap', async () => {
    const { resolveRows, _clearCache } = await loadResolver({ timeout: 5000, budget: 9000, concurrency: 3 });
    _clearCache();

    let inFlight = 0;
    let peak = 0;

    await resolveRows(rows(24), {
      trackIdOf: (r) => r.track_id,
      fetchTrack: async (id) => {
        inFlight++;
        peak = Math.max(peak, inFlight);
        await sleep(25);
        inFlight--;
        return { id, title: `Track ${id}` };
      },
      shape: (row, track) => ({ ...track, chartRank: row.rank }),
    });

    expect(peak).toBeLessThanOrEqual(3);
    expect(peak).toBeGreaterThan(1);
  });

  it('keeps response order stable regardless of completion order', async () => {
    const { resolveRows, _clearCache } = await loadResolver();
    _clearCache();

    const { items } = await resolveRows(rows(10), {
      trackIdOf: (r) => r.track_id,
      // Earlier rows are slowest, so completion order is the reverse of rank.
      fetchTrack: async (id) => {
        await sleep((10 - Number(id.slice(1))) * 8);
        return { id, title: `Track ${id}` };
      },
      shape: (row, track) => ({ ...track, chartRank: row.rank }),
    });

    expect(items.map(i => i.chartRank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });
});