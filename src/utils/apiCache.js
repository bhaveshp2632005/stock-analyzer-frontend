/**
 * apiCache.js — Smart in-memory cache for frontend API responses
 *
 * Features:
 *  • TTL-based expiry per cache entry
 *  • In-flight deduplication: if the same request is already in-flight,
 *    subsequent callers wait for the same Promise instead of firing again
 *  • Manual invalidation
 *  • Zero dependencies
 */

const store     = new Map();  // key → { data, expiresAt }
const inflight  = new Map();  // key → Promise

const DEFAULT_TTL = {
  stock:   2 * 60 * 1000,   // 2 min  — individual stock (1W range)
  movers:  2 * 60 * 1000,   // 2 min  — top movers
  analysis: 5 * 60 * 1000,  // 5 min  — user history (changes rarely)
};

/**
 * get — return cached value if fresh, otherwise null
 */
export const cacheGet = (key) => {
  const entry = store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return null;
  }
  return entry.data;
};

/**
 * set — store value with TTL (ms)
 */
export const cacheSet = (key, data, ttl = DEFAULT_TTL.stock) => {
  store.set(key, { data, expiresAt: Date.now() + ttl });
};

/**
 * invalidate — delete one key or all keys matching a prefix
 */
export const cacheInvalidate = (keyOrPrefix) => {
  for (const k of store.keys()) {
    if (k === keyOrPrefix || k.startsWith(keyOrPrefix)) {
      store.delete(k);
    }
  }
};

/**
 * cachedFetch — the main helper
 *
 * Usage:
 *   const data = await cachedFetch(
 *     "stock:AAPL:1W",
 *     () => api.get("/stock/AAPL?range=1W"),
 *     DEFAULT_TTL.stock
 *   );
 *
 * • Returns cached data instantly if still fresh
 * • Deduplicates in-flight requests (multiple callers → one network hit)
 * • Caches the result on success
 * • On error, re-throws without caching
 */
export const cachedFetch = async (key, fetcher, ttl = DEFAULT_TTL.stock) => {
  // 1. Cache hit
  const cached = cacheGet(key);
  if (cached !== null) return cached;

  // 2. In-flight dedup: reuse existing Promise
  if (inflight.has(key)) {
    return inflight.get(key);
  }

  // 3. New request
  const promise = (async () => {
    try {
      const data = await fetcher();
      if (data !== null) cacheSet(key, data, ttl);
      return data;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, promise);
  return promise;
};

/**
 * prefetch — fire a request in the background and cache the result silently.
 * Used for hover-based predictive preloading.
 * Never throws — errors are swallowed (it's best-effort).
 */
export const prefetch = (key, fetcher, ttl = DEFAULT_TTL.stock) => {
  // Already cached or already in-flight — nothing to do
  if (cacheGet(key) !== null || inflight.has(key)) return;
  cachedFetch(key, fetcher, ttl).catch(() => {});
};

export const TTL = DEFAULT_TTL;