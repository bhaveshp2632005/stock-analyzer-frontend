/**
 * api.js — Centralized API utility
 *
 * FIX: Added api.forceGet() — appends ?force=true so server bypasses
 *      its own cache. Used by manual Refresh buttons in Dashboard + Movers.
 *
 * Changes from original:
 *  1. ApiError class — typed errors with HTTP status
 *  2. cachedFetch integration — GET requests can opt-in to caching
 *  3. api.batchStocks() — fetch multiple symbols in parallel with progressive updates
 *  4. api.cachedGet() — cache-aware GET with in-flight dedup
 *  5. api.forceGet() — bypasses BOTH frontend AND server-side cache  ← NEW FIX
 *  6. All existing api.get / api.post / api.delete behaviour preserved
 */

import { getToken, logout }                  from "./auth.js";
import { cachedFetch, cacheInvalidate, TTL } from "./apiCache.js";

const BASE = (typeof import.meta !== "undefined" && import.meta.env?.VITE_API_URL)
  || "http://localhost:5000/api";

/* ── Typed API error ── */
export class ApiError extends Error {
  constructor(status, message, body = null) {
    super(message);
    this.name   = "ApiError";
    this.status = status;
    this.body   = body;
  }
}

/* ── Auth headers ── */
const authHeaders = () => ({
  "Content-Type": "application/json",
  Authorization: `Bearer ${getToken()}`,
});

/* ── Central response handler ── */
const handleResponse = async (res) => {
  if (res.status === 401) {
    logout(true);
    return null;
  }
  if (!res.ok) {
    let message = `Request failed (${res.status})`;
    try {
      const body = await res.json();
      message = body?.error || body?.message || message;
      throw new ApiError(res.status, message, body);
    } catch (e) {
      if (e instanceof ApiError) throw e;
      throw new ApiError(res.status, message);
    }
  }
  return res.json();
};

/* ══════════════════════════════════════════════════════════════
   API OBJECT
══════════════════════════════════════════════════════════════ */
export const api = {

  /* ─── Plain GET (no frontend cache) ─── */
  get: (url) =>
    fetch(`${BASE}${url}`, { headers: authHeaders() }).then(handleResponse),

  /* ─── FIX: Force GET — bypasses BOTH frontend cache AND server cache ───────
   * Appends ?force=true so movers.controller.js skips serverCacheGet.
   * Also invalidates the frontend apiCache entry for this URL prefix.
   * Use this for manual Refresh button clicks.
   */
  forceGet: (url, cacheKeyPrefix) => {
    // Bust frontend cache first
    if (cacheKeyPrefix) cacheInvalidate(cacheKeyPrefix);

    // Append ?force=true (handles URLs that already have query params too)
    const sep      = url.includes("?") ? "&" : "?";
    const forceUrl = `${BASE}${url}${sep}force=true`;
    return fetch(forceUrl, { headers: authHeaders() }).then(handleResponse);
  },

  /* ─── Cached GET ─── */
  cachedGet: (url, cacheKey, ttl = TTL.stock) =>
    cachedFetch(
      cacheKey,
      () => fetch(`${BASE}${url}`, { headers: authHeaders() }).then(handleResponse),
      ttl
    ),

  /* ─── POST ── */
  post: (url, body) =>
    fetch(`${BASE}${url}`, {
      method:  "POST",
      headers: authHeaders(),
      body:    JSON.stringify(body),
    }).then(handleResponse),

  /* ─── DELETE ── */
  delete: (url) =>
    fetch(`${BASE}${url}`, {
      method:  "DELETE",
      headers: authHeaders(),
    }).then(handleResponse),

  /* ─── BATCH stock fetch ─── */
  batchStocks: async (symbols, range = "1W", onEach = null) => {
    const results = new Map();

    const promises = symbols.map(async (symbol) => {
      const cacheKey = `stock:${symbol}:${range}`;
      try {
        const data = await cachedFetch(
          cacheKey,
          () =>
            fetch(`${BASE}/stock/${symbol}?range=${range}`, {
              headers: authHeaders(),
            }).then(handleResponse),
          TTL.stock
        );
        results.set(symbol, data);
        onEach?.(symbol, data);
      } catch {
        results.set(symbol, null);
        onEach?.(symbol, null);
      }
    });

    await Promise.allSettled(promises);
    return results;
  },

  /* ─── Cache invalidation helpers ─── */
  invalidateStock:  (symbol) => cacheInvalidate(`stock:${symbol}`),
  invalidateMovers: ()       => cacheInvalidate("movers:"),
};

export { TTL };