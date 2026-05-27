

import { useState, useEffect, useCallback, useRef } from "react";
import { api, TTL } from "../utils/api.js";

const INDEX_META = [
  { symbol: "^NSEI",    name: "NIFTY 50",   flag: "🇮🇳", cur: "₹" },
  { symbol: "^BSESN",   name: "SENSEX",     flag: "🇮🇳", cur: "₹" },
  { symbol: "^NSEBANK", name: "BANK NIFTY", flag: "🇮🇳", cur: "₹" },
];

const INDICES_INTERVAL_MS = 15 * 1000; // 15 s

/**
 * Fetch a single index from /api/indices/:encodedSymbol
 * Uses the dedicated indices route (not /stock/:symbol/quick).
 */
const fetchIndex = async (symbol) => {
  // ^NSEI → %5ENSEI — critical fix for Express route param parsing
  const encoded = encodeURIComponent(symbol);
  const cacheKey = `index:${symbol}`;

  // Try cache first (TTL same as stock quotes)
  return api.cachedGet(`/indices/${encoded}`, cacheKey, TTL.stock);
};

export const useIndicesFromStockAPI = (intervalMs = INDICES_INTERVAL_MS) => {
  const [data,    setData]    = useState({});
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const mounted = useRef(true);

  const fetchAll = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);

    try {
      const results = await Promise.allSettled(
        INDEX_META.map(({ symbol }) => fetchIndex(symbol))
      );

      if (!mounted.current) return;

      const next = {};
      results.forEach((res, i) => {
        if (res.status === "fulfilled" && res.value) {
          next[INDEX_META[i].symbol] = res.value;
        }
      });

      if (Object.keys(next).length > 0) {
        setData(prev => ({ ...prev, ...next }));
        setError("");
      } else {
        setError("Could not load market indices");
      }
    } catch (e) {
      if (mounted.current) {
        setError(e?.message || "Failed to load market indices");
      }
    } finally {
      if (isInitial && mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    fetchAll(true);
    const id = setInterval(() => fetchAll(false), intervalMs);
    return () => { mounted.current = false; clearInterval(id); };
  }, [fetchAll, intervalMs]);

  const refresh = useCallback(() => fetchAll(false), [fetchAll]);

  return { data, loading, error, refresh, meta: INDEX_META };
};

export { INDEX_META };
export default useIndicesFromStockAPI;