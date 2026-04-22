/**
 * hooks/useFavorites.js
 * ─────────────────────────────────────────────────────────────────
 * Data flow:
 *   1. Mount → GET /api/favorites            (load DB list)
 *   2. Every 60s  → GET /api/favorites/prices (live prices)
 *   3. Every 90s  → POST /api/favorites/check-alerts (server evaluates + fires)
 *   4. Triggered alerts → onAlert(alert) callback → toast notifications
 *
 * All alert state lives in the DB:
 *   alertFiredAbove / alertFiredBelow reset only when user calls updateAlert.
 */

import { useState, useEffect, useRef, useCallback } from "react";
import { api } from "../utils/api.js";

const PRICE_POLL_MS = 60_000;
const ALERT_POLL_MS = 90_000;

export const useFavorites = (onAlert) => {
  const [favorites, setFavorites] = useState([]);
  const [prices,    setPrices]    = useState({});   // { AAPL: { price, changePercent, currency } }
  const [loading,   setLoading]   = useState(true);
  const isMounted  = useRef(true);
  const priceTimer = useRef(null);
  const alertTimer = useRef(null);

  useEffect(() => {
    isMounted.current = true;
    return () => {
      isMounted.current = false;
      clearInterval(priceTimer.current);
      clearInterval(alertTimer.current);
    };
  }, []);

  /* ── Load favorites from DB ── */
  const loadFavorites = useCallback(async () => {
    try {
      const data = await api.get("/favorites");
      if (isMounted.current && Array.isArray(data)) setFavorites(data);
    } catch (err) {
      console.error("useFavorites load:", err.message);
    } finally {
      if (isMounted.current) setLoading(false);
    }
  }, []);

  /* ── Fetch live prices from backend ── */
  const fetchPrices = useCallback(async () => {
    try {
      const data = await api.get("/favorites/prices");
      if (isMounted.current && data) setPrices(data);
    } catch (err) {
      console.warn("useFavorites prices:", err.message);
    }
  }, []);

  /* ── Ask server to check alert conditions ── */
  const checkAlerts = useCallback(async () => {
    try {
      const res = await api.post("/favorites/check-alerts", {});
      if (!isMounted.current || !res?.triggered?.length) return;
      res.triggered.forEach(alert => onAlert?.(alert));
    } catch (err) {
      console.warn("useFavorites checkAlerts:", err.message);
    }
  }, [onAlert]);

  /* ── Bootstrap ── */
  useEffect(() => { loadFavorites(); }, [loadFavorites]);

  /* ── Start polling after initial load ── */
  useEffect(() => {
    if (loading) return;
    clearInterval(priceTimer.current);
    clearInterval(alertTimer.current);
    if (!favorites.length) return;

    fetchPrices();
    checkAlerts();

    priceTimer.current = setInterval(fetchPrices, PRICE_POLL_MS);
    alertTimer.current = setInterval(checkAlerts, ALERT_POLL_MS);

    return () => {
      clearInterval(priceTimer.current);
      clearInterval(alertTimer.current);
    };
  }, [favorites.length, loading, fetchPrices, checkAlerts]);

  /* ════════════════════════════════════
     PUBLIC CRUD
  ════════════════════════════════════ */

  const addFavorite = useCallback(async (symbol, alertAbove = null, alertBelow = null) => {
    const sym = String(symbol).trim().toUpperCase();
    if (!sym) return { ok: false, error: "Symbol required" };
    try {
      const { favorite } = await api.post("/favorites", { symbol: sym, alertAbove, alertBelow });
      setFavorites(prev =>
        prev.find(f => f.symbol === sym)
          ? prev.map(f => f.symbol === sym ? favorite : f)
          : [favorite, ...prev]
      );
      // Immediately fetch price for new stock
      try {
        const p = await api.get("/favorites/prices");
        if (isMounted.current) setPrices(p);
      } catch {}
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message || "Failed to add" };
    }
  }, []);

  const removeFavorite = useCallback(async (symbol) => {
    try {
      await api.delete(`/favorites/${symbol}`);
      setFavorites(prev => prev.filter(f => f.symbol !== symbol));
      setPrices(prev => { const n = { ...prev }; delete n[symbol]; return n; });
    } catch (err) {
      console.error("removeFavorite:", err.message);
    }
  }, []);

  const updateAlert = useCallback(async (symbol, alertAbove, alertBelow) => {
    try {
      const { favorite } = await api.put(`/favorites/${symbol}`, {
        alertAbove: alertAbove ?? null,
        alertBelow: alertBelow ?? null,
      });
      // Update local list — fired flags are reset by backend
      setFavorites(prev => prev.map(f => f.symbol === symbol ? favorite : f));
    } catch (err) {
      console.error("updateAlert:", err.message);
    }
  }, []);

  const isFavorite = useCallback(
    (symbol) => favorites.some(f => f.symbol === String(symbol).toUpperCase()),
    [favorites]
  );

  const refreshPrices = useCallback(() => {
    fetchPrices();
    checkAlerts();
  }, [fetchPrices, checkAlerts]);

  return {
    favorites, prices, loading,
    addFavorite, removeFavorite, updateAlert,
    isFavorite, refreshPrices,
  };
};