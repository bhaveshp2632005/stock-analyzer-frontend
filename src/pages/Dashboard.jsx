/**
 * Dashboard.jsx — Full 3D Premium Design
 * Glassmorphism + Layered depth + Neon accents + Perspective tilt
 */

import React, { useState, useEffect, useCallback, useRef } from "react";
import {
  TrendingUp, TrendingDown, Clock, ArrowUpRight, ArrowDownRight,
  RefreshCw, Brain, Zap, Search, Sparkles, Activity,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppShell          from "./AppShell.jsx";
import { useTheme }      from "../context/ThemeContext.jsx";
import { tokens }        from "../context/theme.js";
import { api, TTL }      from "../utils/api.js";
import { prefetch }      from "../utils/apiCache.js";
import { getUser }       from "../utils/auth.js";
import useAuthGuard      from "../hooks/useAuthGuard.js";
import { useFavorites }  from "../hooks/useFavorites.js";
import FavoritesSection  from "./FavoritesSection.jsx";
import { NotificationStack, useAlertNotifications } from "./AlertNotification.jsx";

const POPULAR = [
  { symbol:"AAPL",  name:"Apple",     logo:"🍎" },
  { symbol:"GOOGL", name:"Alphabet",  logo:"🔵" },
  { symbol:"MSFT",  name:"Microsoft", logo:"🪟" },
  { symbol:"TSLA",  name:"Tesla",     logo:"⚡" },
  { symbol:"AMZN",  name:"Amazon",    logo:"📦" },
  { symbol:"NVDA",  name:"NVIDIA",    logo:"🟢" },
];

const MOVERS_BG_INTERVAL = 2 * 60 * 1000;

const fmtPrice = (price, currency) =>
  currency === "INR"
    ? "₹" + Number(price).toLocaleString("en-IN", { minimumFractionDigits: 2 })
    : "$" + Number(price).toFixed(2);

/* ── 3D mouse-tilt hook ── */
const useTilt = (strength = 8) => {
  const ref = useRef(null);
  const onMouseMove = (e) => {
    if (!ref.current) return;
    const { left, top, width, height } = ref.current.getBoundingClientRect();
    const x = ((e.clientX - left) / width  - 0.5) *  strength;
    const y = ((e.clientY - top)  / height - 0.5) * -strength;
    ref.current.style.transform = `perspective(900px) rotateX(${y}deg) rotateY(${x}deg) translateZ(8px)`;
  };
  const onMouseLeave = () => {
    if (ref.current)
      ref.current.style.transform = "perspective(900px) rotateX(0) rotateY(0) translateZ(0)";
  };
  return { ref, onMouseMove, onMouseLeave };
};

/* ── Dashboard ── */
const Dashboard = () => {
  useAuthGuard();
  const { isDark, theme } = useTheme();
  const t        = tokens(theme);
  const user     = getUser();
  const navigate = useNavigate();

  const [searchInput,  setSearchInput]  = useState("");
  const [popularData,  setPopularData]  = useState({});
  const [loadedCount,  setLoadedCount]  = useState(0);
  const [history,      setHistory]      = useState([]);
  const [historyLoad,  setHistoryLoad]  = useState(true);
  const [gainers,      setGainers]      = useState([]);
  const [losers,       setLosers]       = useState([]);
  const [moversLoad,   setMoversLoad]   = useState(true);
  const [moversBgLoad, setMoversBgLoad] = useState(false);
  const [moversError,  setMoversError]  = useState("");
  const [refreshPulse, setRefreshPulse] = useState(false);
  const isMountedRef = useRef(true);

  /* ── Favorites + Alert system ── */
  const { toasts, notify, dismiss } = useAlertNotifications();
  const {
    favorites, prices: favPrices, loading: favLoading,
    addFavorite, removeFavorite, updateAlert, isFavorite, refreshPrices,
  } = useFavorites(notify);

  useEffect(() => { isMountedRef.current = true; return () => { isMountedRef.current = false; }; }, []);

  /* History */
  useEffect(() => {
    (async () => {
      try {
        setHistoryLoad(true);
        const d = await api.cachedGet("/analysis", "analysis:list", TTL.analysis);
        if (isMountedRef.current) setHistory(Array.isArray(d) ? d : []);
      } catch (e) { console.error(e); }
      finally { if (isMountedRef.current) setHistoryLoad(false); }
    })();
  }, []);

  /* Popular stocks */
  useEffect(() => {
    POPULAR.forEach(({ symbol }) => {
      api.cachedGet(`/stock/${symbol}/quick`, `quick:${symbol}`, TTL.stock)
        .then(d => {
          if (!isMountedRef.current) return;
          setPopularData(prev => ({ ...prev, [symbol]: d }));
          setLoadedCount(n => n + 1);
        }).catch(() => { if (isMountedRef.current) setLoadedCount(n => n + 1); });
    });
  }, []);

  /* Movers - initial */
  useEffect(() => {
    (async () => {
      try {
        setMoversLoad(true);
        const d = await api.get("/movers");
        if (!isMountedRef.current) return;
        setGainers(d.gainers || []); setLosers(d.losers || []);
      } catch (e) { if (isMountedRef.current) setMoversError(String(e?.message || "Failed")); }
      finally { if (isMountedRef.current) setMoversLoad(false); }
    })();
  }, []);

  /* Movers - background interval */
  useEffect(() => {
    const id = setInterval(async () => {
      if (!isMountedRef.current) return;
      try {
        setMoversBgLoad(true);
        const d = await api.get("/movers");
        if (!isMountedRef.current) return;
        setGainers(d.gainers || []); setLosers(d.losers || []);
      } catch {} finally { if (isMountedRef.current) setMoversBgLoad(false); }
    }, MOVERS_BG_INTERVAL);
    return () => clearInterval(id);
  }, []);

  const goAnalyze = useCallback((sym) => navigate(`/analyze?symbol=${sym}`), [navigate]);
  const handleSearch = () => { if (searchInput.trim()) goAnalyze(searchInput.trim().toUpperCase()); };

  const handleMoversRefresh = useCallback(async () => {
    if (moversLoad) return;
    setRefreshPulse(true);
    setTimeout(() => setRefreshPulse(false), 500);
    try {
      setMoversLoad(true);
      const d = await api.forceGet("/movers?force=true");
      if (!isMountedRef.current) return;
      setMoversError("");
      setGainers(d.gainers || []); setLosers(d.losers || []);
    } catch (e) { if (isMountedRef.current) setMoversError(String(e?.message || "Failed")); }
    finally { if (isMountedRef.current) setMoversLoad(false); }
  }, [moversLoad]);

  const totalAnalyses = history.length;
  const buySignals    = history.filter(h => h.signal === "BUY").length;
  const sellSignals   = history.filter(h => h.signal === "SELL").length;
  const avgConf       = history.length
    ? Math.round(history.reduce((s,h) => s + (h.confidence||0), 0) / history.length) : 0;
  const allLoaded = loadedCount >= POPULAR.length;

  /* ── Shared card style ── */
  const card = (accent) => ({
    background:           t.cardGradient,
    border:               `1px solid ${accent ? accent+"35" : t.border}`,
    borderRadius:         22,
    backdropFilter:       "blur(28px) saturate(1.8)",
    WebkitBackdropFilter: "blur(28px) saturate(1.8)",
    boxShadow: [
      t.shadow,
      accent ? `0 0 40px ${accent}14` : "",
      `inset 0 1px 0 ${t.glassEdge}`,
      `inset 0 -1px 0 ${t.glassEdgeBot||"rgba(0,0,0,0.2)"}`,
    ].filter(Boolean).join(", "),
    position:   "relative",
    overflow:   "hidden",
    transition: "transform .25s cubic-bezier(.22,1,.36,1), box-shadow .22s",
  });

  return (
    <>
    <AppShell activePage="/dashboard">
      <style>{`
        @keyframes sa-ripple  { 0%{opacity:1;transform:scale(0.5)} 100%{opacity:0;transform:scale(2.8)} }
        @keyframes mover-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes mover-row-in  { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes float-card    { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-4px)} }
        @keyframes scan-line     { 0%{top:-2px} 100%{top:100%} }
        @keyframes number-count  { from{opacity:0;transform:translateY(10px) scale(0.85)} to{opacity:1;transform:translateY(0) scale(1)} }
        @keyframes badge-in      { from{transform:scale(0.7) rotate(-8deg);opacity:0} to{transform:scale(1) rotate(0);opacity:1} }
        @keyframes glow-pulse    { 0%,100%{opacity:0.5} 50%{opacity:1} }
        .dash-card-hover:hover   { transform:translateY(-4px) !important; }
        .dash-card-hover:hover .card-scan { animation:scan-line 2s linear infinite !important; opacity:.4 !important; }
      `}</style>

      {/* ══════════════════════════════════
          HEADER — greeting + market badges
      ══════════════════════════════════ */}
      <div className="slideUp" style={{ marginBottom:28, display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:16, flexWrap:"wrap" }}>
        <div>
          {/* greeting chip */}
          <div style={{ display:"inline-flex", alignItems:"center", gap:6, marginBottom:10,
            padding:"4px 12px 4px 8px", borderRadius:20,
            background: `linear-gradient(90deg, ${t.accentPrimary}20, ${t.accentSecond}12)`,
            border:`1px solid ${t.accentPrimary}28` }}>
            <span style={{ fontSize:13 }}>👋</span>
            <span style={{ fontSize:11, fontWeight:600, color:t.accentPrimary }}>
              Welcome back{user?.name ? ", "+user.name : ""}
            </span>
          </div>
          <h1 style={{
            margin:0, fontSize:"clamp(26px,4vw,36px)", fontWeight:800,
            letterSpacing:"-0.05em", fontFamily:"'Syne',sans-serif",
            color: t.titleColor,
            lineHeight:1,
            textShadow: t.isDark ? `0 0 40px ${t.glowPrimary}, 0 2px 6px rgba(0,0,0,0.6)` : "none",
          }}>
            Dashboard
          </h1>
          <p style={{ margin:"6px 0 0", fontSize:13, color:t.textSecondary }}>
            Your portfolio intelligence hub
          </p>
        </div>
        <MarketBadge t={t} isDark={isDark}/>
      </div>

      {/* ══════════════════════════════════
          STAT CARDS — 4 KPI tiles
      ══════════════════════════════════ */}
      <div className="slideUp1" style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:22 }}>
        {[
          { icon:<Brain size={18}/>,        label:"Total Analyses", value:totalAnalyses,               color:"#3b82f6", sub:"analyses done" },
          { icon:<TrendingUp size={18}/>,   label:"Buy Signals",    value:buySignals,                  color:"#10b981", sub:"bullish picks"  },
          { icon:<TrendingDown size={18}/>, label:"Sell Signals",   value:sellSignals,                 color:"#f87171", sub:"bearish alerts" },
          { icon:<Zap size={18}/>,          label:"Avg Confidence", value:avgConf ? avgConf+"%" : "0%",color:"#a78bfa", sub:"AI confidence"  },
        ].map((s,i) => <StatCard3D key={i} {...s} isDark={isDark} t={t} delay={i*0.07}/>)}
      </div>

      {/* ══════════════════════════════════
          SEARCH + POPULAR STOCKS
      ══════════════════════════════════ */}
      <div className="slideUp2 dash-card-hover" style={{ ...card(), padding:24, marginBottom:22 }}>
        {/* scan line effect */}
        <div className="card-scan" style={{ position:"absolute",left:0,right:0,height:1,
          background:`linear-gradient(90deg,transparent,${t.accentPrimary}50,transparent)`,
          top:"-2px", opacity:0, pointerEvents:"none", transition:"opacity .3s" }}/>

        {/* Section header */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:16 }}>
          <div style={{ width:28,height:28,borderRadius:8,
            background:`linear-gradient(135deg,${t.accentPrimary}30,${t.accentSecond}15)`,
            border:`1px solid ${t.accentPrimary}35`,
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:`0 4px 12px ${t.glowPrimary}` }}>
            <Search size={13} style={{ color:t.accentPrimary }}/>
          </div>
          <span style={{ fontSize:13, fontWeight:700, color:t.textPrimary, letterSpacing:"-0.01em" }}>Quick Analyze</span>
        </div>

        {/* Search input */}
        <div style={{ display:"flex", gap:10, marginBottom:20 }}>
          <div style={{ flex:1, position:"relative" }}>
            <input value={searchInput}
              onChange={e => setSearchInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key==="Enter" && handleSearch()}
              placeholder="AAPL, RELIANCE.NS, TSLA…"
              style={{
                width:"100%", boxSizing:"border-box",
                background: t.inputBg,
                border:`1px solid ${t.inputBorder}`,
                borderRadius:14, padding:"11px 16px 11px 42px",
                fontSize:13, color:t.textPrimary,
                outline:"none", transition:"all .22s",
              }}
              onFocus={e => {
                e.target.style.borderColor = t.inputFocus;
                e.target.style.boxShadow   = `0 0 0 3px ${t.accentPrimary}18`;
              }}
              onBlur={e  => {
                e.target.style.borderColor = t.inputBorder;
                e.target.style.boxShadow   = "none";
              }}
            />
            <Search size={14} style={{ position:"absolute",left:14,top:"50%",transform:"translateY(-50%)",
              color:t.textMuted, pointerEvents:"none" }}/>
          </div>
          <button onClick={handleSearch} style={{
            padding:"11px 22px", borderRadius:14, fontSize:13, fontWeight:700,
            background: t.gradientBtn || t.gradient,
            border:`1px solid ${t.accentPrimary}40`,
            color:"#fff", cursor:"pointer",
            display:"flex", alignItems:"center", gap:7,
            boxShadow:`0 6px 20px ${t.glowPrimary}, inset 0 1px 0 rgba(255,255,255,0.20)`,
            transition:"all .2s", whiteSpace:"nowrap", flexShrink:0,
          }}
            onMouseEnter={e => { e.currentTarget.style.transform="translateY(-2px)"; e.currentTarget.style.boxShadow=`0 10px 28px ${t.glowPrimary}`; }}
            onMouseLeave={e => { e.currentTarget.style.transform="translateY(0)";    e.currentTarget.style.boxShadow=`0 6px 20px ${t.glowPrimary}`; }}>
            <Zap size={13}/> Analyze
          </button>
        </div>

        {/* Popular stocks header */}
        <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:12 }}>
          <span style={{ fontSize:11, fontWeight:700, color:t.textSecondary, letterSpacing:"0.06em", textTransform:"uppercase" }}>
            Popular Stocks
          </span>
          <div style={{ flex:1, height:1, background:`linear-gradient(90deg,${t.border},transparent)` }}/>
          <RefreshCw size={10} style={{
            color:t.textMuted, opacity:allLoaded?0:0.7,
            animation:allLoaded?"none":"spin 1s linear infinite", transition:"opacity .6s"
          }}/>
        </div>

        {/* Stock grid */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:9 }}>
          {POPULAR.map(({ symbol, name, logo }) => {
            const d    = popularData[symbol];
            const isUp = d ? Number(d.changePercent) >= 0 : true;
            return (
              <button key={symbol} onClick={() => goAnalyze(symbol)}
                onMouseEnter={e => {
                  prefetch(`stock:${symbol}:1M`, () => api.get(`/stock/${symbol}?range=1M`), TTL.stock);
                  e.currentTarget.style.background    = `${t.accentPrimary}14`;
                  e.currentTarget.style.borderColor   = `${t.accentPrimary}45`;
                  e.currentTarget.style.transform     = "translateY(-3px) scale(1.02)";
                  e.currentTarget.style.boxShadow     = `0 8px 24px ${t.glowPrimary}, inset 0 1px 0 ${t.glassEdge}`;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background    = t.inputBg;
                  e.currentTarget.style.borderColor   = t.inputBorder;
                  e.currentTarget.style.transform     = "translateY(0) scale(1)";
                  e.currentTarget.style.boxShadow     = "none";
                }}
                style={{
                  background: t.inputBg, border:`1px solid ${t.inputBorder}`,
                  borderRadius:14, padding:"11px 13px", cursor:"pointer", textAlign:"left",
                  transition:"all .22s cubic-bezier(.22,1,.36,1)",
                  minHeight:60, position:"relative", overflow:"hidden",
                }}>
                {/* accent top line */}
                <div style={{ position:"absolute",top:0,left:0,right:0,height:2,
                  background:`linear-gradient(90deg,transparent,${isUp?"#10b981":"#f87171"}40,transparent)`,
                  pointerEvents:"none" }}/>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", gap:4 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:7, minWidth:0 }}>
                    <span style={{ fontSize:16, lineHeight:1, flexShrink:0 }}>{logo}</span>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontSize:12, fontWeight:800, color:t.textPrimary, margin:0,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap",
                        fontFamily:"'Syne',sans-serif" }}>{symbol}</p>
                      <p style={{ fontSize:9, color:t.textSecondary, marginTop:1,
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{name}</p>
                    </div>
                  </div>
                  <div style={{ textAlign:"right", flexShrink:0, minWidth:48,
                    opacity:d?1:0, transition:"opacity .5s ease" }}>
                    <p style={{ fontSize:11, fontWeight:700, color:t.textPrimary, margin:0 }}>
                      {d ? (d.currency==="INR"?"₹":"$")+d.price : "--"}
                    </p>
                    <p style={{ fontSize:10, fontWeight:700, margin:0,
                      display:"flex", alignItems:"center", justifyContent:"flex-end", gap:1,
                      color: isUp ? "#34d399" : "#f87171" }}>
                      {d && (isUp ? <ArrowUpRight size={9}/> : <ArrowDownRight size={9}/>)}
                      {d ? d.changePercent+"%" : ""}
                    </p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ══════════════════════════════════
          TOP MOVERS
      ══════════════════════════════════ */}
      <div className="slideUp3" style={{ marginBottom:22 }}>
        {/* Section heading */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          marginBottom:14, flexWrap:"wrap", gap:8 }}>
          <div style={{ display:"flex", alignItems:"center", gap:10 }}>
            <div style={{ width:34,height:34,borderRadius:11,
              background:"linear-gradient(135deg,rgba(234,179,8,0.25),rgba(251,146,60,0.15))",
              border:"1px solid rgba(234,179,8,0.30)",
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:"0 4px 16px rgba(234,179,8,0.22)" }}>
              <Zap size={16} style={{ color:"#fbbf24" }}/>
            </div>
            <div>
              <h2 style={{ margin:0, fontSize:16, fontWeight:800,
                fontFamily:"'Syne',sans-serif",
                color:"#FBBF24",
                textShadow:"0 0 24px rgba(251,191,36,0.50), 0 2px 4px rgba(0,0,0,0.4)" }}>
                Top Movers
              </h2>
              <span style={{ fontSize:10, color:t.textMuted }}>US + NSE India · Live</span>
            </div>
            {moversBgLoad && (
              <span style={{ width:6,height:6,borderRadius:"50%",background:"#60a5fa",
                animation:"glow-pulse 1s ease-in-out infinite", flexShrink:0,
                boxShadow:"0 0 8px #60a5fa" }}/>
            )}
          </div>
          <div style={{ display:"flex", gap:8 }}>
            <button onClick={handleMoversRefresh} disabled={moversLoad}
              style={{
                position:"relative", overflow:"hidden",
                padding:"7px 10px", borderRadius:10,
                background: refreshPulse ? `${t.accentPrimary}20` : t.inputBg,
                border:`1px solid ${refreshPulse ? t.accentPrimary+"50" : t.border}`,
                color: refreshPulse ? t.accentPrimary : t.textSecondary,
                cursor: moversLoad ? "not-allowed" : "pointer",
                opacity: moversLoad ? 0.6 : 1,
                transform: refreshPulse ? "scale(0.88)" : "scale(1)",
                boxShadow: refreshPulse ? `0 0 16px ${t.glowPrimary}` : "none",
                transition:"all .18s cubic-bezier(.34,1.56,.64,1)",
              }}
              onMouseEnter={e => { if (!moversLoad&&!refreshPulse) { e.currentTarget.style.background=`${t.accentPrimary}12`; e.currentTarget.style.borderColor=`${t.accentPrimary}35`; }}}
              onMouseLeave={e => { if (!refreshPulse) { e.currentTarget.style.background=t.inputBg; e.currentTarget.style.borderColor=t.border; }}}>
              <RefreshCw size={13} style={{
                display:"block", transition:"transform .4s",
                animation:moversLoad?"spin 0.7s linear infinite":"none",
                transform:refreshPulse&&!moversLoad?"rotate(-30deg)":"rotate(0)",
              }}/>
              {refreshPulse && <span style={{ position:"absolute",inset:0,borderRadius:10,
                background:"radial-gradient(circle,rgba(99,149,255,0.28) 0%,transparent 70%)",
                animation:"sa-ripple .5s ease-out forwards", pointerEvents:"none" }}/>}
            </button>
            <Link to="/movers" style={{
              fontSize:11, fontWeight:600, color:t.accentPrimary,
              display:"flex", alignItems:"center", gap:4,
              padding:"7px 14px", borderRadius:10,
              background:`${t.accentPrimary}12`, border:`1px solid ${t.accentPrimary}28`,
              transition:"all .18s",
            }}
              onMouseEnter={e => { e.currentTarget.style.background=`${t.accentPrimary}20`; e.currentTarget.style.boxShadow=`0 4px 14px ${t.glowPrimary}`; }}
              onMouseLeave={e => { e.currentTarget.style.background=`${t.accentPrimary}12`; e.currentTarget.style.boxShadow="none"; }}>
              View All <ArrowUpRight size={11}/>
            </Link>
          </div>
        </div>

        {moversError && (
          <div style={{ background:"rgba(248,113,113,0.10)", border:"1px solid rgba(248,113,113,0.22)",
            borderRadius:14, padding:"10px 16px", marginBottom:12,
            color:"#fca5a5", fontSize:12, display:"flex", justifyContent:"space-between" }}>
            <span>{moversError}</span>
            <button onClick={handleMoversRefresh} style={{ background:"none",border:"none",
              color:"#fca5a5",cursor:"pointer",textDecoration:"underline",fontSize:11 }}>Retry</button>
          </div>
        )}

        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
          <MoversPanel title="Top Gainers" type="gainer" stocks={gainers}
            loading={moversLoad} onClick={goAnalyze} isDark={isDark} t={t}/>
          <MoversPanel title="Top Losers"  type="loser"  stocks={losers}
            loading={moversLoad} onClick={goAnalyze} isDark={isDark} t={t}/>
        </div>
      </div>

      {/* ══════════════════════════════════
          MY FAVORITES
      ══════════════════════════════════ */}
      <div className="dash-card-hover" style={{
        ...card(), padding:24, marginBottom:22,
        animation:"slideUp .55s .24s cubic-bezier(.22,1,.36,1) both",
      }}>
        <div className="card-scan" style={{ position:"absolute",left:0,right:0,height:1,
          background:`linear-gradient(90deg,transparent,rgba(251,191,36,0.45),transparent)`,
          top:"-2px", opacity:0, pointerEvents:"none", transition:"opacity .3s" }}/>
        <FavoritesSection
          favorites={favorites}
          prices={favPrices}
          loading={favLoading}
          addFavorite={addFavorite}
          removeFavorite={removeFavorite}
          updateAlert={updateAlert}
          isDark={isDark}
          t={t}
          onAnalyze={goAnalyze}
          onRefresh={refreshPrices}
        />
      </div>

      {/* ══════════════════════════════════
          RECENT ANALYSES
      ══════════════════════════════════ */}
      <div className="dash-card-hover" style={{ ...card(), padding:24, animation:"slideUp .55s .28s cubic-bezier(.22,1,.36,1) both" }}>
        <div className="card-scan" style={{ position:"absolute",left:0,right:0,height:1,
          background:`linear-gradient(90deg,transparent,${t.accentSecond}50,transparent)`,
          top:"-2px", opacity:0, pointerEvents:"none", transition:"opacity .3s" }}/>

        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:18 }}>
          <div style={{ display:"flex", alignItems:"center", gap:9 }}>
            <div style={{ width:28,height:28,borderRadius:8,
              background:`linear-gradient(135deg,${t.accentSecond}28,${t.accentSecond}10)`,
              border:`1px solid ${t.accentSecond}35`,
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:`0 3px 10px ${t.glowAccent}` }}>
              <Clock size={13} style={{ color:t.accentSecond }}/>
            </div>
            <span style={{ fontSize:14, fontWeight:700, color:t.textPrimary, letterSpacing:"-0.01em" }}>Recent Analyses</span>
          </div>
          {history.length > 0 && (
            <Link to="/history" style={{
              fontSize:11, fontWeight:600, color:t.accentPrimary,
              padding:"5px 12px", borderRadius:8,
              background:`${t.accentPrimary}10`, border:`1px solid ${t.accentPrimary}22`,
            }}>View All</Link>
          )}
        </div>

        {historyLoad ? (
          <div style={{ display:"flex", justifyContent:"center", padding:"36px 0", color:t.textMuted, gap:9 }}>
            <RefreshCw size={14} className="sa-spin"/> Loading…
          </div>
        ) : history.length === 0 ? (
          <div style={{ textAlign:"center", padding:"36px 0" }}>
            <div style={{ width:52,height:52,borderRadius:16,
              background:`${t.accentPrimary}14`, border:`1px solid ${t.accentPrimary}22`,
              display:"flex",alignItems:"center",justifyContent:"center",
              margin:"0 auto 14px", boxShadow:`0 8px 24px ${t.glowPrimary}` }}>
              <Activity size={22} style={{ color:t.accentPrimary }}/>
            </div>
            <p style={{ fontSize:13, color:t.textSecondary, margin:0, fontWeight:500 }}>
              No analyses yet — try the Analyze page
            </p>
          </div>
        ) : (
          <div style={{ display:"flex", flexDirection:"column", gap:8 }}>
            {history.slice(0,5).map((item,i) => {
              const sigColor = item.signal==="BUY" ? "#10b981" : item.signal==="SELL" ? "#f87171" : "#fbbf24";
              return (
                <button key={item._id||i} onClick={() => goAnalyze(item.symbol)}
                  onMouseEnter={e => {
                    prefetch(`stock:${item.symbol}:1M`, () => api.get(`/stock/${item.symbol}?range=1M`), TTL.stock);
                    e.currentTarget.style.background  = `${t.accentPrimary}10`;
                    e.currentTarget.style.borderColor = `${t.accentPrimary}30`;
                    e.currentTarget.style.transform   = "translateX(4px)";
                    e.currentTarget.style.boxShadow   = `0 4px 16px ${t.glowPrimary}`;
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.background  = t.inputBg;
                    e.currentTarget.style.borderColor = t.border;
                    e.currentTarget.style.transform   = "translateX(0)";
                    e.currentTarget.style.boxShadow   = "none";
                  }}
                  style={{
                    background:t.inputBg, border:`1px solid ${t.border}`,
                    borderRadius:14, padding:"12px 15px", cursor:"pointer", textAlign:"left",
                    width:"100%", transition:"all .2s cubic-bezier(.22,1,.36,1)",
                    animation:`mover-row-in .35s cubic-bezier(.22,1,.36,1) ${i*.06}s both`,
                    position:"relative", overflow:"hidden",
                  }}>
                  {/* left accent bar */}
                  <div style={{ position:"absolute",left:0,top:0,bottom:0,width:3,
                    background:`linear-gradient(180deg,${sigColor}80,transparent)`,
                    borderRadius:"14px 0 0 14px" }}/>
                  <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",gap:10 }}>
                    <div style={{ display:"flex",alignItems:"center",gap:10,minWidth:0 }}>
                      <div style={{ width:34,height:34,borderRadius:10,flexShrink:0,
                        background:`linear-gradient(135deg,${sigColor}22,${sigColor}08)`,
                        border:`1px solid ${sigColor}30`,
                        display:"flex",alignItems:"center",justifyContent:"center",
                        fontSize:10, fontWeight:800, color:sigColor,
                        boxShadow:`0 3px 10px ${sigColor}20` }}>
                        {item.symbol?.replace(".NS","").slice(0,2)}
                      </div>
                      <div style={{ minWidth:0 }}>
                        <p style={{ fontSize:13,fontWeight:700,color:t.textPrimary,margin:0,
                          overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap",
                          fontFamily:"'Syne',sans-serif" }}>{item.symbol}</p>
                        <p style={{ fontSize:10,color:t.textSecondary,marginTop:2 }}>{item.date}</p>
                      </div>
                    </div>
                    <div style={{ display:"flex",alignItems:"center",gap:8,flexShrink:0 }}>
                      {item.price && (
                        <p style={{ fontSize:12,fontWeight:700,color:t.textPrimary,margin:0 }}>
                          {item.symbol?.endsWith(".NS")?"₹":"$"}{item.price}
                        </p>
                      )}
                      <SignalBadge signal={item.signal}/>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </AppShell>

    {/* ── Alert toast notifications (fixed, outside AppShell flow) ── */}
    <NotificationStack toasts={toasts} onDismiss={dismiss} theme={tokens(theme)}/>
  </>
  );
};

/* ══════════════════════════════════════════════════
   STAT CARD 3D
══════════════════════════════════════════════════ */
const StatCard3D = ({ icon, label, value, color, sub, isDark, t, delay }) => {
  const tilt = useTilt(12);
  return (
    <div {...tilt} className="dash-card-hover" style={{
      borderRadius:20, padding:"20px 18px",
      background: t.cardGradient,
      border:`1px solid ${color}30`,
      backdropFilter:"blur(28px) saturate(1.8)",
      WebkitBackdropFilter:"blur(28px) saturate(1.8)",
      boxShadow:`${t.shadow}, 0 0 36px ${color}12, inset 0 1px 0 ${t.glassEdge}`,
      animation:`slideUp .55s ${delay}s cubic-bezier(.22,1,.36,1) both`,
      transition:"box-shadow .22s, border-color .22s",
      position:"relative", overflow:"hidden", cursor:"default",
    }}>
      {/* radial glow behind icon */}
      <div style={{ position:"absolute",top:-30,right:-20,width:110,height:110,
        borderRadius:"50%", background:`radial-gradient(circle,${color}22,transparent 68%)`,
        pointerEvents:"none", animation:"glow-pulse 3s ease-in-out infinite" }}/>
      {/* top edge specular */}
      <div style={{ position:"absolute",top:0,left:0,right:0,height:1,
        background:`linear-gradient(90deg,transparent 0%,${t.glassEdge} 25%,${color}60 50%,${t.glassEdge} 75%,transparent 100%)`,
        pointerEvents:"none" }}/>

      {/* 3D icon box */}
      <div style={{
        width:44, height:44, borderRadius:14, marginBottom:16,
        background:`linear-gradient(145deg,${color}32,${color}10)`,
        border:`1px solid ${color}45`,
        display:"flex", alignItems:"center", justifyContent:"center", color,
        boxShadow:`0 8px 22px ${color}30, inset 0 1px 0 rgba(255,255,255,0.22), inset 0 -1px 0 rgba(0,0,0,0.25)`,
        transform:"perspective(140px) rotateX(12deg) rotateY(-6deg)",
        transition:"transform .25s",
      }}>{icon}</div>

      {/* value */}
      <p style={{
        fontSize:34, fontWeight:800, margin:0, lineHeight:1,
        color: t.textPrimary,
        fontFamily:"'Syne',sans-serif", letterSpacing:"-0.05em",
        textShadow: isDark ? `0 2px 10px rgba(0,0,0,0.5)` : "none",
        animation:`number-count .6s ${delay+.1}s cubic-bezier(.22,1,.36,1) both`,
      }}>{value}</p>

      {/* labels */}
      <p style={{ fontSize:12, color:t.textSecondary, margin:"7px 0 0", fontWeight:600 }}>{label}</p>
      <p style={{ fontSize:10, color:t.textMuted, margin:"2px 0 0" }}>{sub}</p>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   MOVERS PANEL
══════════════════════════════════════════════════ */
const MoversPanel = ({ title, type, stocks, loading, onClick, isDark, t }) => {
  const isG = type === "gainer";
  const acc  = isG ? "#10b981" : "#f87171";
  const prevStocksRef = React.useRef(stocks);
  if (stocks.length > 0) prevStocksRef.current = stocks;
  const displayStocks = stocks.length > 0 ? stocks : prevStocksRef.current;

  return (
    <div style={{
      borderRadius:20, overflow:"hidden",
      background: t.cardGradient,
      border:`1px solid ${acc}25`,
      backdropFilter:"blur(26px) saturate(1.6)",
      WebkitBackdropFilter:"blur(26px) saturate(1.6)",
      boxShadow:`${t.shadow}, 0 0 30px ${acc}10, inset 0 1px 0 ${t.glassEdge}`,
      transition:"background .35s",
    }}>
      {/* Panel header */}
      <div style={{ display:"flex", alignItems:"center", gap:9, padding:"13px 16px",
        borderBottom:`1px solid ${acc}14`,
        background:`linear-gradient(90deg,${acc}0e,${acc}04,transparent)` }}>
        <div style={{ width:28,height:28,borderRadius:8,
          background:`linear-gradient(135deg,${acc}25,${acc}10)`,
          border:`1px solid ${acc}35`,
          display:"flex",alignItems:"center",justifyContent:"center",
          boxShadow:`0 3px 10px ${acc}25` }}>
          {isG
            ? <TrendingUp  size={13} style={{ color:acc }}/>
            : <TrendingDown size={13} style={{ color:acc }}/>}
        </div>
        <span style={{ fontSize:13, fontWeight:700, color:acc,
          textShadow:`0 0 16px ${acc}80`, fontFamily:"'Syne',sans-serif" }}>{title}</span>
        {displayStocks.length > 0 && (
          <span style={{ marginLeft:"auto", fontSize:9, padding:"2px 8px", borderRadius:20,
            background:`${acc}12`, color:acc, border:`1px solid ${acc}22`, fontWeight:700 }}>
            {displayStocks.filter(s=>s.market==="IN").length} IN · {displayStocks.filter(s=>s.market==="US").length} US
          </span>
        )}
      </div>

      {/* Rows */}
      <div style={{ padding:"4px 3px", position:"relative" }}>
        {loading && displayStocks.length === 0 &&
          Array.from({length:5}).map((_,i) => <SkelRow key={i} t={t} acc={acc} i={i}/>)}
        {!loading && displayStocks.length === 0 && (
          <p style={{ textAlign:"center", padding:"24px 0", fontSize:12, color:t.textMuted }}>No data</p>
        )}
        {displayStocks.length > 0 && displayStocks.map((s,i) => (
          <MoverRow key={s.symbol} stock={s} rank={i+1} isGainer={isG}
            acc={acc} onClick={() => onClick(s.symbol)} t={t}
            animate={!loading} index={i}/>
        ))}
        {/* shimmer overlay while bg refreshing */}
        {loading && displayStocks.length > 0 && (
          <div style={{ position:"absolute",inset:0,borderRadius:12,overflow:"hidden",pointerEvents:"none" }}>
            {displayStocks.map((_,i) => (
              <div key={i} style={{ height:44, margin:"1px 3px", borderRadius:9,
                background: isDark
                  ? "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.07) 50%,transparent 100%)"
                  : "linear-gradient(90deg,transparent 0%,rgba(255,255,255,0.55) 50%,transparent 100%)",
                backgroundSize:"200% 100%",
                animation:`mover-shimmer 1.4s ease-in-out ${i*.07}s infinite` }}/>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   MOVER ROW
══════════════════════════════════════════════════ */
const MoverRow = ({ stock, rank, isGainer, acc, onClick, t, animate, index }) => {
  const [h, setH] = useState(false);
  const isIN = stock.market === "IN";
  return (
    <div onClick={onClick}
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display:"flex", alignItems:"center", gap:9, padding:"8px 13px",
        borderRadius:10, margin:"1px 3px", cursor:"pointer",
        background: h ? `${acc}10` : "transparent",
        border:     h ? `1px solid ${acc}22` : "1px solid transparent",
        animation:  animate ? `mover-row-in .32s cubic-bezier(.22,1,.36,1) ${index*.045}s both` : "none",
        transition: "background .15s, border-color .15s, transform .15s",
        transform:  h ? "translateX(3px)" : undefined,
        boxShadow:  h ? `0 2px 12px ${acc}14` : "none",
      }}>
      <span style={{ width:16, textAlign:"center", fontSize:10, color:t.textMuted, flexShrink:0,
        fontWeight:700 }}>{rank}</span>
      <div style={{ width:30, height:30, borderRadius:8,
        background:`linear-gradient(135deg,${acc}22,${acc}08)`,
        border:`1px solid ${acc}28`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:8, fontWeight:800, color:acc, flexShrink:0,
        boxShadow: h ? `0 3px 10px ${acc}25` : "none",
        transition:"box-shadow .15s" }}>
        {stock.symbol.replace(".NS","").slice(0,4)}
      </div>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ display:"flex", alignItems:"center", gap:5 }}>
          <span style={{ fontSize:11,fontWeight:700,color:t.textPrimary,
            overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap" }}>{stock.symbol}</span>
          <span style={{ fontSize:8,padding:"1px 5px",borderRadius:4,flexShrink:0,fontWeight:700,
            background: isIN?"rgba(251,146,60,0.14)":"rgba(96,165,250,0.14)",
            color:       isIN?"#fb923c":"#60a5fa",
            border:`1px solid ${isIN?"rgba(251,146,60,0.22)":"rgba(96,165,250,0.22)"}` }}>
            {isIN?"NSE":"US"}
          </span>
        </div>
      </div>
      <div style={{ textAlign:"right", flexShrink:0 }}>
        <p style={{ fontSize:11,fontWeight:700,color:t.textPrimary,margin:0 }}>
          {fmtPrice(stock.price,stock.currency)}
        </p>
        <p style={{ fontSize:10,fontWeight:700,color:acc,margin:0,
          display:"flex",alignItems:"center",justifyContent:"flex-end",gap:1 }}>
          {isGainer?<ArrowUpRight size={9}/>:<ArrowDownRight size={9}/>}
          {isGainer&&stock.changePercent>0?"+":""}{stock.changePercent}%
        </p>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   SKELETON ROW
══════════════════════════════════════════════════ */
const SkelRow = ({ t, acc, i }) => (
  <div style={{ display:"flex",gap:9,padding:"9px 13px",alignItems:"center",
    animation:`mover-row-in .3s ease ${i*.06}s both` }}>
    <div style={{ width:16,height:8,borderRadius:3,flexShrink:0,
      background:acc?`${acc}14`:t.inputBg, backgroundSize:"200% 100%",
      animation:"mover-shimmer 1.4s ease-in-out infinite" }}/>
    <div style={{ width:30,height:30,borderRadius:8,flexShrink:0,
      background:acc?`${acc}10`:t.inputBg, backgroundSize:"200% 100%",
      animation:`mover-shimmer 1.4s ease-in-out ${i*.07}s infinite` }}/>
    <div style={{ flex:1 }}>
      <div style={{ width:"42%",height:8,borderRadius:3,marginBottom:5,
        background:t.inputBg, backgroundSize:"200% 100%",
        animation:`mover-shimmer 1.4s ease-in-out ${i*.07+.1}s infinite` }}/>
      <div style={{ width:"26%",height:6,borderRadius:3,
        background:t.inputBg, backgroundSize:"200% 100%",
        animation:`mover-shimmer 1.4s ease-in-out ${i*.07+.2}s infinite` }}/>
    </div>
    <div>
      <div style={{ width:44,height:8,borderRadius:3,marginBottom:5,marginLeft:"auto",
        background:t.inputBg, backgroundSize:"200% 100%",
        animation:`mover-shimmer 1.4s ease-in-out ${i*.07+.15}s infinite` }}/>
      <div style={{ width:32,height:6,borderRadius:3,marginLeft:"auto",
        background:acc?`${acc}14`:t.inputBg, backgroundSize:"200% 100%",
        animation:`mover-shimmer 1.4s ease-in-out ${i*.07+.25}s infinite` }}/>
    </div>
  </div>
);

/* ══════════════════════════════════════════════════
   MARKET BADGE
══════════════════════════════════════════════════ */
const MarketBadge = ({ t, isDark }) => {
  const now=new Date(), ud=now.getUTCDay(), um=now.getUTCHours()*60+now.getUTCMinutes();
  return (
    <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
      {[
        { flag:"🇺🇸", label:"US",  open:ud>=1&&ud<=5&&um>=810&&um<1200, color:"#3b82f6" },
        { flag:"🇮🇳", label:"NSE", open:ud>=1&&ud<=5&&um>=225&&um<600,  color:"#10b981" },
      ].map(m => (
        <div key={m.label} style={{
          display:"flex", alignItems:"center", gap:6,
          padding:"6px 12px", borderRadius:22, fontSize:11, fontWeight:600,
          background: m.open ? `${m.color}14` : t.inputBg,
          border:`1px solid ${m.open?m.color+"30":t.border}`,
          color: m.open ? m.color : t.textMuted,
          boxShadow: m.open ? `0 4px 14px ${m.color}18` : "none",
          transition:"all .35s",
          animation: m.open ? `badge-in .5s cubic-bezier(.22,1,.36,1) both` : "none",
        }}>
          <span style={{ width:6,height:6,borderRadius:"50%",
            background: m.open?m.color:t.textMuted,
            boxShadow: m.open?`0 0 8px ${m.color}, 0 0 16px ${m.color}60`:"none",
            animation: m.open?"sa-pulse 2s infinite":"none" }}/>
          {m.flag} {m.label} {m.open?"Open":"Closed"}
        </div>
      ))}
    </div>
  );
};

/* ══════════════════════════════════════════════════
   SIGNAL BADGE
══════════════════════════════════════════════════ */
const SignalBadge = ({ signal }) => !signal ? null : (
  <span style={{
    fontSize:10, padding:"4px 9px", borderRadius:20, fontWeight:800,
    fontFamily:"'Syne',sans-serif", letterSpacing:"0.04em",
    background: signal==="BUY"  ? "rgba(16,185,129,0.15)"
              : signal==="SELL" ? "rgba(248,113,113,0.15)"
              :                   "rgba(234,179,8,0.15)",
    color:      signal==="BUY"  ? "#34d399"
              : signal==="SELL" ? "#f87171"
              :                   "#fbbf24",
    border:`1px solid ${signal==="BUY"?"rgba(16,185,129,0.28)":signal==="SELL"?"rgba(248,113,113,0.28)":"rgba(234,179,8,0.28)"}`,
    boxShadow: signal==="BUY"  ? "0 2px 8px rgba(16,185,129,0.20)"
             : signal==="SELL" ? "0 2px 8px rgba(248,113,113,0.20)"
             :                   "0 2px 8px rgba(234,179,8,0.20)",
  }}>{signal}</span>
);

export default Dashboard;