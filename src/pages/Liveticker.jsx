/**
 * LiveTicker.jsx
 * Real-time stock price ticker using WebSocket.
 *
 * Usage (any page):
 *   import LiveTicker from "../components/LiveTicker.jsx";
 *   <LiveTicker symbols={["AAPL","TSLA","NVDA","RELIANCE.NS"]} />
 */

import React, { useState, useEffect, useRef, useCallback } from "react";
import { Wifi, WifiOff, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { useTheme } from "../context/ThemeContext.jsx";
import { tokens }   from "../context/theme.js";
import { getUser }  from "../utils/auth.js";

const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:8000/ws";

const fmtPrice = (price, currency = "USD") =>
  currency === "INR"
    ? "₹" + Number(price).toLocaleString("en-IN", { minimumFractionDigits: 2 })
    : "$" + Number(price).toFixed(2);

const REGIME_COLOR = { "Bull": "#10b981", "Bear": "#f87171",
                       "Sideways": "#f59e0b", "Unknown": "#6b7280" };

/* ─────────────────────────────────────────────────────────── */

const LiveTicker = ({ symbols = ["AAPL", "TSLA", "NVDA", "RELIANCE.NS"] }) => {
  const { isDark } = useTheme();
  const t = tokens(isDark);

  const [quotes,  setQuotes]  = useState({});   // symbol → latest quote
  const [status,  setStatus]  = useState("connecting");  // connecting|open|closed|error
  const wsRef    = useRef(null);
  const retryRef = useRef(null);
  const mountRef = useRef(true);

  const connect = useCallback(() => {
    if (!mountRef.current) return;
    setStatus("connecting");

    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mountRef.current) return;
      setStatus("open");
      // Subscribe to all symbols
      symbols.forEach(sym => {
        ws.send(JSON.stringify({ action: "subscribe", symbol: sym }));
      });
    };

    ws.onmessage = (evt) => {
      if (!mountRef.current) return;
      try {
        const msg = JSON.parse(evt.data);
        if (msg.type === "price_update") {
          setQuotes(prev => ({
            ...prev,
            [msg.symbol]: {
              price:     msg.price,
              change:    msg.change,
              changePct: msg.changePct,
              high:      msg.high,
              low:       msg.low,
              currency:  msg.currency || "USD",
              regime:    msg.regime,
              ts:        msg.ts,
            },
          }));
        }
      } catch (_) {}
    };

    ws.onerror = () => {
      if (!mountRef.current) return;
      setStatus("error");
    };

    ws.onclose = () => {
      if (!mountRef.current) return;
      setStatus("closed");
      // Auto-reconnect after 5s
      retryRef.current = setTimeout(connect, 5000);
    };
  }, [symbols]);

  useEffect(() => {
    mountRef.current = true;
    connect();
    return () => {
      mountRef.current = false;
      clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const statusColor = status === "open" ? "#10b981" : status === "connecting" ? "#f59e0b" : "#f87171";
  const StatusIcon  = status === "open" ? Wifi : WifiOff;

  return (
    <div style={{
      borderRadius: 16, overflow: "hidden",
      background: isDark
        ? "linear-gradient(135deg,rgba(255,255,255,.045),rgba(255,255,255,.02))"
        : "linear-gradient(135deg,rgba(255,255,255,.9),rgba(255,255,255,.7))",
      border: `1px solid ${t.border}`,
      backdropFilter: "blur(20px)", boxShadow: t.shadow,
    }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "11px 16px", borderBottom: `1px solid ${t.border}` }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ padding: 6, borderRadius: 8,
            background: "rgba(59,130,246,.14)", border: "1px solid rgba(59,130,246,.2)" }}>
            <Wifi size={12} style={{ color: "#3b82f6" }} />
          </div>
          <span style={{ fontSize: 13, fontWeight: 700, color: t.textPrimary }}>Live Prices</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 6,
          fontSize: 10, color: statusColor, fontWeight: 600 }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: statusColor,
            animation: status === "open" ? "sa-pulse 2s infinite" : "none",
            boxShadow: status === "open" ? `0 0 6px ${statusColor}` : "none",
            display: "inline-block" }} />
          {status === "open" ? "Live" : status === "connecting" ? "Connecting…" : "Reconnecting…"}
        </div>
      </div>

      {/* Quotes */}
      <div>
        {symbols.map(sym => {
          const q = quotes[sym];
          const isUp  = q && q.changePct > 0;
          const isDown = q && q.changePct < 0;
          const pColor = isUp ? "#10b981" : isDown ? "#f87171" : t.textMuted;
          const PIcon  = isUp ? TrendingUp : isDown ? TrendingDown : Minus;

          return (
            <div key={sym} style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "9px 16px", borderBottom: `1px solid ${t.border}`,
              transition: "background .15s",
            }}>
              {/* Avatar */}
              <div style={{ width: 32, height: 32, borderRadius: 9, flexShrink: 0,
                background: `${pColor}18`, border: `1px solid ${pColor}25`,
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 8, fontWeight: 800, color: pColor }}>
                {sym.replace(/\.(NS|BO)$/i, "").slice(0, 4)}
              </div>

              {/* Name */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: t.textPrimary,
                  overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {sym}
                </p>
                {q?.regime && (
                  <p style={{ margin: 0, fontSize: 9, color: REGIME_COLOR[q.regime] || t.textMuted }}>
                    {q.regime}
                  </p>
                )}
              </div>

              {/* Price */}
              <div style={{ textAlign: "right", flexShrink: 0 }}>
                {q ? (
                  <>
                    <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: t.textPrimary }}>
                      {fmtPrice(q.price, q.currency)}
                    </p>
                    <p style={{ margin: 0, fontSize: 10, fontWeight: 700, color: pColor,
                      display: "flex", alignItems: "center", justifyContent: "flex-end", gap: 2 }}>
                      <PIcon size={10} />
                      {isUp ? "+" : ""}{q.changePct?.toFixed(2)}%
                    </p>
                  </>
                ) : (
                  <div style={{ width: 60, height: 8, background: t.inputBg,
                    borderRadius: 4, animation: "sa-pulse 1.5s ease infinite" }} />
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div style={{ padding: "7px 16px", display: "flex", justifyContent: "space-between" }}>
        <span style={{ fontSize: 9, color: t.textMuted }}>via WebSocket · auto-reconnect</span>
        <span style={{ fontSize: 9, color: t.textMuted }}>
          {Object.keys(quotes).length}/{symbols.length} live
        </span>
      </div>
    </div>
  );
};

export default LiveTicker;