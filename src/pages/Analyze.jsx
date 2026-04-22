/**
 * Analyze.jsx — theme-aware (3 themes: midnight / arctic / aurora)
 * + AI Prediction Engine (LSTM + XGBoost + FinBERT)
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Search, CandlestickChart, LineChart, Brain, RefreshCw,
  Wifi, WifiOff, AlertTriangle, X, TrendingUp, TrendingDown, Activity, Star,
} from "lucide-react";
import { useSearchParams }    from "react-router-dom";
import AppShell               from "./AppShell.jsx";
import PriceChart             from "./PriceChart.jsx";
import PriceChartLine         from "./PriceChartLine.jsx";
import RSIChart               from "./RSIChart.jsx";
import MACDChart              from "./MACDChart.jsx";
import AIPrediction           from "./AIPrediction.jsx";
import { getSocket }          from "../socket/socket.js";
import { api, TTL, ApiError } from "../utils/api.js";
import { prefetch }           from "../utils/apiCache.js";
import { useTheme }           from "../context/ThemeContext.jsx";
import { tokens }             from "../context/theme.js";
import useAuthGuard           from "../hooks/useAuthGuard.js";
import { useFavorites }       from "../hooks/useFavorites.js";
import { useAlertNotifications, NotificationStack } from "./AlertNotification.jsx";

const isIndianSym = (s) => /\.(NS|BO)$/i.test(s || "");

const fmtPrice = (v, sym = "") => {
  if (v == null || v === "--") return "--";
  const n = Number(v);
  return isIndianSym(sym)
    ? "₹" + n.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
};

const fmtVol = (v) => {
  if (!v) return "--";
  if (v >= 1e9) return (v / 1e9).toFixed(2) + "B";
  if (v >= 1e6) return (v / 1e6).toFixed(2) + "M";
  if (v >= 1e3) return (v / 1e3).toFixed(1) + "K";
  return String(v);
};

const ALL_RANGES = ["1W", "1M", "3M", "6M", "1Y"];

const prefetchAdjacentRanges = (symbol, currentRange) => {
  const idx = ALL_RANGES.indexOf(currentRange);
  [ALL_RANGES[idx - 1], ALL_RANGES[idx + 1]]
    .filter(Boolean)
    .forEach((r) =>
      prefetch(`stock:${symbol}:${r}`, () => api.get(`/stock/${symbol}?range=${r}`), TTL.stock)
    );
};

const ErrorBanner = ({ error, onDismiss, onRetry, t }) => (
  <div style={{ display:"flex", alignItems:"flex-start", gap:12, padding:"13px 16px",
    borderRadius:14, marginBottom:16,
    background:"rgba(239,68,68,.10)", border:"1px solid rgba(239,68,68,.28)" }}>
    <AlertTriangle size={15} style={{ color:"#f87171", flexShrink:0, marginTop:1 }}/>
    <div style={{ flex:1, minWidth:0 }}>
      <p style={{ margin:0, fontSize:13, fontWeight:600, color:"#fca5a5" }}>Failed to load stock data</p>
      <p style={{ margin:"3px 0 8px", fontSize:12, color:"rgba(252,165,165,.75)", wordBreak:"break-word" }}>{error}</p>
      {onRetry && (
        <button onClick={onRetry} style={{ fontSize:11, fontWeight:600, color:"#60a5fa", background:"none",
          border:"1px solid rgba(96,165,250,.3)", borderRadius:7, padding:"4px 10px", cursor:"pointer" }}>
          Try Again
        </button>
      )}
    </div>
    <button onClick={onDismiss} style={{ background:"none", border:"none", color:"rgba(252,165,165,.5)", cursor:"pointer", padding:2 }}>
      <X size={13}/>
    </button>
  </div>
);

const Skel = ({ w = "100%", h = 16, r = 8 }) => {
  const { isDark } = useTheme();
  return (
    <div style={{ width:w, height:h, borderRadius:r,
      background: isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.06)",
      animation:"sa-pulse 1.5s ease-in-out infinite" }}/>
  );
};

const Metric = ({ label, value, pos }) => {
  const { theme } = useTheme();
  const t = tokens(theme);
  return (
    <div style={{ background:t.inputBg, border:`1px solid ${t.border}`,
      borderRadius:12, padding:"12px 14px", transition:"background .35s" }}>
      <p style={{ fontSize:10, color:t.textSecondary, margin:0,
        textTransform:"uppercase", letterSpacing:".06em", fontWeight:600 }}>{label}</p>
      <p style={{ fontSize:16, fontWeight:800, margin:"5px 0 0",
        color: pos === true ? "#34d399" : pos === false ? "#f87171" : t.textPrimary,
        fontFamily:"'Syne',sans-serif" }}>
        {value}
      </p>
    </div>
  );
};

const ChartOverlay = ({ isDark }) => (
  <div style={{ position:"absolute", inset:0, borderRadius:18, zIndex:10,
    background: isDark ? "rgba(0,0,0,.28)" : "rgba(255,255,255,.42)",
    backdropFilter:"blur(1.5px)",
    display:"flex", alignItems:"center", justifyContent:"center" }}>
    <RefreshCw size={12} style={{ color:"#60a5fa", animation:"sa-spin 1s linear infinite" }}/>
  </div>
);

const Analyze = () => {
  useAuthGuard();
  const { isDark, theme } = useTheme();
  const t              = tokens(theme);
  const [searchParams] = useSearchParams();

  const [inputSym,       setInputSym]       = useState("");
  const [stock,          setStock]          = useState(null);
  const [range,          setRange]          = useState("1M");
  const [chartType,      setChartType]      = useState("line");
  const [initialLoading, setInitialLoading] = useState(false);
  const [chartLoading,   setChartLoading]   = useState(false);
  const [activeBtn,      setActiveBtn]      = useState(null);
  const [isLive,         setIsLive]         = useState(false);
  const [aiLoading,      setAiLoading]      = useState(false);
  const [aiResult,       setAiResult]       = useState(null);
  const [fetchError,     setFetchError]     = useState(null);
  const [aiError,        setAiError]        = useState(null);

  const abortRef  = useRef(null);
  const subSymRef = useRef(null);
  const symbolRef = useRef("");
  const rangeRef  = useRef("1M");
  const stockRef  = useRef(null);

  const { toasts, notify, dismiss }               = useAlertNotifications();
  const { favorites, addFavorite, removeFavorite, isFavorite } = useFavorites(notify);

  useEffect(() => { symbolRef.current = inputSym; }, [inputSym]);
  useEffect(() => { rangeRef.current  = range;    }, [range]);
  useEffect(() => { stockRef.current  = stock;    }, [stock]);

  useEffect(() => {
    const sock = getSocket();
    sock.on("connect",     () => { if (subSymRef.current) sock.emit("subscribeStock", subSymRef.current); });
    sock.on("disconnect",  () => setIsLive(false));
    sock.on("stockUpdate", (d)  => { setIsLive(true); setStock((p) => p ? { ...p, ...d, liveTick: d.tick } : p); });
    sock.on("stockError",  (e)  => console.warn("Socket:", e?.message));
    return () => { sock.off("stockUpdate"); sock.off("stockError"); sock.off("connect"); sock.off("disconnect"); };
  }, []);
  useEffect(() => () => { getSocket().emit("unsubscribeStock"); subSymRef.current = null; }, []);

  const analyzeStock = async (sym, r, btnKey = "search") => {
    const target = ((sym || symbolRef.current) || "").toUpperCase().trim();
    const rng    = r || rangeRef.current;
    if (!target) return;
    if (abortRef.current) abortRef.current.abort();
    abortRef.current = new AbortController();
    setFetchError(null);
    try {
      setActiveBtn(btnKey);
      if (!stockRef.current) setInitialLoading(true);
      else                   setChartLoading(true);
      const data = await api.cachedGet(`/stock/${target}?range=${rng}`, `stock:${target}:${rng}`, TTL.stock);
      if (data === null) return;
      setStock((p) => p ? { ...p, ...data, liveTick: null } : { ...data, liveTick: null });
      const sock = getSocket();
      if (subSymRef.current && subSymRef.current !== target) sock.emit("unsubscribeStock");
      subSymRef.current = target;
      sock.emit("subscribeStock", target);
      prefetchAdjacentRanges(target, rng);
    } catch (err) {
      if (err.name === "AbortError") return;
      setFetchError({
        message: err instanceof ApiError ? err.message : (err.message || "Network error."),
        retry: () => { api.invalidateStock(target); analyzeStock(target, rng, btnKey); },
      });
    } finally { setInitialLoading(false); setChartLoading(false); setActiveBtn(null); }
  };

  useEffect(() => {
    const s = searchParams.get("symbol");
    if (s) { setInputSym(s); symbolRef.current = s; analyzeStock(s, "1M", "search"); }
  }, []);

  const handleRangeChange = (r) => { setRange(r); rangeRef.current = r; analyzeStock(symbolRef.current, r, r); };
  const handleSearch = () => {
    const s = symbolRef.current.toUpperCase();
    if (!s) return;
    setStock(null); stockRef.current = null;
    setAiResult(null); setFetchError(null);
    analyzeStock(s, rangeRef.current, "search");
  };
  const handleRefresh = () => {
    const s = symbolRef.current.toUpperCase();
    if (!s) return;
    api.invalidateStock(s);
    analyzeStock(s, rangeRef.current, "refresh");
  };

  // Quick AI Signal (old simple analysis via Node.js /api/ai/analyze)
  const runAI = async () => {
    if (!stockRef.current) return;
    const cur = stockRef.current;
    setAiError(null);
    try {
      setAiLoading(true); setAiResult(null);
      const data = await api.post("/ai/analyze", cur);
      if (data === null) return;
      setAiResult(data);
      await api.post("/analysis", {
        symbol:     cur.symbol,
        price:      cur.price,
        signal:     data.action,
        confidence: data.confidence,
        summary:    data.summary,
      });
    } catch (err) {
      setAiError(err instanceof ApiError ? err.message : (err.message || "AI analysis failed"));
    } finally { setAiLoading(false); }
  };

  const card = {
    background:           t.cardGradient,
    border:              `1px solid ${t.border}`,
    backdropFilter:       "blur(24px) saturate(1.4)",
    WebkitBackdropFilter: "blur(24px) saturate(1.4)",
    borderRadius:         18,
    padding:              20,
    boxShadow:           `${t.shadow}, inset 0 1px 0 ${t.glassEdge}`,
    transition:           "background .35s, border-color .3s",
    position:             "relative",
  };
  const chgUp = Number(stock?.changePercent) >= 0;

  const accentBtn = {
    background: t.gradient || "linear-gradient(135deg,#3b82f6,#6366f1)",
    border:"none", color:"#fff",
    boxShadow:`0 4px 14px ${t.glowPrimary || "rgba(59,130,246,0.3)"}`,
  };

  return (
    <>
    <AppShell activePage="/analyze">
      {/* TOP BAR */}
      <div style={{ display:"flex", justifyContent:"space-between", marginBottom:20, flexWrap:"wrap", gap:10 }}>
        <div>
          <h1 style={{ margin:0, fontSize:"clamp(18px,4vw,24px)", fontWeight:800,
            letterSpacing:"-.04em", fontFamily:"'Syne', sans-serif",
            color: t.titleColor || t.textPrimary,
            textShadow: isDark ? `0 0 28px ${t.glowPrimary}, 0 2px 4px rgba(0,0,0,0.5)` : "none" }}>
            Stock Analyzer
          </h1>
          <p style={{ margin:"3px 0 0", fontSize:12, color:t.textSecondary }}>Real-time analysis with AI predictions</p>
        </div>
        <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
          {stock && (
            <div style={{ display:"flex", alignItems:"center", gap:6, padding:"6px 12px",
              borderRadius:9, fontSize:11, fontWeight:600, transition:"all .3s",
              background: isLive ? "rgba(16,185,129,.13)" : t.inputBg,
              border:`1px solid ${isLive ? "rgba(16,185,129,.25)" : t.border}`,
              color: isLive ? "#34d399" : t.textMuted }}>
              {isLive ? (
                <><span style={{ width:6, height:6, borderRadius:"50%", background:"#34d399",
                  boxShadow:"0 0 7px #34d399", animation:"sa-pulse 2s infinite", display:"inline-block" }}/>
                  <Wifi size={10}/> LIVE</>
              ) : <><WifiOff size={10}/> OFFLINE</>}
            </div>
          )}
          <div style={{ display:"flex", background:t.inputBg, border:`1px solid ${t.inputBorder}`, borderRadius:11, overflow:"hidden" }}>
            <input value={inputSym}
              onChange={e => { const v = e.target.value.toUpperCase(); setInputSym(v); symbolRef.current = v; }}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="AAPL · RELIANCE.NS"
              style={{ background:"none", border:"none", padding:"9px 13px", fontSize:13, color:t.textPrimary,
                outline:"none", width:"clamp(140px,22vw,220px)" }}
            />
            <button onClick={handleSearch} disabled={activeBtn === "search"}
              style={{ padding:"9px 13px", border:"none", color:"#fff", cursor:"pointer",
                display:"flex", alignItems:"center", transition:"all .2s",
                opacity:activeBtn === "search" ? .6 : 1, ...accentBtn, borderRadius:0 }}
              onMouseEnter={e => e.currentTarget.style.opacity = "0.85"}
              onMouseLeave={e => e.currentTarget.style.opacity = activeBtn === "search" ? "0.6" : "1"}>
              {activeBtn === "search" ? <RefreshCw size={14} style={{ animation:"sa-spin 1s linear infinite" }}/> : <Search size={14}/>}
            </button>
          </div>
        </div>
      </div>

      {fetchError && (
        <ErrorBanner error={fetchError.message} t={t} onDismiss={() => setFetchError(null)} onRetry={fetchError.retry}/>
      )}

      {initialLoading && (
        <div>
          <div style={{ ...card, marginBottom:16, display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
            <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
              <Skel w={110} h={22} r={6}/><Skel w={70} h={13} r={5}/>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:8, alignItems:"flex-end" }}>
              <Skel w={90} h={26} r={6}/><Skel w={55} h={13} r={5}/>
            </div>
          </div>
          <div style={{ ...card, height:380, display:"flex", alignItems:"center", justifyContent:"center" }}>
            <div style={{ textAlign:"center", color:t.textMuted }}>
              <Activity size={32} style={{ display:"block", margin:"0 auto 10px", animation:"sa-pulse 1.5s infinite" }}/>
              <p style={{ fontSize:13, margin:0 }}>Loading {symbolRef.current || "stock"} data…</p>
            </div>
          </div>
        </div>
      )}

      {!stock && !initialLoading && !fetchError && (
        <div style={{ ...card, minHeight:400, display:"flex", flexDirection:"column",
          alignItems:"center", justifyContent:"center", textAlign:"center" }}>
          <div style={{ width:68, height:68, borderRadius:"50%", marginBottom:16,
            background:`${t.accentPrimary || "#3b82f6"}18`, border:`1px solid ${t.accentPrimary || "#3b82f6"}30`,
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:`0 0 30px ${t.glowPrimary || "rgba(59,130,246,0.2)"}` }}>
            <Search size={28} style={{ color: t.accentPrimary || "#60a5fa" }}/>
          </div>
          <h2 style={{ margin:"0 0 8px", fontSize:17, fontWeight:700, fontFamily:"'Syne', sans-serif", color:t.textPrimary }}>
            Search for a Stock
          </h2>
          <p style={{ margin:"0 0 20px", fontSize:12, color:t.textSecondary }}>Enter a symbol above — US or Indian</p>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap", justifyContent:"center" }}>
            {["AAPL", "TSLA", "NVDA", "GOOGL", "RELIANCE.NS", "TCS.NS", "INFY.NS"].map((s) => (
              <button key={s}
                onClick={() => { setInputSym(s); symbolRef.current = s; analyzeStock(s, "1M", "search"); }}
                onMouseEnter={e => {
                  prefetch(`stock:${s}:1M`, () => api.get(`/stock/${s}?range=1M`), TTL.stock);
                  e.currentTarget.style.borderColor = `${t.accentPrimary || "#3b82f6"}60`;
                  e.currentTarget.style.color = t.accentPrimary || "#60a5fa";
                  e.currentTarget.style.background = `${t.accentPrimary || "#3b82f6"}10`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = t.border;
                  e.currentTarget.style.color = t.textSecondary;
                  e.currentTarget.style.background = t.inputBg;
                }}
                style={{ padding:"6px 13px", borderRadius:9, fontSize:11, fontWeight:600,
                  cursor:"pointer", background:t.inputBg, border:`1px solid ${t.border}`,
                  color:t.textSecondary, transition:"all .2s" }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {stock && !initialLoading && (
        <>
          {/* Stock Header */}
          <div style={{ ...card, marginBottom:16, display:"flex",
            justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12 }}>
            <div>
              <h2 style={{ margin:0, fontSize:"clamp(18px,4vw,22px)", fontWeight:800,
                letterSpacing:"-.03em", fontFamily:"'Syne', sans-serif", color:t.textPrimary }}>{stock.symbol}</h2>
              <p style={{ margin:"3px 0 0", fontSize:11, color:t.textMuted }}>
                {stock.name || stock.symbol} · {stock.exchange || (isIndianSym(stock.symbol) ? "NSE" : "NASDAQ")}
              </p>
            </div>
            <div style={{ textAlign:"right" }}>
              <p style={{ margin:0, fontSize:"clamp(20px,4vw,26px)", fontWeight:800,
                letterSpacing:"-.04em", color:t.textPrimary }}>
                {fmtPrice(stock.price, stock.symbol)}
              </p>
              <p style={{ margin:"3px 0 0", fontSize:12, fontWeight:600,
                display:"flex", alignItems:"center", justifyContent:"flex-end", gap:4,
                color: chgUp ? "#34d399" : "#f87171" }}>
                {chgUp ? <TrendingUp size={12}/> : <TrendingDown size={12}/>}
                {chgUp ? "+" : ""}{stock.changePercent}%
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display:"flex", marginBottom:16, flexWrap:"wrap", gap:10 }}>
            <button onClick={runAI} disabled={aiLoading}
              style={{ display:"flex", alignItems:"center", gap:7, padding:"8px 16px",
                borderRadius:10, fontSize:12, fontWeight:600, cursor:"pointer",
                transition:"all .2s", opacity:aiLoading ? .6 : 1, ...accentBtn }}
              onMouseEnter={e => { if (!aiLoading) e.currentTarget.style.transform = "translateY(-1px)"; }}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
              {aiLoading ? <RefreshCw size={13} style={{ animation:"sa-spin 1s linear infinite" }}/> : <Brain size={13}/>}
              {aiLoading ? "Analyzing…" : "Quick AI Signal"}
            </button>

            <button onClick={handleRefresh} disabled={activeBtn === "refresh"}
              style={{ display:"flex", alignItems:"center", gap:6, padding:"8px 13px",
                borderRadius:10, fontSize:12, fontWeight:600, cursor:"pointer",
                background:t.inputBg, border:`1px solid ${t.border}`, color:t.textSecondary,
                transition:"all .2s", opacity:activeBtn === "refresh" ? .6 : 1 }}>
              <RefreshCw size={13} style={activeBtn === "refresh" ? { animation:"sa-spin 1s linear infinite" } : {}}/>
              Refresh
            </button>

            {/* Favorites */}
            {(() => {
              const sym    = stock.symbol;
              const active = isFavorite(sym);
              return (
                <button
                  onClick={() => active ? removeFavorite(sym) : addFavorite(sym)}
                  title={active ? "Remove from favorites" : "Add to favorites"}
                  style={{
                    display:"flex", alignItems:"center", gap:6,
                    padding:"8px 14px", borderRadius:10, fontSize:12, fontWeight:600,
                    cursor:"pointer", transition:"all .22s cubic-bezier(.22,1,.36,1)",
                    background: active ? "rgba(251,191,36,0.15)" : t.inputBg,
                    border:`1px solid ${active ? "rgba(251,191,36,0.38)" : t.border}`,
                    color: active ? "#fbbf24" : t.textSecondary,
                    boxShadow: active ? "0 2px 14px rgba(251,191,36,0.22)" : "none",
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.transform = "translateY(-1px)";
                    if (!active) {
                      e.currentTarget.style.borderColor = "rgba(251,191,36,0.38)";
                      e.currentTarget.style.color = "#fbbf24";
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.transform = "translateY(0)";
                    if (!active) {
                      e.currentTarget.style.borderColor = t.border;
                      e.currentTarget.style.color = t.textSecondary;
                    }
                  }}>
                  <Star size={13} style={{ fill: active ? "#fbbf24" : "none", strokeWidth: 2, transition:"fill .2s" }}/>
                  {active ? "Favorited" : "Add to Favorites"}
                </button>
              );
            })()}

            {/* Range selector */}
            <div style={{ display:"flex", gap:3, background:t.inputBg, border:`1px solid ${t.border}`,
              borderRadius:10, padding:3, marginLeft:"auto" }}>
              {ALL_RANGES.map((r) => (
                <button key={r} onClick={() => handleRangeChange(r)} disabled={activeBtn === r}
                  style={{ padding:"5px 10px", borderRadius:8, fontSize:11, fontWeight:600,
                    cursor:"pointer", border:"none", transition:"all .2s",
                    background: range === r ? (t.gradient || "#3b82f6") : "transparent",
                    color: range === r ? "#fff" : t.textSecondary,
                    display:"flex", alignItems:"center", gap:3 }}>
                  {activeBtn === r && <RefreshCw size={9} style={{ animation:"sa-spin 1s linear infinite" }}/>}
                  {r}
                </button>
              ))}
            </div>

            {/* Chart type toggle */}
            <div style={{ display:"flex", gap:3, background:t.inputBg, border:`1px solid ${t.border}`,
              borderRadius:10, padding:3 }}>
              {[["line", <LineChart size={14}/>], ["candle", <CandlestickChart size={14}/>]].map(([type, icon]) => (
                <button key={type} onClick={() => setChartType(type)}
                  style={{ padding:"5px 8px", borderRadius:8, cursor:"pointer", border:"none",
                    background: chartType === type ? (t.gradient || "#3b82f6") : "transparent",
                    color: chartType === type ? "#fff" : t.textSecondary, transition:"all .2s" }}>
                  {icon}
                </button>
              ))}
            </div>
          </div>

          {/* Row 1: Price Chart + Quick AI Signal */}
          <div className="analyze-chart-grid" style={{ display:"grid", gridTemplateColumns:"minmax(0,1fr) minmax(240px,28%)", gap:16, marginBottom:16 }}>
            <div style={{ ...card, minHeight:340, position:"relative" }}>
              <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:700, color:t.textPrimary, letterSpacing:"-0.01em" }}>Price Chart</p>
              {chartLoading && <ChartOverlay isDark={isDark}/>}
              {chartType === "line"
                ? <PriceChartLine data={stock.chart}/>
                : <PriceChart data={stock.chart} indicators={stock.indicators} liveTick={stock.liveTick}/>}
            </div>

            {/* Quick AI Signal panel */}
            <div style={{ ...card, display:"flex", flexDirection:"column" }}>
              <p style={{ margin:"0 0 14px", fontSize:12, fontWeight:600,
                display:"flex", alignItems:"center", gap:7, color:t.textPrimary }}>
                <Brain size={14} style={{ color: t.accentSecond || "#a78bfa" }}/> Quick AI Signal
              </p>

              {aiError && !aiLoading && (
                <div style={{ padding:"10px 12px", borderRadius:10, marginBottom:12,
                  background:"rgba(239,68,68,.09)", border:"1px solid rgba(239,68,68,.22)" }}>
                  <p style={{ margin:0, fontSize:12, color:"#fca5a5", fontWeight:600 }}>Analysis failed</p>
                  <p style={{ margin:"3px 0 6px", fontSize:11, color:"rgba(252,165,165,.7)" }}>{aiError}</p>
                  <button onClick={runAI} style={{ fontSize:11, color:"#60a5fa", background:"none",
                    border:"none", cursor:"pointer", padding:0, textDecoration:"underline" }}>Retry</button>
                </div>
              )}

              {!aiLoading && !aiResult && !aiError && (
                <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                  justifyContent:"center", textAlign:"center", color:t.textMuted, padding:"16px 0" }}>
                  <Brain size={36} style={{ marginBottom:12, opacity:.25 }}/>
                  <p style={{ fontSize:11, margin:0, lineHeight:1.6 }}>
                    Click <strong style={{ color: t.accentPrimary || "#60a5fa" }}>Quick AI Signal</strong><br/>to get a BUY/SELL signal
                  </p>
                </div>
              )}

              {aiLoading && (
                <div style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center",
                  justifyContent:"center", color: t.accentSecond || "#a78bfa", padding:"16px 0" }}>
                  <Brain size={32} style={{ marginBottom:10, animation:"sa-pulse 1.5s infinite" }}/>
                  <p style={{ fontSize:11, margin:0 }}>Analyzing market data…</p>
                </div>
              )}

              {aiResult && !aiLoading && (
                <>
                  <div style={{ borderRadius:13, padding:"16px 14px", marginBottom:12, textAlign:"center",
                    background: aiResult.action === "BUY"  ? "rgba(16,185,129,.12)"
                               : aiResult.action === "SELL" ? "rgba(239,68,68,.12)" : "rgba(234,179,8,.12)",
                    border:`1px solid ${aiResult.action === "BUY" ? "rgba(16,185,129,.22)" : aiResult.action === "SELL" ? "rgba(239,68,68,.22)" : "rgba(234,179,8,.22)"}` }}>
                    <p style={{ margin:0, fontSize:26, fontWeight:800,
                      color: aiResult.action === "BUY" ? "#34d399" : aiResult.action === "SELL" ? "#f87171" : "#fbbf24" }}>
                      {aiResult.action}
                    </p>
                    <p style={{ margin:"5px 0 8px", fontSize:11, color:t.textMuted }}>Confidence: {aiResult.confidence}%</p>
                    <div style={{ height:3, background:t.inputBg, borderRadius:4, overflow:"hidden" }}>
                      <div style={{ height:"100%", borderRadius:4, transition:"width .8s ease",
                        width:`${aiResult.confidence}%`,
                        background: aiResult.action === "BUY" ? "#34d399" : aiResult.action === "SELL" ? "#f87171" : "#fbbf24" }}/>
                    </div>
                  </div>
                  <div style={{ background:t.inputBg, border:`1px solid ${t.border}`,
                    borderRadius:11, padding:13, fontSize:11, color:t.textSecondary, lineHeight:1.7, flex:1 }}>
                    {aiResult.summary}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Row 2: Full AI Prediction Engine (LSTM + XGBoost + FinBERT) */}
          <div style={{ marginBottom:16 }}>
            <AIPrediction symbol={stock.symbol} />
          </div>

          {/* Key Metrics */}
          <div style={{ ...card, marginBottom:16 }}>
            <p style={{ margin:"0 0 12px", fontSize:13, fontWeight:700, color:t.textPrimary, letterSpacing:"-0.01em" }}>Key Metrics</p>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:10 }}>
              <Metric label="Open"       value={fmtPrice(stock.open,      stock.symbol)}/>
              <Metric label="High"       value={fmtPrice(stock.high,      stock.symbol)}/>
              <Metric label="Low"        value={fmtPrice(stock.low,       stock.symbol)}/>
              <Metric label="Prev Close" value={fmtPrice(stock.prevClose, stock.symbol)}/>
              <Metric label="Volume"     value={fmtVol(stock.chart?.at(-1)?.volume)}/>
              <Metric label="Signal"
                value={stock.indicators?.signal || "--"}
                pos={stock.indicators?.signal === "BUY" ? true : stock.indicators?.signal === "SELL" ? false : undefined}/>
            </div>
          </div>

          {/* RSI */}
          <div style={{ ...card, marginBottom:16, position:"relative" }}>
            <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:600,
              display:"flex", alignItems:"center", gap:8, color:t.textPrimary }}>
              RSI (14)
              {stock.indicators?.rsi != null && (
                <span style={{ fontSize:11, padding:"2px 8px", borderRadius:20, fontWeight:700,
                  background: stock.indicators.rsi > 70 ? "rgba(239,68,68,.14)" : stock.indicators.rsi < 30 ? "rgba(16,185,129,.14)" : t.inputBg,
                  color:     stock.indicators.rsi > 70 ? "#f87171" : stock.indicators.rsi < 30 ? "#34d399" : t.textMuted,
                  border:`1px solid ${stock.indicators.rsi > 70 ? "rgba(239,68,68,.22)" : stock.indicators.rsi < 30 ? "rgba(16,185,129,.22)" : t.border}` }}>
                  {stock.indicators.rsi.toFixed(1)}
                  {stock.indicators.rsi > 70 ? " · Overbought" : stock.indicators.rsi < 30 ? " · Oversold" : ""}
                </span>
              )}
            </p>
            {chartLoading && <ChartOverlay isDark={isDark}/>}
            <RSIChart data={stock.chart}/>
          </div>

          {/* MACD */}
          <div style={{ ...card, position:"relative" }}>
            <p style={{ margin:"0 0 10px", fontSize:12, fontWeight:600,
              display:"flex", alignItems:"center", gap:8, color:t.textPrimary }}>
              MACD
              {stock.indicators?.macd != null && (
                <span style={{ fontSize:12, fontWeight:700, color: stock.indicators.macd > 0 ? "#34d399" : "#f87171" }}>
                  {stock.indicators.macd > 0 ? "▲" : "▼"} {Math.abs(stock.indicators.macd).toFixed(4)}
                </span>
              )}
            </p>
            {chartLoading && <ChartOverlay isDark={isDark}/>}
            <MACDChart data={stock.chart}/>
          </div>
        </>
      )}

      <style>{`
        @media(max-width:900px){ .analyze-chart-grid{ grid-template-columns:1fr !important; } }
      `}</style>
    </AppShell>
    <NotificationStack toasts={toasts} onDismiss={dismiss} theme={t}/>
    </>
  );
};

export default Analyze;