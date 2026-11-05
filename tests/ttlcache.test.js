/**
 * TTL cache: deterministic tests with a scripted producer.
 *
 * The behaviour that matters when music providers are down is that a listener
 * sees the last good list rather than an empty screen, so that is what these
 * pin down. No network and no dependence on real provider health.
 */
import { describe, it, expect, beforeEach } from 'vitest';

async function loadCache() {
  const mod = await import('../server/utils/ttlcache.cjs');
  mod.clear();
  return mod;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const notEmpty = (v) => Array.isArray(v) && v.length > 0;

describe('ttlcache', () => {
  beforeEach(() => {
    // Timings are tuned below the 60s TTL, so no env overrides are needed.
  });

  it('serves a fresh hit without calling the producer again', async () => {
    const { cached } = await loadCache();
    let calls = 0;
    const produce = async () => { calls++; return [{ id: 'a' }]; };

    const first = await cached('k', produce, { isUsable: notEmpty });
    const second = await cached('k', produce, { isUsable: notEmpty });

    expect(calls).toBe(1);
    expect(first.stale).toBe(false);
    expect(second.stale).toBe(false);
    expect(second.value).toEqual(first.value);
  });

  it('serves last good data when the producer throws', async () => {
    const { cached, _store } = await loadCache();
    const good = [{ id: 'a' }, { id: 'b' }];

    await cached('k', async () => good, { isUsable: notEmpty });
    // Age past the TTL: inside it the producer is never consulted at all, so
    // there would be no failure to recover from.
    _store.get('k').fetchedAt -= 10 * 60 * 1000;

    const after = await cached('k', async () => { throw new Error('providers down'); }, { isUsable: notEmpty });
    expect(after.stale).toBe(true);
    expect(after.value).toEqual(good);
  });

  it('serves last good data when the producer returns empty', async () => {
    const { cached, _store } = await loadCache();
    const good = [{ id: 'a' }];

    await cached('k', async () => good, { isUsable: notEmpty });
    _store.get('k').fetchedAt -= 10 * 60 * 1000;
    // An empty result is what an open circuit breaker looks like from here.
    const after = await cached('k', async () => [], { isUsable: notEmpty });

    expect(after.stale).toBe(true);
    expect(after.value).toEqual(good);
  });

  it('does not consult the producer while the entry is still fresh', async () => {
    const { cached } = await loadCache();
    let calls = 0;
    await cached('k', async () => { calls++; return [{ id: 'a' }]; }, { isUsable: notEmpty });
    const second = await cached('k', async () => { calls++; return []; }, { isUsable: notEmpty });

    expect(calls).toBe(1);
    expect(second.stale).toBe(false);
  });

  it('does not let an empty result overwrite the last good value', async () => {
    const { cached } = await loadCache();
    const good = [{ id: 'a' }];

    await cached('k', async () => good, { isUsable: notEmpty });
    await cached('k', async () => [], { isUsable: notEmpty });
    // Still the original list, not a blank one.
    const third = await cached('k', async () => [], { isUsable: notEmpty });
    expect(third.value).toEqual(good);
  });

  it('coalesces concurrent misses into a single producer call', async () => {
    const { cached } = await loadCache();
    let calls = 0;
    const produce = async () => { calls++; await sleep(30); return [{ id: 'a' }]; };

    await Promise.all(Array.from({ length: 10 }, () => cached('k', produce, { isUsable: notEmpty })));
    expect(calls).toBe(1);
  });

  it('keeps separate keys for different countries', async () => {
    const { cached } = await loadCache();
    const results = await Promise.all([
      cached('home:NG', async () => [{ id: 'ng' }], { isUsable: notEmpty }),
      cached('home:ZA', async () => [{ id: 'za' }], { isUsable: notEmpty }),
    ]);
    expect(results[0].value).toEqual([{ id: 'ng' }]);
    expect(results[1].value).toEqual([{ id: 'za' }]);
  });

  it('rethrows when the producer fails and there is no last good value', async () => {
    const { cached } = await loadCache();
    await expect(
      cached('cold', async () => { throw new Error('no providers'); }, { isUsable: notEmpty })
    ).rejects.toThrow('no providers');
  });

  it('recovers once the producer succeeds again', async () => {
    const { cached, _store } = await loadCache();
    const good = [{ id: 'a' }];

    await cached('k', async () => good, { isUsable: notEmpty });
    // Age the entry past its TTL so the producer is consulted.
    _store.get('k').fetchedAt -= 10 * 60 * 1000;
    const healed = [{ id: 'z' }];
    const after = await cached('k', async () => healed, { isUsable: notEmpty });

    expect(after.stale).toBe(false);
    expect(after.value).toEqual(healed);
  });
});