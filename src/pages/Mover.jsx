import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp, TrendingDown, RefreshCw,
  ArrowUpRight, ArrowDownRight, ChevronRight, AlertTriangle,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import AppShell from "./AppShell.jsx";
import { useTheme }   from "../context/ThemeContext.jsx";
import { tokens }     from "../context/theme.js";
import { api }        from "../utils/api.js";
import useAuthGuard   from "../hooks/useAuthGuard.js";

/* ─── helpers ─── */
const fmtPrice = (price, currency) =>
  currency === "INR"
    ? "₹" + Number(price).toLocaleString("en-IN", { minimumFractionDigits: 2 })
    : "$" + Number(price).toFixed(2);

const timeSince = (iso) => {
  if (!iso) return null;
  const s = Math.floor((Date.now() - new Date(iso)) / 1000);
  if (s < 60)   return s + "s ago";
  if (s < 3600) return Math.floor(s / 60) + "m ago";
  return Math.floor(s / 3600) + "h ago";
};

/* ═══════════════════════════════════════════════
   MOVERS PAGE
═══════════════════════════════════════════════ */
const Movers = () => {
  useAuthGuard();
  const { isDark, theme } = useTheme();
  const t          = tokens(theme);
  const navigate   = useNavigate();

  const [data,    setData]    = useState(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState("");
  const [market,  setMarket]  = useState("ALL");
  const [tick,    setTick]    = useState(0);

  // showSpinner=true  → manual Refresh button → forceGet (busts server cache)
  // showSpinner=false → background interval   → plain get (server cache fine)
  const fetchMovers = useCallback(async (showSpinner = true) => {
    if (showSpinner) setLoading(true);

    try {
      // ✅ FIX: Server caches movers for 2 min (stockCache.js).
      // api.get() bypasses frontend cache but hits the server cache,
      // so the Refresh button appeared to do nothing — same data returned.
      // forceGet sends ?force=true → server skips its cache → real fresh data.
      const res = showSpinner
        ? await api.forceGet("/movers", "movers:")
        : await api.get("/movers");

      if (!res) return;
      if (res.error) throw new Error(res.error);

      setData(res);
      setError("");
    } catch (err) {
      setError(err.message || "Failed to fetch market data");
    } finally {
      setLoading(false);
    }
  }, []);

  // ✅ FIX: Split into two separate effects:
  //   1. Initial fetch (depends on fetchMovers — runs once since it's stable)
  //   2. Interval (empty deps — never re-runs, never resets the timer)
  useEffect(() => {
    fetchMovers(true);
  }, [fetchMovers]);

  useEffect(() => {
    // ✅ FIX: Interval is in its own effect with empty deps.
    // Previously the interval was inside useEffect([fetchMovers]).
    // Any re-render that caused fetchMovers identity to change would
    // cancel + restart the interval, resetting the 2-min clock.
    const id = setInterval(() => fetchMovers(false), 2 * 60 * 1000);
    return () => clearInterval(id);
  }, []); // intentionally empty — set once, never reset

  // tick for "updated X ago" display
  useEffect(() => {
    const id = setInterval(() => setTick(v => v + 1), 1000);
    return () => clearInterval(id);
  }, []);

  const handleRefresh = () => fetchMovers(true); // true = showSpinner → uses forceGet

  const filter = list => {
    if (!list) return [];
    if (market === "US") return list.filter(s => s.market === "US");
    if (market === "IN") return list.filter(s => s.market === "IN");
    return list;
  };

  const gainers = filter(data?.gainers) || [];
  const losers  = filter(data?.losers)  || [];

  return (
    <AppShell activePage="/movers">

      {/* ── HEADER ── */}
      <div className="flex-row slideUp"
        style={{ justifyContent:"space-between", marginBottom:22, flexWrap:"wrap", gap:12 }}>
        <div>
          <h1 style={{ margin:0, fontSize:"clamp(18px,4vw,24px)", fontWeight:800,
            letterSpacing:"-.04em", color:t.textPrimary,
            display:"flex", alignItems:"center", gap:10 }}>
            <span style={{ color:"#FBBF24", textShadow:"0 0 24px rgba(251,191,36,0.55), 0 2px 4px rgba(0,0,0,0.4)", fontFamily:"'Syne',sans-serif" }}>
              ⚡ Top Movers
            </span>
          </h1>
          <p style={{ margin:"4px 0 12px", fontSize:12, color:t.textSecondary }}>
            Real-time top gainers & losers — US + NSE India
          </p>
          <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
            <MarketPill market="US" t={t} isDark={isDark}/>
            <MarketPill market="IN" t={t} isDark={isDark}/>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          {data?.fetchedAt && (
            // ✅ tick state drives re-render so "X ago" updates every second
            <span style={{ fontSize:11, color:t.textMuted }}>
              Updated {timeSince(data.fetchedAt)}
            </span>
          )}
          {data?.meta && (
            <span style={{ fontSize:10, color:t.textMuted }}>
              {data.meta.us} US · {data.meta.nse} NSE
            </span>
          )}
          <button onClick={handleRefresh} disabled={loading} style={{
            display:"flex", alignItems:"center", gap:7, padding:"8px 16px",
            borderRadius:11, fontSize:12, fontWeight:600,
            background:"linear-gradient(135deg,#3b82f6,#6366f1)",
            border:"none", color:"#fff", cursor:"pointer",
            opacity:loading ? .6 : 1,
            boxShadow:"0 4px 14px rgba(59,130,246,.3)", transition:"all .2s",
          }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}
          >
            <RefreshCw size={13} style={loading ? { animation:"sa-spin 1s linear infinite" } : {}}/>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </div>

      {/* ── FILTER TABS ── */}
      <div className="flex-row slideUp1"
        style={{ justifyContent:"space-between", marginBottom:18, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", gap:3, background:t.inputBg,
          border:`1px solid ${t.border}`, borderRadius:12, padding:3 }}>
          {[
            { k:"ALL", l:"All Markets" },
            { k:"US",  l:"🇺🇸 US" },
            { k:"IN",  l:"🇮🇳 NSE India" },
          ].map(({ k, l }) => (
            <button key={k} onClick={() => setMarket(k)} style={{
              padding:"6px 14px", borderRadius:9, fontSize:12, fontWeight:600,
              cursor:"pointer", border:"none", transition:"all .2s",
              background: market === k ? "linear-gradient(135deg,#3b82f6,#6366f1)" : "transparent",
              color:       market === k ? "#fff" : t.textSecondary,
              boxShadow:   market === k ? "0 2px 10px rgba(59,130,246,.3)" : "none",
            }}>
              {l}
            </button>
          ))}
        </div>

        {!loading && data && (
          <div style={{ display:"flex", gap:7 }}>
            <Chip color="#10b981" icon={<TrendingUp size={10}/>} label={`${gainers.length} gainers`}/>
            <Chip color="#f87171" icon={<TrendingDown size={10}/>} label={`${losers.length} losers`}/>
          </div>
        )}
      </div>

      {/* ── ERROR ── */}
      {error && (
        <div style={{
          display:"flex", alignItems:"flex-start", gap:12,
          background:"rgba(239,68,68,.09)", border:"1px solid rgba(239,68,68,.25)",
          borderRadius:14, padding:"13px 16px", marginBottom:18,
          animation:"sa-slideUp .3s ease both",
        }}>
          <AlertTriangle size={15} style={{ color:"#f87171", flexShrink:0, marginTop:1 }}/>
          <div style={{ flex:1 }}>
            <p style={{ margin:"0 0 3px", fontWeight:600, fontSize:13, color:"#fca5a5" }}>
              Failed to load market data
            </p>
            <p style={{ margin:"0 0 8px", fontSize:12, color:"rgba(252,165,165,.75)" }}>{error}</p>
            <button onClick={handleRefresh} style={{
              fontSize:11, color:"#60a5fa", background:"none",
              border:"1px solid rgba(96,165,250,.3)", borderRadius:7,
              padding:"3px 9px", cursor:"pointer" }}>
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* ── MOVERS GRID ── */}
      <div className="g2 slideUp2">
        <MoversCard title="Top Gainers" type="gainer"
          stocks={gainers} loading={loading} navigate={navigate} isDark={isDark} t={t}/>
        <MoversCard title="Top Losers" type="loser"
          stocks={losers}  loading={loading} navigate={navigate} isDark={isDark} t={t}/>
      </div>

      {/* ── FOOTER NOTE ── */}
      {!loading && data && (
        <p style={{ textAlign:"center", fontSize:10, color:t.textMuted, marginTop:20 }}>
          Data: Yahoo Finance (primary) · Finnhub (US fallback) · Auto-refresh every 2 min
          {data.meta?.crumbUsed && " · Crumb auth ✓"}
        </p>
      )}
    </AppShell>
  );
};

/* ── Movers panel ── */
const MoversCard = ({ title, type, stocks, loading, navigate, isDark, t }) => {
  const isG = type === "gainer";
  const acc = isG ? "#10b981" : "#f87171";
  return (
    <div style={{
      borderRadius:20, overflow:"hidden",
      background: t.cardGradient,
      border:`1px solid ${acc}20`,
      backdropFilter:"blur(24px) saturate(1.4)", WebkitBackdropFilter:"blur(24px) saturate(1.4)",
      boxShadow:`${t.shadow}, inset 0 1px 0 ${t.glassEdge}`,
      transition:"background .35s", position:"relative",
    }}>
      {/* Panel header */}
      <div style={{
        display:"flex", alignItems:"center", gap:10, padding:"13px 16px",
        borderBottom:`1px solid ${acc}14`,
        background:`linear-gradient(90deg,${acc}0d,transparent)`,
      }}>
        <div style={{ padding:7, borderRadius:9, background:`${acc}18`, border:`1px solid ${acc}28` }}>
          {isG
            ? <TrendingUp  size={13} style={{ color:acc }}/>
            : <TrendingDown size={13} style={{ color:acc }}/>}
        </div>
        <span style={{ fontSize:14, fontWeight:700, color:acc, textShadow:`0 0 12px ${acc}` }}>{title}</span>
        {!loading && stocks.length > 0 && (
          <span style={{
            marginLeft:"auto", fontSize:9, padding:"2px 8px", borderRadius:20,
            background:`${acc}12`, color:acc, border:`1px solid ${acc}22`, fontWeight:600,
          }}>
            {stocks.filter(s => s.market === "IN").length} IN
            {" · "}
            {stocks.filter(s => s.market === "US").length} US
          </span>
        )}
      </div>

      {/* Rows */}
      <div style={{ padding:"4px 3px" }}>
        {loading
          ? Array.from({ length:6 }).map((_, i) => <SkeleRow key={i} t={t}/>)
          : stocks.length === 0
            ? (
              <div style={{ textAlign:"center", padding:"48px 0", color:t.textMuted }}>
                <p style={{ fontSize:13, margin:0 }}>No {type === "gainer" ? "gainers" : "losers"} found</p>
                <p style={{ fontSize:11, margin:"6px 0 0", opacity:.6 }}>
                  Try switching market filter or refreshing
                </p>
              </div>
            )
            : stocks.map((s, i) => (
              <StockRow key={s.symbol} stock={s} rank={i+1}
                isGainer={isG} acc={acc} t={t}
                onClick={() => navigate("/analyze?symbol=" + s.symbol)}/>
            ))
        }
      </div>
    </div>
  );
};

/* ── Stock row ── */
const StockRow = ({ stock, rank, isGainer, acc, t, onClick }) => {
  const [h, setH] = useState(false);
  const isIN = stock.market === "IN";
  return (
    <div onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"9px 14px", borderRadius:10, margin:"2px 3px",
        cursor:"pointer",
        background:  h ? `${acc}0e` : "transparent",
        border:      h ? `1px solid ${acc}1c` : "1px solid transparent",
        transform:   h ? "translateX(3px)" : "translateX(0)",
        transition:  "all .15s",
      }}>
      {/* Rank */}
      <span style={{ width:16, textAlign:"center", fontSize:10,
        color:t.textMuted, fontFamily:"monospace", flexShrink:0 }}>
        {rank}
      </span>
      {/* Avatar */}
      <div style={{
        width:33, height:33, borderRadius:9, flexShrink:0,
        background:`${acc}18`, border:`1px solid ${acc}25`,
        display:"flex", alignItems:"center", justifyContent:"center",
        fontSize:8, fontWeight:800, color:acc,
        boxShadow: h ? `0 3px 10px ${acc}22` : "none",
        transition:"all .15s",
      }}>
        {stock.symbol.replace(/\.(NS|BO)$/i, "").slice(0, 4)}
      </div>
      {/* Symbol + HL */}
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:5, marginBottom:1 }}>
          <span style={{ fontSize:12, fontWeight:700, color:t.textPrimary,
            overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
            textShadow:"0 1px 3px rgba(0,0,0,0.4)" }}>
            {stock.symbol}
          </span>
          <span style={{
            fontSize:8, padding:"1px 5px", borderRadius:5, fontWeight:600, flexShrink:0,
            background: isIN ? "rgba(251,146,60,.14)" : "rgba(96,165,250,.14)",
            color:      isIN ? "#fb923c"              : "#60a5fa",
            border:     `1px solid ${isIN ? "rgba(251,146,60,.22)" : "rgba(96,165,250,.22)"}`,
          }}>
            {isIN ? "NSE" : "US"}
          </span>
        </div>
        <p style={{ fontSize:9, color:t.textSecondary, margin:0,
          overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
          H: {fmtPrice(stock.high, stock.currency)} · L: {fmtPrice(stock.low, stock.currency)}
        </p>
      </div>
      {/* Price + change */}
      <div style={{ textAlign:"right", flexShrink:0 }}>
        <p style={{ fontSize:13, fontWeight:700, color:t.textPrimary, margin:0 }}>
          {fmtPrice(stock.price, stock.currency)}
        </p>
        <p style={{ fontSize:10, fontWeight:700, color:acc, margin:0,
          display:"flex", alignItems:"center", justifyContent:"flex-end", gap:1 }}>
          {isGainer ? <ArrowUpRight size={10}/> : <ArrowDownRight size={10}/>}
          {isGainer && stock.changePercent > 0 ? "+" : ""}
          {stock.changePercent}%
        </p>
      </div>
      <ChevronRight size={12} style={{ color:h ? t.textSecondary : "transparent",
        flexShrink:0, transition:"color .15s" }}/>
    </div>
  );
};

/* ── Skeleton row ── */
const SkeleRow = ({ t }) => (
  <div style={{ display:"flex", gap:10, padding:"9px 14px", alignItems:"center", opacity:.4 }}>
    <div style={{ width:16, height:8,  background:t.inputBg, borderRadius:3, flexShrink:0 }}/>
    <div style={{ width:33, height:33, background:t.inputBg, borderRadius:9,  flexShrink:0 }}/>
    <div style={{ flex:1 }}>
      <div style={{ width:"44%", height:8, background:t.inputBg, borderRadius:3, marginBottom:5 }}/>
      <div style={{ width:"28%", height:7, background:t.inputBg, borderRadius:3 }}/>
    </div>
    <div>
      <div style={{ width:46, height:8, background:t.inputBg, borderRadius:3, marginBottom:5, marginLeft:"auto" }}/>
      <div style={{ width:32, height:7, background:t.inputBg, borderRadius:3, marginLeft:"auto" }}/>
    </div>
  </div>
);

/* ── Chip ── */
const Chip = ({ color, icon, label }) => (
  <span style={{ display:"flex", alignItems:"center", gap:5, fontSize:11, fontWeight:600,
    padding:"4px 10px", borderRadius:20,
    background:`${color}12`, color, border:`1px solid ${color}22` }}>
    {icon} {label}
  </span>
);

/* ── Market open/closed pill ── */
const MarketPill = ({ market, t, isDark }) => {
  const now  = new Date();
  const ud   = now.getUTCDay();
  const um   = now.getUTCHours() * 60 + now.getUTCMinutes();
  const open = market === "US"
    ? ud >= 1 && ud <= 5 && um >= 810 && um < 1200
    : ud >= 1 && ud <= 5 && um >= 225 && um < 600;
  const col   = market === "US" ? "#3b82f6" : "#10b981";
  const label = market === "US" ? "🇺🇸 NYSE" : "🇮🇳 NSE";
  const hours = market === "US" ? "9:30–4 PM ET" : "9:15–3:30 IST";
  return (
    <div style={{
      display:"flex", alignItems:"center", gap:5,
      padding:"4px 10px", borderRadius:20, fontSize:10, fontWeight:600,
      background: open ? `${col}12` : t.inputBg,
      border:     `1px solid ${open ? col + "28" : t.border}`,
      color:      open ? col : t.textMuted,
      transition: "all .35s",
    }}>
      <span style={{ width:5, height:5, borderRadius:"50%", flexShrink:0,
        background: open ? col : t.textMuted,
        boxShadow:  open ? `0 0 7px ${col}` : "none",
        animation:  open ? "sa-pulse 2s infinite" : "none",
        display:"inline-block",
      }}/>
      {label} {open ? "Open" : "Closed"}
      <span style={{ color:t.textMuted, marginLeft:2 }}>· {hours}</span>
    </div>
  );
};

export default Movers;