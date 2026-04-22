import React, { useState, useEffect } from "react";
import { Clock, Trash2, TrendingUp, TrendingDown, Minus, ArrowUpDown, RefreshCw } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import AppShell from "./AppShell.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { tokens }   from "../context/theme.js";
import { api }      from "../utils/api.js";
import useAuthGuard from "../hooks/useAuthGuard.js";

const History = () => {
  useAuthGuard();
  const { isDark, theme } = useTheme();
  const t          = tokens(theme);
  const navigate   = useNavigate();

  const [history,     setHistory]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [filter,      setFilter]      = useState("ALL");
  const [sortBy,      setSortBy]      = useState("date");
  const [sortDir,     setSortDir]     = useState("desc");
  const [showConfirm, setShowConfirm] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      const data = await api.get("/analysis");
      if (!data) return;
      setHistory(Array.isArray(data) ? data : []);
    } catch(err) { console.error(err); }
    finally { setLoading(false); }
  };
  useEffect(() => { fetchHistory(); }, []);

  const deleteEntry = async (id) => {
    try { await api.delete("/analysis/"+id); setHistory(p=>p.filter(h=>h._id!==id)); }
    catch(err) { console.error(err); }
  };
  const clearAll = async () => {
    try { await api.delete("/analysis/all"); setHistory([]); setShowConfirm(false); }
    catch(err) { console.error(err); }
  };

  const filtered = history
    .filter(h => filter==="ALL"||h.signal===filter)
    .sort((a,b) => {
      let va, vb;
      if (sortBy==="symbol")          { va=a.symbol;        vb=b.symbol; }
      else if (sortBy==="confidence") { va=a.confidence||0; vb=b.confidence||0; }
      else                            { va=new Date(a.updatedAt); vb=new Date(b.updatedAt); }
      if (va<vb) return sortDir==="asc"?-1:1;
      if (va>vb) return sortDir==="asc"?1:-1;
      return 0;
    });

  const toggleSort = f => {
    if(sortBy===f) setSortDir(d=>d==="asc"?"desc":"asc");
    else { setSortBy(f); setSortDir("desc"); }
  };
  const buyCount  = history.filter(h=>h.signal==="BUY").length;
  const sellCount = history.filter(h=>h.signal==="SELL").length;
  const avgConf   = history.length ? Math.round(history.reduce((s,h)=>s+(h.confidence||0),0)/history.length) : 0;
  const isIndian  = s => s?.endsWith(".NS")||s?.endsWith(".BO");

  const cfg = tokens(theme);
  const card = {
    background:   t.cardGradient,
    border:      `1px solid ${t.border}`,
    borderRadius: 18,
    backdropFilter:"blur(22px)", WebkitBackdropFilter:"blur(22px)",
    boxShadow:    t.shadow, padding:20,
    transition:   "background 0.35s, border-color 0.35s",
  };

  return (
    <AppShell activePage="/history">
      {/* HEADER */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
        marginBottom:26, animation:"sa-slideUp 0.5s ease both" }}>
        <div>
          <h1 style={{ margin:0, fontSize:24, fontWeight:800, letterSpacing:"-0.04em",
            fontFamily:"'Syne', sans-serif",
            color: t.titleColor || t.textPrimary,
            textShadow: t.isDark ? `0 0 24px ${t.glowPrimary}` : "none" }}>
            Analysis History
          </h1>
          <p style={{ margin:"4px 0 0", fontSize:13, color:t.textMuted }}>Review your past stock analyses</p>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <button onClick={fetchHistory} style={{ padding:"8px 10px", borderRadius:10,
            background:t.cardBg, border:`1px solid ${t.border}`, color:t.textSecondary, cursor:"pointer",
            transition:"all 0.2s", boxShadow: t.shadow }}>
            <RefreshCw size={15} style={loading ? { animation:"sa-spin 1s linear infinite" } : {}}/>
          </button>
          {history.length > 0 && (
            <button onClick={() => setShowConfirm(true)} style={{
              display:"flex", alignItems:"center", gap:6, padding:"8px 14px", borderRadius:10,
              fontSize:12, fontWeight:600, background:"rgba(248,113,113,0.10)",
              border:"1px solid rgba(248,113,113,0.22)", color:"#fca5a5", cursor:"pointer", transition:"all 0.2s" }}>
              <Trash2 size={13}/> Clear All
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div style={{ display:"flex", justifyContent:"center", padding:"80px 0", color:t.textMuted }}>
          <RefreshCw size={22} style={{ animation:"sa-spin 1s linear infinite", marginRight:10 }}/> Loading history...
        </div>
      )}

      {!loading && history.length === 0 && (
        <div style={{ ...card, display:"flex", flexDirection:"column", alignItems:"center",
          justifyContent:"center", minHeight:380, textAlign:"center" }}>
          <div style={{ width:64, height:64, borderRadius:"50%", marginBottom:16,
            background:`${t.accentPrimary}14`, border:`1px solid ${t.accentPrimary}25`,
            display:"flex", alignItems:"center", justifyContent:"center",
            boxShadow:`0 0 30px ${t.glowPrimary}` }}>
            <Clock size={28} style={{ color:t.accentPrimary }}/>
          </div>
          <h2 style={{ margin:"0 0 6px", fontSize:17, fontWeight:700, fontFamily:"'Syne', sans-serif", color:t.textPrimary }}>
            No History Yet
          </h2>
          <p style={{ margin:"0 0 20px", fontSize:13, color:t.textMuted }}>Run AI Analysis on any stock to save it here</p>
          <Link to="/analyze" style={{ padding:"10px 24px", borderRadius:12, fontWeight:600, fontSize:13,
            background: t.gradient, color:"#fff",
            boxShadow:`0 4px 16px ${t.glowPrimary}` }}>
            Analyze a Stock
          </Link>
        </div>
      )}

      {!loading && history.length > 0 && (
        <>
          {/* STAT CARDS */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:12,
            marginBottom:18, animation:"sa-slideUp 0.5s 0.08s ease both" }}>
            {[
              { label:"Total",   value:history.length, color: t.accentPrimary || "#3b82f6" },
              { label:"Buy",     value:buyCount,        color:"#10b981" },
              { label:"Sell",    value:sellCount,       color:"#f87171" },
              { label:"Avg Conf",value:`${avgConf}%`,   color: t.accentSecond || "#a78bfa" },
            ].map((s, i) => (
              <div key={i} style={{ ...card, textAlign:"center", padding:16,
                boxShadow:`${t.shadow}, 0 0 20px ${s.color}10`, border:`1px solid ${s.color}20` }}>
                <p style={{ fontSize:24, fontWeight:800, margin:0, color:s.color,
                  fontFamily:"'Syne', sans-serif", lineHeight:1 }}>{s.value}</p>
                <p style={{ fontSize:11, color:t.textSecondary, marginTop:5, fontWeight:600 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* FILTERS */}
          <div style={{ display:"flex", flexWrap:"wrap", alignItems:"center", gap:10,
            marginBottom:14, animation:"sa-slideUp 0.5s 0.12s ease both" }}>
            <div style={{ display:"flex", gap:3, background:t.inputBg,
              border:`1px solid ${t.border}`, borderRadius:11, padding:4 }}>
              {["ALL","BUY","SELL","HOLD"].map(f => {
                const active = filter === f;
                const fc = f==="BUY"?"#10b981":f==="SELL"?"#f87171":f==="HOLD"?"#fbbf24": t.accentPrimary || "#60a5fa";
                return (
                  <button key={f} onClick={() => setFilter(f)} style={{
                    padding:"5px 12px", borderRadius:8, fontSize:12, fontWeight:600,
                    cursor:"pointer",
                    border: active ? `1px solid ${fc}30` : "1px solid transparent",
                    background: active ? `${fc}16` : "transparent",
                    color: active ? fc : t.textSecondary, transition:"all 0.2s" }}>
                    {f}
                  </button>
                );
              })}
            </div>
            <div style={{ display:"flex", alignItems:"center", gap:6, marginLeft:"auto",
              fontSize:11, color:t.textMuted }}>
              <ArrowUpDown size={12}/>
              {["date","symbol","confidence"].map(f => (
                <button key={f} onClick={() => toggleSort(f)} style={{
                  padding:"5px 10px", borderRadius:8, fontSize:11, cursor:"pointer",
                  border:`1px solid ${sortBy===f ? `${t.accentPrimary}50` : t.border}`,
                  background: sortBy===f ? `${t.accentPrimary}12` : t.inputBg,
                  color: sortBy===f ? t.accentPrimary : t.textSecondary,
                  textTransform:"capitalize", transition:"all 0.2s" }}>
                  {f} {sortBy===f ? (sortDir==="asc"?"↑":"↓") : ""}
                </button>
              ))}
            </div>
          </div>

          {/* LIST */}
          {filtered.length === 0
            ? <div style={{ textAlign:"center", padding:"60px 0", color:t.textMuted, fontSize:13 }}>
                No {filter} signals in history
              </div>
            : <div style={{ display:"flex", flexDirection:"column", gap:8,
                animation:"sa-slideUp 0.5s 0.16s ease both" }}>
                {filtered.map(item => (
                  <div key={item._id}
                    style={{ ...card, padding:"14px 18px", cursor:"default" }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderColor = t.borderHover;
                      e.currentTarget.style.boxShadow  = t.shadowHover;
                      e.currentTarget.style.transform  = "translateY(-1px)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderColor = t.border;
                      e.currentTarget.style.boxShadow   = t.shadow;
                      e.currentTarget.style.transform   = "translateY(0)";
                    }}
                  >
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        <div style={{ width:38, height:38, borderRadius:10, flexShrink:0,
                          background: t.gradient, border:`1px solid rgba(255,255,255,0.15)`,
                          boxShadow:`0 3px 12px ${t.glowPrimary}`,
                          display:"flex", alignItems:"center", justifyContent:"center",
                          fontSize:11, fontWeight:700, color:"#fff" }}>
                          {item.symbol?.slice(0,2)}
                        </div>
                        <div>
                          <button onClick={() => navigate("/analyze?symbol="+item.symbol)}
                            style={{ fontSize:13, fontWeight:700, color:t.textPrimary,
                              background:"none", border:"none", cursor:"pointer", padding:0, transition:"color 0.2s",
                              fontFamily:"'Syne', sans-serif" }}
                            onMouseEnter={e => e.currentTarget.style.color = t.accentPrimary}
                            onMouseLeave={e => e.currentTarget.style.color = t.textPrimary}
                          >{item.symbol}</button>
                          <p style={{ fontSize:10, color:t.textSecondary, marginTop:2 }}>{item.date}</p>
                        </div>
                      </div>
                      <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                        {item.price && (
                          <div style={{ textAlign:"right" }}>
                            <p style={{ fontSize:13, fontWeight:600, color:t.textPrimary, margin:0 }}>
                              {isIndian(item.symbol) ? "₹" : "$"}{item.price}
                            </p>
                            <p style={{ fontSize:9, color:t.textMuted, marginTop:1 }}>price</p>
                          </div>
                        )}
                        <SignalBadge signal={item.signal}/>
                        {item.confidence && (
                          <div style={{ textAlign:"right" }}>
                            <p style={{ fontSize:13, fontWeight:600, color:t.textPrimary, margin:0 }}>{item.confidence}%</p>
                            <p style={{ fontSize:9, color:t.textMuted, marginTop:1 }}>confidence</p>
                          </div>
                        )}
                        <button onClick={() => deleteEntry(item._id)}
                          style={{ padding:"6px", borderRadius:8, background:"transparent",
                            border:"1px solid transparent", cursor:"pointer", color:"#f87171",
                            opacity:0, transition:"all 0.2s" }}
                          onMouseEnter={e => {
                            e.currentTarget.style.opacity="1";
                            e.currentTarget.style.background="rgba(248,113,113,0.12)";
                            e.currentTarget.style.borderColor="rgba(248,113,113,0.2)";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.opacity="0";
                            e.currentTarget.style.background="transparent";
                            e.currentTarget.style.borderColor="transparent";
                          }}
                          onFocus={e => e.currentTarget.style.opacity="1"}
                        >
                          <Trash2 size={13}/>
                        </button>
                      </div>
                    </div>
                    {item.summary && (
                      <p style={{ fontSize:11, color:t.textSecondary, margin:"8px 0 0 50px",
                        overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.summary}</p>
                    )}
                    {item.confidence && (
                      <div style={{ margin:"8px 0 0 50px" }}>
                        <div style={{ height:3, background:t.inputBg, borderRadius:4, overflow:"hidden" }}>
                          <div style={{ height:"100%", borderRadius:4, width:`${item.confidence}%`,
                            background: item.signal==="BUY" ? "#10b981" : item.signal==="SELL" ? "#f87171" : "#fbbf24",
                            transition:"width 0.5s ease" }}/>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
          }
        </>
      )}

      {/* CONFIRM MODAL */}
      {showConfirm && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)",
          backdropFilter:"blur(8px)", WebkitBackdropFilter:"blur(8px)",
          display:"flex", alignItems:"center", justifyContent:"center", zIndex:100 }}>
          <div style={{ background:t.modalBg, border:`1px solid ${t.border}`,
            borderRadius:20, padding:28, maxWidth:360, width:"100%", margin:"0 16px",
            boxShadow:`0 24px 60px rgba(0,0,0,0.5), 0 0 0 1px ${t.border}` }}>
            <h3 style={{ margin:"0 0 8px", fontSize:17, fontWeight:700,
              fontFamily:"'Syne', sans-serif", color:t.textPrimary }}>Clear All History?</h3>
            <p style={{ margin:"0 0 22px", fontSize:13, color:t.textMuted }}>
              This will permanently delete all {history.length} analyses.
            </p>
            <div style={{ display:"flex", gap:10 }}>
              <button onClick={() => setShowConfirm(false)} style={{
                flex:1, padding:"10px", borderRadius:11,
                border:`1px solid ${t.border}`, background:t.inputBg,
                color:t.textSecondary, cursor:"pointer", fontSize:13, fontWeight:600, transition:"all 0.2s" }}>
                Cancel
              </button>
              <button onClick={clearAll} style={{
                flex:1, padding:"10px", borderRadius:11, border:"none",
                background:"linear-gradient(135deg,#ef4444,#dc2626)", color:"#fff",
                cursor:"pointer", fontSize:13, fontWeight:600,
                boxShadow:"0 4px 14px rgba(239,68,68,0.3)", transition:"all 0.2s" }}>
                Delete All
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
};

const SignalBadge = ({ signal }) => !signal ? null : (
  <span style={{ fontSize:10, padding:"3px 9px", borderRadius:20, fontWeight:700,
    display:"flex", alignItems:"center", gap:4,
    background: signal==="BUY" ? "rgba(16,185,129,0.14)" : signal==="SELL" ? "rgba(248,113,113,0.14)" : "rgba(234,179,8,0.14)",
    color:      signal==="BUY" ? "#34d399"               : signal==="SELL" ? "#f87171"                 : "#fbbf24",
    border:    `1px solid ${signal==="BUY" ? "rgba(16,185,129,0.22)" : signal==="SELL" ? "rgba(248,113,113,0.22)" : "rgba(234,179,8,0.22)"}` }}>
    {signal==="BUY" ? <TrendingUp size={10}/> : signal==="SELL" ? <TrendingDown size={10}/> : <Minus size={10}/>}
    {signal}
  </span>
);

export default History;