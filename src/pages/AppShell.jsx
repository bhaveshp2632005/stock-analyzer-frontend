import React, { useState, useEffect, useRef, useCallback } from "react";
import { Link, useLocation } from "react-router-dom";
import {
  BarChart3, LayoutDashboard, Search, GitCompare,
  History, LogOut, Zap, Menu, X, ChevronRight, GripVertical, Star, Newspaper, Brain,
} from "lucide-react";
import { useTheme }             from "../context/ThemeContext.jsx";
import { tokens, getThemeConfig } from "../context/theme.js";
import { getUser, logout }      from "../utils/auth.js";

const SB_MIN = 200, SB_MAX = 360, SB_DEFAULT = 248, SB_KEY = "sa_sidebar_width", MOBILE_BP = 768;

const NAV = [
  { icon: LayoutDashboard, label: "Dashboard",  to: "/dashboard" },
  { icon: Search,          label: "Analyze",    to: "/analyze"   },
  { icon: GitCompare,      label: "Compare",    to: "/compare"   },
  { icon: History,         label: "History",    to: "/history"   },
  { icon: Zap,             label: "Top Movers", to: "/movers"    },
  { icon: Star,            label: "Favorites",  to: "/favorites" },
  { icon: Newspaper,       label: "News",       to: "/news"      },
  { icon: Brain,           label: "AI Trading", to: "/ai"        },
];

/* ────────────────────────────────────────────────
   GLOBAL STYLES
──────────────────────────────────────────────── */
export const GlobalStyles = () => {
  const { theme } = useTheme();
  const t = tokens(theme);
  return (
    <style id="sa-global-styles">{`
      @import url('https://fonts.googleapis.com/css2?family=Syne:wght@600;700;800&family=Inter:wght@400;500;600;700&display=swap');

      *, *::before, *::after { box-sizing: border-box; }
      html { font-size: 16px; }
      body {
        margin: 0;
        font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
        -webkit-font-smoothing: antialiased;
        color: ${t.textPrimary};
      }
      body.sb-dragging { cursor: col-resize !important; user-select: none; }
      body.sb-dragging * { pointer-events: none; }
      a { text-decoration: none; }
      input, button, textarea { font-family: inherit; }

      ::-webkit-scrollbar { width: 5px; height: 5px; }
      ::-webkit-scrollbar-track { background: transparent; }
      ::-webkit-scrollbar-thumb { background: ${t.border}; border-radius: 8px; }
      ::-webkit-scrollbar-thumb:hover { background: ${t.borderHover}; }

      @keyframes sa-slideUp  { from{opacity:0;transform:translateY(20px)} to{opacity:1;transform:translateY(0)} }
      @keyframes sa-fadeIn   { from{opacity:0} to{opacity:1} }
      @keyframes sa-spin     { to{transform:rotate(360deg)} }
      @keyframes sa-pulse    { 0%,100%{opacity:1} 50%{opacity:.3} }
      @keyframes sa-orb1     { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(55px,-65px) scale(1.08)} }
      @keyframes sa-orb2     { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(-48px,55px) scale(1.05)} }
      @keyframes sa-orb3     { 0%,100%{transform:translate(0,0) scale(1)} 50%{transform:translate(35px,-35px) scale(1.10)} }
      @keyframes mover-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      @keyframes mover-row-in  { from{opacity:0;transform:translateY(9px)} to{opacity:1;transform:translateY(0)} }
      @keyframes sa-ripple   { 0%{opacity:1;transform:scale(0.4)} 100%{opacity:0;transform:scale(2.8)} }
      @keyframes sa-card-in  { from{opacity:0;transform:perspective(600px) rotateX(6deg) translateY(16px)} to{opacity:1;transform:perspective(600px) rotateX(0) translateY(0)} }
      @keyframes theme-swap  { 0%{transform:scale(0.85) rotateY(90deg);opacity:0} 100%{transform:scale(1) rotateY(0);opacity:1} }
      @keyframes logo-glow   { 0%,100%{box-shadow:0 6px 20px rgba(0,0,0,0.4), 0 0 14px ${t.glowPrimary}} 50%{box-shadow:0 6px 24px rgba(0,0,0,0.4), 0 0 28px ${t.glowPrimary}, 0 0 48px ${t.glowAccent}} }
      @keyframes sa-scanline { 0%{transform:translateY(-100%)} 100%{transform:translateY(100vh)} }

      .slideUp  { animation: sa-slideUp .55s cubic-bezier(.22,1,.36,1) both; }
      .slideUp1 { animation: sa-slideUp .55s .08s cubic-bezier(.22,1,.36,1) both; }
      .slideUp2 { animation: sa-slideUp .55s .16s cubic-bezier(.22,1,.36,1) both; }
      .slideUp3 { animation: sa-slideUp .55s .24s cubic-bezier(.22,1,.36,1) both; }
      .sa-spin  { animation: sa-spin 1s linear infinite; }
      .sa-pulse { animation: sa-pulse 2s ease-in-out infinite; }
      .card-in  { animation: sa-card-in .5s cubic-bezier(.22,1,.36,1) both; }

      .g4 { display:grid; grid-template-columns:repeat(4,1fr); gap:14px; }
      .g3 { display:grid; grid-template-columns:repeat(3,1fr); gap:14px; }
      .g2 { display:grid; grid-template-columns:repeat(2,1fr); gap:14px; }
      .g1 { display:grid; grid-template-columns:1fr; gap:14px; }
      .flex-row { display:flex; gap:10px; align-items:center; }

      @media(max-width:1100px){ .g4{ grid-template-columns:repeat(2,1fr) !important; } }
      @media(max-width:768px){
        .g4{ grid-template-columns:repeat(2,1fr) !important; gap:10px !important; }
        .g3{ grid-template-columns:repeat(2,1fr) !important; gap:10px !important; }
        .g2{ grid-template-columns:1fr !important; gap:10px !important; }
        .hide-mob{ display:none !important; }
      }
      @media(max-width:480px){
        .g4{ grid-template-columns:1fr !important; }
        .g3{ grid-template-columns:1fr !important; }
      }

      .sa-glass {
        position: relative;
        border-radius: 20px;
        backdrop-filter: blur(24px) saturate(1.4);
        -webkit-backdrop-filter: blur(24px) saturate(1.4);
        transform-style: preserve-3d;
        transition: transform .22s cubic-bezier(.22,1,.36,1),
                    box-shadow .22s ease,
                    border-color .3s ease,
                    background .35s ease;
        overflow: hidden;
      }
      .sa-glass::before {
        content: '';
        position: absolute; top: 0; left: 0; right: 0; height: 1px;
        background: linear-gradient(90deg, transparent, ${t.glassEdge} 30%, ${t.glassEdge} 70%, transparent);
        pointer-events: none; z-index: 2;
      }
      .sa-glass::after {
        content: '';
        position: absolute; bottom: 0; left: 0; right: 0; height: 1px;
        background: ${t.glassEdgeBottom};
        pointer-events: none; z-index: 2;
      }
      .sa-glass:hover { transform: translateY(-3px) translateZ(4px); }

      .sa-nav-link {
        display:flex; align-items:center; gap:11px; padding:9px 13px;
        border-radius:12px; font-size:13px; font-weight:500;
        border:1px solid transparent;
        cursor:pointer; text-decoration:none;
        white-space:nowrap; overflow:hidden;
        transition: background .18s, border-color .18s, color .18s, transform .18s;
      }
      .sa-nav-link .nav-label { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; flex:1; }

      .sa-resize-handle {
        position:absolute; right:-4px; top:0; bottom:0; width:8px;
        cursor:col-resize; z-index:30;
        display:flex; align-items:center; justify-content:center;
        opacity:0; transition:opacity .2s;
      }
      .sa-resize-handle:hover { opacity:1; }
      .sa-resize-handle::after {
        content:''; width:3px; height:56px; border-radius:4px;
        background: ${t.glowPrimary};
        box-shadow: 0 0 12px ${t.glowPrimary};
      }

      .sa-topbar {
        display:none; align-items:center; gap:12px; padding:11px 16px;
        position:sticky; top:0; z-index:50;
        backdrop-filter:blur(28px); -webkit-backdrop-filter:blur(28px);
        border-bottom:1px solid; transition:background .35s, border-color .35s;
      }

      @media(max-width:768px){
        .sa-sidebar-desk{ display:none !important; }
        .sa-topbar       { display:flex !important; }
        .sa-main         { padding:14px !important; }
      }
      @media(min-width:769px){
        .sa-sidebar-mob { display:none !important; }
        .sa-topbar      { display:none !important; }
        .sa-main        { padding:26px 30px; }
      }
      @media(min-width:1400px){ .sa-main{ padding:30px 38px; } }
    `}</style>
  );
};

/* ────────────────────────────────────────────────
   FLOATING ORBS
──────────────────────────────────────────────── */
export const FloatingOrbs = () => {
  const { theme } = useTheme();
  const t = tokens(theme);
  return (
    <div aria-hidden style={{ position:"fixed",inset:0,pointerEvents:"none",overflow:"hidden",zIndex:0 }}>
      {[
        { style:{top:"3%", left:"6%",   width:580, height:580}, c:t.orb1, a:"sa-orb1 12s ease-in-out infinite" },
        { style:{top:"50%",right:"4%",  width:440, height:440}, c:t.orb2, a:"sa-orb2 14s ease-in-out infinite" },
        { style:{bottom:"6%",left:"32%",width:360, height:360}, c:t.orb3, a:"sa-orb3 16s ease-in-out infinite" },
      ].map((o,i) => (
        <div key={i} style={{
          position:"absolute", ...o.style, borderRadius:"50%",
          background:`radial-gradient(circle at 40% 40%, ${o.c} 0%, transparent 65%)`,
          animation:o.a, filter:"blur(3px)",
        }}/>
      ))}
      <div style={{
        position:"absolute", inset:0,
        backgroundImage:`linear-gradient(${t.gridColor} 1px,transparent 1px), linear-gradient(90deg,${t.gridColor} 1px,transparent 1px)`,
        backgroundSize:"56px 56px",
      }}/>
    </div>
  );
};

/* ────────────────────────────────────────────────
   THEME SWITCHER
──────────────────────────────────────────────── */
export const ThemeSwitcher = ({ compact = false }) => {
  const { theme, setTheme } = useTheme();
  const t = tokens(theme);
  const themes = [
    { id:"midnight", icon:"🌑", name:"Midnight", grad:"linear-gradient(135deg,#4F80F0,#7B4EE8)" },
    { id:"arctic",   icon:"❄️", name:"Arctic",   grad:"linear-gradient(135deg,#3B82F6,#6366F1)" },
    { id:"aurora",   icon:"🌌", name:"Aurora",   grad:"linear-gradient(135deg,#A855F7,#EC4899)" },
  ];
  const idx = themes.findIndex(th => th.id === theme);
  const cur = themes[idx] || themes[0];

  if (compact) {
    const next = themes[(idx + 1) % 3];
    return (
      <button onClick={() => setTheme(next.id)} title={`Switch to ${next.name}`}
        style={{
          width:36, height:36, borderRadius:10, border:"none", fontSize:18,
          cursor:"pointer", background:cur.grad,
          boxShadow:`0 4px 16px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.2)`,
          transition:"transform .25s cubic-bezier(.34,1.56,.64,1)", flexShrink:0,
        }}
        onMouseEnter={e => e.currentTarget.style.transform="scale(1.14) rotate(10deg)"}
        onMouseLeave={e => e.currentTarget.style.transform="scale(1) rotate(0)"}
      >{cur.icon}</button>
    );
  }

  return (
    <div style={{ padding:4, borderRadius:14, background:"rgba(0,0,0,0.2)",
      border:"1px solid rgba(255,255,255,0.06)", display:"flex", gap:4 }}>
      {themes.map(th => {
        const active = theme === th.id;
        return (
          <button key={th.id} onClick={() => setTheme(th.id)} title={th.name}
            style={{
              flex:1, padding:"9px 4px", borderRadius:10, border:"none",
              display:"flex", flexDirection:"column", alignItems:"center", gap:5,
              cursor:"pointer",
              background: active ? th.grad : "transparent",
              boxShadow: active
                ? "0 4px 18px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.18)"
                : "none",
              transform: active ? "scale(1.04)" : "scale(1)",
              transition:"all .22s cubic-bezier(.22,1,.36,1)",
            }}
            onMouseEnter={e => { if (!active) e.currentTarget.style.background="rgba(255,255,255,0.08)"; }}
            onMouseLeave={e => { if (!active) e.currentTarget.style.background="transparent"; }}
          >
            <span style={{ fontSize:18, lineHeight:1 }}>{th.icon}</span>
            <span style={{
              fontSize:9.5, fontWeight:700, letterSpacing:"0.05em", textTransform:"uppercase",
              color: active ? "#FFFFFF" : t.textSecondary,
              transition:"color .2s",
            }}>{th.name}</span>
          </button>
        );
      })}
    </div>
  );
};

export const ThemeBtn = ({ compact = false }) => <ThemeSwitcher compact={compact} />;

/* ────────────────────────────────────────────────
   APP SHELL
──────────────────────────────────────────────── */
const AppShell = ({ children, activePage }) => {
  const { theme, isDark } = useTheme();
  const t    = tokens(theme);
  const cfg  = getThemeConfig(theme);
  const user = getUser();
  const loc  = useLocation();
  const active = activePage || loc.pathname;

  const [sbWidth, setSbWidth] = useState(() => {
    try { return Math.max(SB_MIN, Math.min(SB_MAX, Number(localStorage.getItem(SB_KEY)) || SB_DEFAULT)); }
    catch { return SB_DEFAULT; }
  });
  const [drawerOpen, setDrawerOpen] = useState(false);
  const dragRef = useRef(null);
  const sbRef   = useRef(null);

  useEffect(() => {
    const h = () => {};
    window.addEventListener("resize", h);
    return () => window.removeEventListener("resize", h);
  }, []);
  useEffect(() => { setDrawerOpen(false); }, [loc.pathname]);
  useEffect(() => {
    document.body.style.overflow = drawerOpen ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [drawerOpen]);

  const startResize = useCallback((e) => {
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startW: sbWidth };
    document.body.classList.add("sb-dragging");
    const onMove = (ev) => {
      const next = Math.max(SB_MIN, Math.min(SB_MAX, dragRef.current.startW + ev.clientX - dragRef.current.startX));
      setSbWidth(next);
    };
    const onUp = () => {
      document.body.classList.remove("sb-dragging");
      setSbWidth(w => { try { localStorage.setItem(SB_KEY, String(w)); } catch{} return w; });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [sbWidth]);

  const SidebarContent = ({ showClose = false }) => (
    <>
      {/* Logo */}
      <div style={{
        padding:"18px 16px 14px", borderBottom:`1px solid ${t.border}`,
        display:"flex", alignItems:"center", justifyContent:"space-between",
        flexShrink:0, position:"relative", overflow:"hidden",
      }}>
        <div style={{
          position:"absolute", inset:0,
          background:`radial-gradient(ellipse at 15% 50%, ${t.glowPrimary} 0%, transparent 65%)`,
          opacity:0.55, pointerEvents:"none",
        }}/>
        <div style={{ display:"flex", alignItems:"center", gap:11, minWidth:0, position:"relative", zIndex:1 }}>
          <div style={{
            width:40, height:40, borderRadius:13, flexShrink:0,
            background: cfg.gradientBtn || cfg.gradient,
            boxShadow:`0 6px 22px ${t.glowPrimary}, 0 2px 6px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.25), inset 0 -1px 0 rgba(0,0,0,0.3)`,
            display:"flex", alignItems:"center", justifyContent:"center",
            transform:"perspective(160px) rotateX(8deg) rotateY(-4deg)",
            border:`1px solid rgba(255,255,255,0.18)`,
          }}>
            <BarChart3 size={19} style={{ color:"#FFFFFF", filter:"drop-shadow(0 2px 5px rgba(0,0,0,0.5))" }}/>
          </div>
          <div style={{ minWidth:0, overflow:"hidden" }}>
            <p style={{
              margin:0, fontSize:14.5, fontWeight:800,
              fontFamily:"'Syne', sans-serif",
              color: t.titleColor || t.textPrimary,
              textShadow: t.isDark ? `0 0 20px ${t.glowPrimary}` : "none",
              whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis",
              letterSpacing:"-0.01em",
            }}>StockAnalyzer</p>
            <p style={{
              margin:0, fontSize:9.5, whiteSpace:"nowrap",
              color: t.textMuted,
              letterSpacing:"0.06em", textTransform:"uppercase",
              fontWeight:600,
            }}>AI-Powered · 3 Themes</p>
          </div>
        </div>
        {showClose && (
          <button onClick={() => setDrawerOpen(false)} style={{
            width:30, height:30, borderRadius:8, flexShrink:0, zIndex:1,
            background:t.inputBg, border:`1px solid ${t.border}`,
            color:t.textSecondary, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center",
          }}>
            <X size={14}/>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav style={{
        flex:1, padding:"10px 8px",
        overflowY:"auto", overflowX:"hidden",
        minHeight:0,
      }}>
        {NAV.map(({ icon: Icon, label, to }) => {
          const isActive = active === to;
          // Special gradient for AI Trading nav item
          const isAI = to === "/ai";
          return (
            <Link key={to} to={to} className="sa-nav-link" style={{
              color:      isActive ? "#FFFFFF" : t.textSecondary,
              background: isActive
                ? isAI
                  ? "linear-gradient(135deg, rgba(88,166,255,0.22), rgba(161,80,218,0.18))"
                  : `linear-gradient(135deg, ${t.accentPrimary}28, ${t.accentSecond}18)`
                : "transparent",
              border:     `1px solid ${isActive ? (isAI ? "rgba(88,166,255,0.38)" : t.accentPrimary + "38") : "transparent"}`,
              boxShadow:  isActive
                ? isAI
                  ? "0 4px 18px rgba(88,166,255,0.25), inset 0 1px 0 rgba(255,255,255,0.10)"
                  : `0 4px 18px ${t.glowPrimary}, inset 0 1px 0 rgba(255,255,255,0.10)`
                : "none",
              marginBottom: 3,
              transform:  isActive ? "translateX(3px)" : "translateX(0)",
            }}
              onMouseEnter={e => {
                if (!isActive) {
                  e.currentTarget.style.background = isAI
                    ? "rgba(88,166,255,0.08)"
                    : t.navHover;
                  e.currentTarget.style.color = t.textPrimary;
                  e.currentTarget.style.transform = "translateX(4px)";
                  e.currentTarget.style.borderColor = isAI ? "rgba(88,166,255,0.2)" : t.border;
                }
              }}
              onMouseLeave={e => {
                if (!isActive) {
                  e.currentTarget.style.background = "transparent";
                  e.currentTarget.style.color = t.textSecondary;
                  e.currentTarget.style.transform = "translateX(0)";
                  e.currentTarget.style.borderColor = "transparent";
                }
              }}
            >
              <div style={{
                width:30, height:30, borderRadius:9, flexShrink:0,
                display:"flex", alignItems:"center", justifyContent:"center",
                background: isActive
                  ? isAI ? "rgba(88,166,255,0.20)" : `${t.accentPrimary}20`
                  : `${t.textMuted}12`,
                border: `1px solid ${isActive
                  ? isAI ? "rgba(88,166,255,0.35)" : t.accentPrimary + "30"
                  : "transparent"}`,
                boxShadow: isActive
                  ? isAI ? "0 2px 10px rgba(88,166,255,0.3)" : `0 2px 10px ${t.glowPrimary}`
                  : "none",
                transition: "all .18s",
              }}>
                <Icon size={14} style={{
                  color: isActive
                    ? isAI ? "#58A6FF" : t.accentPrimary
                    : t.textMuted,
                  filter: isActive
                    ? isAI ? "drop-shadow(0 0 6px #58A6FF)" : `drop-shadow(0 0 6px ${t.accentPrimary})`
                    : "none",
                  transition: "all .18s",
                }}/>
              </div>
              <span className="nav-label" style={{
                fontWeight: isActive ? 600 : 500,
                color: isActive ? "#FFFFFF" : t.textSecondary,
              }}>{label}</span>
              {isActive && (
                <div style={{
                  marginLeft:"auto", width:6, height:6, borderRadius:"50%",
                  background: isAI ? "#58A6FF" : t.accentPrimary,
                  boxShadow: isAI
                    ? "0 0 8px #58A6FF, 0 0 16px rgba(88,166,255,0.5)"
                    : `0 0 8px ${t.accentPrimary}, 0 0 16px ${t.glowPrimary}`,
                  flexShrink:0,
                }}/>
              )}
              {/* AI badge for non-active state */}
              {isAI && !isActive && (
                <span style={{
                  marginLeft:"auto", fontSize:8, fontWeight:800,
                  padding:"2px 5px", borderRadius:4,
                  background:"linear-gradient(135deg,#58A6FF,#A150DA)",
                  color:"#fff", letterSpacing:"0.04em", flexShrink:0,
                }}>NEW</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom: theme + user */}
      <div style={{ padding:"14px 10px", borderTop:`1px solid ${t.border}`, flexShrink:0 }}>
        <p style={{
          fontSize:10, fontWeight:700, letterSpacing:"0.08em",
          textTransform:"uppercase", color:t.textMuted,
          margin:"0 0 8px 4px",
        }}>Appearance</p>
        <div style={{ marginBottom:14 }}>
          <ThemeSwitcher/>
        </div>
        <div style={{
          display:"flex", alignItems:"center", gap:10,
          padding:"10px 12px", borderRadius:13,
          background: t.cardBg,
          border:`1px solid ${t.border}`,
          boxShadow: `inset 0 1px 0 ${t.glassEdge}, ${t.shadow}`,
        }}>
          <div style={{
            width:32, height:32, borderRadius:10, flexShrink:0,
            background: cfg.gradientBtn || cfg.gradient,
            border:"1px solid rgba(255,255,255,0.20)",
            boxShadow:`0 3px 12px ${t.glowPrimary}`,
            display:"flex", alignItems:"center", justifyContent:"center",
            fontSize:13, fontWeight:700, color:"#FFFFFF",
          }}>
            {(user?.name || "U").slice(0,1).toUpperCase()}
          </div>
          <div style={{ minWidth:0, flex:1 }}>
            <p style={{ margin:0, fontSize:12, fontWeight:600, color:t.textPrimary,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {user?.name || "User"}
            </p>
            <p style={{ margin:0, fontSize:10, color:t.textMuted,
              overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>
              {user?.email || "Signed in"}
            </p>
          </div>
          <button onClick={() => logout(true)} title="Sign Out"
            style={{ padding:7, borderRadius:9, background:"transparent",
              border:"1px solid transparent", color:"#F87171",
              cursor:"pointer", transition:"all .2s", flexShrink:0 }}
            onMouseEnter={e => {
              e.currentTarget.style.background="rgba(248,113,113,0.14)";
              e.currentTarget.style.borderColor="rgba(248,113,113,0.22)";
              e.currentTarget.style.transform="scale(1.08)";
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background="transparent";
              e.currentTarget.style.borderColor="transparent";
              e.currentTarget.style.transform="scale(1)";
            }}
          >
            <LogOut size={14}/>
          </button>
        </div>
      </div>
    </>
  );

  const sidebarBase = {
    background:     t.sidebarBg,
    borderRight:   `1px solid ${t.sidebarBorder}`,
    backdropFilter: "blur(32px)", WebkitBackdropFilter:"blur(32px)",
    display:        "flex",
    flexDirection:  "column",
    height:         "100vh",
    minHeight:      0,
    overflow:       "hidden",
    transition:     "background .4s, border-color .4s",
    boxShadow:      `inset -1px 0 0 ${t.glassEdge}, 4px 0 32px rgba(0,0,0,0.25)`,
  };

  return (
    <div style={{
      height:"100vh", display:"flex", overflow:"hidden",
      background: t.pageBg,
      color: t.textPrimary,
      transition:"background .4s, color .35s",
      position:"relative",
    }}>
      <GlobalStyles/>
      <FloatingOrbs/>

      {/* Desktop Sidebar */}
      <aside ref={sbRef} className="sa-sidebar-desk" style={{
        ...sidebarBase,
        width:sbWidth, minWidth:SB_MIN, maxWidth:SB_MAX,
        flexShrink:0,
        position:"sticky", top:0,
        zIndex:20,
      }}>
        <SidebarContent/>
        <div className="sa-resize-handle" onMouseDown={startResize} title="Drag to resize">
          <GripVertical size={13} style={{ color:`${t.accentPrimary}70`, position:"absolute" }}/>
        </div>
      </aside>

      {/* Mobile Overlay */}
      {drawerOpen && (
        <div onClick={() => setDrawerOpen(false)} style={{
          position:"fixed", inset:0, zIndex:299,
          background:"rgba(0,0,0,0.70)",
          backdropFilter:"blur(10px)", WebkitBackdropFilter:"blur(10px)",
          animation:"sa-fadeIn .2s ease",
        }}/>
      )}

      {/* Mobile Drawer */}
      <aside className="sa-sidebar-mob" style={{
        ...sidebarBase,
        position:"fixed", top:0, left:0, bottom:0,
        width:Math.min(sbWidth, 290),
        height:"100vh",
        zIndex:300,
        transform: drawerOpen ? "translateX(0)" : "translateX(-112%)",
        transition:"transform .3s cubic-bezier(.4,0,.2,1), background .4s",
        boxShadow: drawerOpen ? `16px 0 56px rgba(0,0,0,0.60), 0 0 0 1px ${t.border}` : "none",
      }}>
        <SidebarContent showClose/>
      </aside>

      {/* Main */}
      <div style={{
        flex:1, display:"flex", flexDirection:"column",
        minWidth:0, height:"100vh",
        overflow:"hidden", position:"relative", zIndex:5,
      }}>
        <div className="sa-topbar" style={{
          background:t.sidebarBg, borderBottomColor:t.border,
          flexShrink:0,
        }}>
          <button onClick={() => setDrawerOpen(true)} style={{
            width:38, height:38, borderRadius:11,
            background:t.inputBg, border:`1px solid ${t.border}`,
            color:t.textPrimary, cursor:"pointer",
            display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0,
          }}>
            <Menu size={18}/>
          </button>
          <span style={{
            fontSize:16, fontWeight:800, letterSpacing:"-.02em", flex:1,
            fontFamily:"'Syne', sans-serif",
            color: t.titleColor || t.textPrimary,
            textShadow: t.isDark ? `0 0 16px ${t.glowPrimary}` : "none",
          }}>StockAnalyzer</span>
          <ThemeSwitcher compact/>
        </div>

        <main className="sa-main" style={{
          flex:1, overflowY:"auto", overflowX:"hidden",
          minHeight:0,
        }}>
          {children}
        </main>
      </div>
    </div>
  );
};

export default AppShell;
export { ThemeBtn as ThemeToggle };