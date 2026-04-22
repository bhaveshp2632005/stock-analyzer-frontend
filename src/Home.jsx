import React, { useState, useEffect, useRef } from "react";
import { BarChart3, Brain, Shield, ArrowRight, TrendingUp, TrendingDown, Sun, Moon, Menu, X, Zap, Eye, Activity } from "lucide-react";
import { validateToken } from "./utils/auth.js";
import { useTheme } from "./context/ThemeContext.jsx";

/* ─────────────────────────────────────────────
   PARTICLE CANVAS
───────────────────────────────────────────── */
function ParticleCanvas({ isDark }) {
  const ref = useRef(null);
  const animRef = useRef(null);
  const pts = useRef([]);

  useEffect(() => {
    const c = ref.current;
    const ctx = c.getContext("2d");
    let W, H;
    const resize = () => { W = c.width = window.innerWidth; H = c.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    pts.current = Array.from({ length: 110 }, () => ({
      x: Math.random() * window.innerWidth,
      y: Math.random() * window.innerHeight,
      vx: (Math.random() - .5) * .3,
      vy: (Math.random() - .5) * .3,
      r: Math.random() * 1.5 + .4,
      hue: [185, 160, 265][Math.floor(Math.random() * 3)],
    }));

    const draw = () => {
      ctx.clearRect(0, 0, W, H);
      const p = pts.current;
      const alpha = isDark ? .14 : .08;
      for (let i = 0; i < p.length; i++) {
        for (let j = i + 1; j < p.length; j++) {
          const dx = p[i].x - p[j].x, dy = p[i].y - p[j].y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < 130) {
            ctx.beginPath();
            ctx.moveTo(p[i].x, p[i].y);
            ctx.lineTo(p[j].x, p[j].y);
            ctx.strokeStyle = `hsla(${p[i].hue},100%,70%,${(1 - d / 130) * alpha})`;
            ctx.lineWidth = .7;
            ctx.stroke();
          }
        }
      }
      p.forEach(pt => {
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, pt.r, 0, Math.PI * 2);
        ctx.fillStyle = `hsla(${pt.hue},100%,72%,${isDark ? .55 : .35})`;
        ctx.shadowColor = `hsla(${pt.hue},100%,70%,1)`;
        ctx.shadowBlur = 7;
        ctx.fill();
        ctx.shadowBlur = 0;
        pt.x += pt.vx; pt.y += pt.vy;
        if (pt.x < 0) pt.x = W; if (pt.x > W) pt.x = 0;
        if (pt.y < 0) pt.y = H; if (pt.y > H) pt.y = 0;
      });
      animRef.current = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(animRef.current); window.removeEventListener("resize", resize); };
  }, [isDark]);

  return <canvas ref={ref} style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none" }} />;
}

/* ─────────────────────────────────────────────
   SPARKLINE
───────────────────────────────────────────── */
function SparkLine({ color = "#00ffa3" }) {
  const pts = [30, 52, 44, 68, 60, 80, 74, 88, 78, 95, 84, 100];
  const W = 340, H = 90, pad = 8;
  const hi = Math.max(...pts), lo = Math.min(...pts);
  const sx = i => pad + i * ((W - pad * 2) / (pts.length - 1));
  const sy = v => H - pad - ((v - lo) / (hi - lo)) * (H - pad * 2);
  const d = pts.map((v, i) => `${i === 0 ? "M" : "L"}${sx(i)},${sy(v)}`).join(" ");
  const area = `${d} L${sx(pts.length - 1)},${H} L${sx(0)},${H} Z`;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 80, marginTop: 16 }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity=".3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sg)" />
      <path d={d} fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" style={{ filter: `drop-shadow(0 0 6px ${color})` }} />
      <circle cx={sx(pts.length - 1)} cy={sy(pts[pts.length - 1])} r={5} fill={color} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
    </svg>
  );
}

/* ─────────────────────────────────────────────
   TICKER DATA
───────────────────────────────────────────── */
const TICKERS = [
  { sym: "AAPL",      price: "212.44", chg: "+1.23%", up: true  },
  { sym: "TSLA",      price: "248.91", chg: "+3.47%", up: true  },
  { sym: "NVDA",      price: "875.20", chg: "+5.12%", up: true  },
  { sym: "AMZN",      price: "184.50", chg: "-0.88%", up: false },
  { sym: "GOOGL",     price: "166.30", chg: "+0.65%", up: true  },
  { sym: "MSFT",      price: "414.75", chg: "+1.91%", up: true  },
  { sym: "RELIANCE",  price: "₹2841",  chg: "+1.65%", up: true  },
  { sym: "TCS",       price: "₹3920",  chg: "-0.42%", up: false },
  { sym: "INFY",      price: "₹1560",  chg: "+2.10%", up: true  },
  { sym: "META",      price: "502.10", chg: "-1.32%", up: false },
];

/* ─────────────────────────────────────────────
   MAIN
───────────────────────────────────────────── */
export default function HomePage() {
  const { isDark, toggle } = useTheme();
  const [scrolled,   setScrolled]   = useState(false);
  const [menuOpen,   setMenuOpen]   = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hoverCard,  setHoverCard]  = useState(null);
  const [mouse,      setMouse]      = useState({ x: 0, y: 0 });
  const heroRef = useRef(null);

  useEffect(() => { setIsLoggedIn(validateToken()); }, []);
  useEffect(() => {
    const s = () => setScrolled(window.scrollY > 40);
    window.addEventListener("scroll", s);
    return () => window.removeEventListener("scroll", s);
  }, []);
  useEffect(() => {
    const m = e => setMouse({ x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight });
    window.addEventListener("mousemove", m);
    return () => window.removeEventListener("mousemove", m);
  }, []);

  // 3D tilt on hero card
  const tiltX = (mouse.y - .5) * -18;
  const tiltY = (mouse.x - .5) * 18;

  // Theme-aware CSS vars
  const BG      = isDark ? "#050810"             : "#eef2ff";
  const SURFACE = isDark ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.80)";
  const BORDER  = isDark ? "rgba(255,255,255,.08)" : "rgba(59,130,246,.15)";
  const TEXT    = isDark ? "#f0f4ff"             : "#0f172a";
  const MUTED   = isDark ? "#6b7a9f"             : "#64748b";
  const ACCENT  = "#00e5ff";
  const GREEN   = "#00ffa3";
  const GLOW    = isDark ? `0 0 40px rgba(0,229,255,.3), 0 0 80px rgba(0,229,255,.12)` : `0 0 24px rgba(0,229,255,.18)`;
  const CARD_BG = isDark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.82)";
  const CARD_SH = isDark ? "0 24px 60px rgba(0,0,0,.55)" : "0 24px 60px rgba(59,130,246,.10)";

  const css = `
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:wght@300;400;500&display=swap');
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { scroll-behavior: smooth; }
    body { background: ${BG}; color: ${TEXT}; font-family: 'DM Sans', sans-serif; overflow-x: hidden; transition: background .4s, color .4s; }
    body::after { content:''; position:fixed; inset:0; background-image:url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E"); pointer-events:none; z-index:1; opacity:${isDark ? .4 : .15}; }
    ::-webkit-scrollbar { width: 5px; }
    ::-webkit-scrollbar-track { background: transparent; }
    ::-webkit-scrollbar-thumb { background: rgba(0,229,255,.3); border-radius: 10px; }
    a { text-decoration: none; }

    @keyframes ticker   { from{transform:translateX(0)} to{transform:translateX(-50%)} }
    @keyframes pulse-bg { 0%,100%{opacity:.6;transform:translateX(-50%) scale(1)} 50%{opacity:1;transform:translateX(-50%) scale(1.12)} }
    @keyframes fadeUp   { from{opacity:0;transform:translateY(28px)} to{opacity:1;transform:translateY(0)} }
    @keyframes fadeDown { from{opacity:0;transform:translateY(-20px)} to{opacity:1;transform:translateY(0)} }
    @keyframes shimmer  { 0%{background-position:0%} 100%{background-position:200%} }
    @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:.3} }
    @keyframes ring     { 0%,100%{opacity:.5;transform:translate(-50%,-50%) scale(1)} 50%{opacity:1;transform:translate(-50%,-50%) scale(1.04)} }
    @keyframes float    { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-14px)} }
    @keyframes orb1     { 0%,100%{transform:translate(0,0)} 50%{transform:translate(40px,-50px)} }
    @keyframes orb2     { 0%,100%{transform:translate(0,0)} 50%{transform:translate(-35px,40px)} }
    @keyframes orb3     { 0%,100%{transform:translate(0,0)} 50%{transform:translate(25px,-25px)} }

    .nav { position:fixed; top:0; left:0; right:0; z-index:100; transition:all .4s; }
    .nav.scrolled { background:${isDark ? "rgba(5,8,16,.88)" : "rgba(240,244,255,.92)"}; backdrop-filter:blur(28px); border-bottom:1px solid ${BORDER}; }
    .nav-inner { max-width:1300px; margin:0 auto; padding:18px 28px; display:flex; align-items:center; justify-content:space-between; gap:16px; }

    .btn-glow {
      display:inline-flex; align-items:center; gap:8px;
      padding:11px 26px; border-radius:14px; border:none; cursor:pointer;
      font-family:'DM Sans',sans-serif; font-weight:600; font-size:.9rem; color:#050810;
      background:linear-gradient(135deg,#00ffa3,#00e5ff);
      box-shadow:0 0 28px rgba(0,255,163,.42),0 0 56px rgba(0,229,255,.18);
      transition:all .3s; position:relative; overflow:hidden; text-decoration:none;
    }
    .btn-glow::before { content:''; position:absolute; inset:0; background:linear-gradient(135deg,rgba(255,255,255,.25),transparent); opacity:0; transition:opacity .3s; }
    .btn-glow:hover { transform:translateY(-2px) scale(1.03); box-shadow:0 0 50px rgba(0,255,163,.65),0 0 100px rgba(0,229,255,.3); }
    .btn-glow:hover::before { opacity:1; }

    .btn-outline {
      display:inline-flex; align-items:center; gap:8px;
      padding:11px 26px; border-radius:14px; border:1px solid ${BORDER};
      cursor:pointer; background:${SURFACE}; color:${TEXT};
      font-family:'DM Sans',sans-serif; font-size:.9rem; font-weight:500;
      transition:all .3s; backdrop-filter:blur(14px); text-decoration:none;
    }
    .btn-outline:hover { border-color:${ACCENT}; box-shadow:0 0 22px rgba(0,229,255,.22); transform:translateY(-1px); }

    .card-3d {
      position:relative; border-radius:26px; padding:36px;
      background:${CARD_BG}; border:1px solid ${BORDER};
      cursor:pointer; transform-style:preserve-3d;
      transition:transform .35s cubic-bezier(.23,1,.32,1), box-shadow .35s, border-color .35s, background .4s;
      overflow:hidden; backdrop-filter:blur(22px); -webkit-backdrop-filter:blur(22px);
    }
    .card-3d::before { content:''; position:absolute; inset:0; border-radius:inherit; background:linear-gradient(135deg,rgba(0,229,255,.07) 0%,transparent 55%); opacity:0; transition:opacity .3s; }
    .card-3d:hover { box-shadow:${CARD_SH},0 0 50px rgba(0,229,255,.14); border-color:rgba(0,229,255,.28); transform:translateY(-10px) rotateX(3deg); }
    .card-3d:hover::before { opacity:1; }

    .hero-float { animation: float 5s ease-in-out infinite; }
    @media(max-width:768px) { .desk-nav { display:none; } }
    @media(min-width:769px) { .mob-btn { display:none; } }
  `;

  const handleCTA = () => { window.location.href = validateToken() ? "/dashboard" : "/login"; };

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: css }} />
      <ParticleCanvas isDark={isDark} />

      {/* Floating orbs */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none", overflow: "hidden" }}>
        {[
          { top: "8%",  left: "10%",  w: 520, h: 520, c: isDark ? "rgba(0,229,255,.10)"  : "rgba(0,229,255,.06)",  a: "orb1 10s ease-in-out infinite" },
          { top: "55%", right: "6%",  w: 400, h: 400, c: isDark ? "rgba(0,255,163,.08)"  : "rgba(0,255,163,.05)",  a: "orb2 12s ease-in-out infinite" },
          { bottom:"12%",left:"42%",  w: 320, h: 320, c: isDark ? "rgba(167,139,250,.07)": "rgba(99,102,241,.05)", a: "orb3 14s ease-in-out infinite" },
        ].map((o, i) => (
          <div key={i} style={{ position: "absolute", ...o, borderRadius: "50%", background: `radial-gradient(circle, ${o.c} 0%, transparent 70%)`, animation: o.a }} />
        ))}
      </div>

      {/* Grid overlay */}
      <div style={{ position: "fixed", inset: 0, zIndex: 0, pointerEvents: "none",
        backgroundImage: `linear-gradient(${isDark ? "rgba(0,229,255,.03)" : "rgba(59,130,246,.04)"} 1px, transparent 1px), linear-gradient(90deg, ${isDark ? "rgba(0,229,255,.03)" : "rgba(59,130,246,.04)"} 1px, transparent 1px)`,
        backgroundSize: "48px 48px", transition: "all .4s"
      }} />

      <div style={{ position: "relative", zIndex: 2 }}>

        {/* ═══ NAVBAR ═══ */}
        <nav className={`nav${scrolled ? " scrolled" : ""}`}>
          <div className="nav-inner">
            {/* Logo */}
            <a href="/" style={{ display: "flex", alignItems: "center", gap: 11, fontFamily: "'Syne', sans-serif", fontWeight: 700, fontSize: "1.05rem", color: TEXT, cursor: "pointer" }}>
              <div style={{ width: 38, height: 38, borderRadius: 12, background: "linear-gradient(135deg, rgba(0,229,255,.22), rgba(123,94,167,.22))", border: "1px solid rgba(0,229,255,.35)", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: GLOW }}>
                <BarChart3 size={18} color={ACCENT} />
              </div>
              <span style={{ background: `linear-gradient(90deg, ${ACCENT}, ${GREEN})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>StockAnalyzer</span>
            </a>

            {/* Center: theme toggle always visible */}
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {/* THEME TOGGLE — prominent, top-center-right */}
              <button onClick={toggle} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "9px 18px", borderRadius: 50, cursor: "pointer", fontWeight: 700, fontSize: 13,
                background: isDark
                  ? "linear-gradient(135deg, rgba(99,102,241,.22), rgba(139,92,246,.16))"
                  : "linear-gradient(135deg, rgba(251,191,36,.22), rgba(251,146,60,.16))",
                border: isDark ? "1px solid rgba(139,92,246,.4)" : "1px solid rgba(251,191,36,.45)",
                color: isDark ? "#c4b5fd" : "#d97706",
                boxShadow: isDark ? "0 4px 20px rgba(139,92,246,.25), inset 0 1px 0 rgba(255,255,255,.08)" : "0 4px 20px rgba(251,191,36,.25)",
                transition: "all .3s", position: "relative", overflow: "hidden",
              }}
              onMouseEnter={e => e.currentTarget.style.transform = "translateY(-2px) scale(1.04)"}
              onMouseLeave={e => e.currentTarget.style.transform = "translateY(0) scale(1)"}
              >
                <span style={{ fontSize: 15, transition: "transform .5s", display: "flex", transform: isDark ? "rotate(0deg)" : "rotate(-20deg)" }}>
                  {isDark ? <Sun size={15} /> : <Moon size={15} />}
                </span>
                <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
                {/* Shimmer */}
                <span style={{ position: "absolute", inset: 0, background: "linear-gradient(90deg, transparent, rgba(255,255,255,.12), transparent)", backgroundSize: "200% 100%", animation: "shimmer 2.5s linear infinite", pointerEvents: "none" }} />
              </button>

              {/* Auth buttons */}
              <div className="desk-nav" style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {isLoggedIn ? (
                  <a href="/dashboard" className="btn-glow" style={{ padding: "9px 20px", fontSize: ".85rem", borderRadius: 12 }}>
                    Dashboard <ArrowRight size={14} />
                  </a>
                ) : (
                  <>
                    <a href="/login"  className="btn-outline" style={{ padding: "9px 20px", fontSize: ".85rem" }}>Sign In</a>
                    <a href="/signup" className="btn-glow"    style={{ padding: "9px 20px", fontSize: ".85rem", borderRadius: 12 }}>
                      Get Started <ArrowRight size={14} />
                    </a>
                  </>
                )}
              </div>

              <button className="mob-btn" onClick={() => setMenuOpen(o => !o)} style={{ background: "none", border: "none", color: TEXT, cursor: "pointer", padding: 4 }}>
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>

          {menuOpen && (
            <div style={{ background: isDark ? "rgba(5,8,16,.97)" : "rgba(240,244,255,.97)", backdropFilter: "blur(24px)", borderTop: `1px solid ${BORDER}`, padding: "18px 24px", display: "flex", flexDirection: "column", gap: 12 }}>
              {isLoggedIn
                ? <a href="/dashboard" className="btn-glow" style={{ justifyContent: "center" }}>Dashboard <ArrowRight size={14} /></a>
                : <><a href="/login" style={{ color: MUTED, fontSize: ".9rem", padding: "8px 0" }}>Sign In</a>
                   <a href="/signup" className="btn-glow" style={{ justifyContent: "center" }}>Get Started <ArrowRight size={14} /></a></>
              }
            </div>
          )}
        </nav>

        {/* ═══ HERO ═══ */}
        <section style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "120px 24px 80px", textAlign: "center", position: "relative" }}>
          {/* Big center glow */}
          <div style={{ position: "absolute", top: "22%", left: "50%", width: 900, height: 700, background: `radial-gradient(ellipse, ${isDark ? "rgba(0,229,255,.08)" : "rgba(0,229,255,.05)"} 0%, ${isDark ? "rgba(123,94,167,.05)" : "rgba(99,102,241,.04)"} 40%, transparent 70%)`, transform: "translateX(-50%)", pointerEvents: "none", animation: "pulse-bg 4s ease-in-out infinite" }} />

          <div style={{ position: "relative", zIndex: 2, maxWidth: 820 }}>
            {/* Badge */}
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 18px", borderRadius: 100, border: `1px solid rgba(0,229,255,.32)`, background: isDark ? "rgba(0,229,255,.06)" : "rgba(0,229,255,.08)", color: ACCENT, fontSize: ".78rem", fontWeight: 600, marginBottom: 36, animation: "fadeDown .8s ease both", backdropFilter: "blur(14px)", letterSpacing: ".06em" }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: ACCENT, boxShadow: `0 0 8px ${ACCENT}`, animation: "blink 1.5s ease-in-out infinite" }} />
              AI-POWERED MARKET INTELLIGENCE · LIVE NOW
            </div>

            {/* 3D Title card on mouse */}
            <div ref={heroRef} style={{ transform: `perspective(1200px) rotateX(${tiltX * .4}deg) rotateY(${tiltY * .4}deg)`, transition: "transform .08s linear", willChange: "transform", marginBottom: 12 }}>
              <h1 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(3.2rem, 9vw, 7.5rem)", fontWeight: 800, lineHeight: 1.0, letterSpacing: "-.04em", margin: 0, animation: "fadeUp .8s .2s ease both", color: TEXT }}>
                Trade With The
                <br />
                <span style={{ background: `linear-gradient(90deg, ${ACCENT}, ${GREEN}, ${ACCENT})`, backgroundSize: "200%", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text", animation: "shimmer 3s linear infinite", display: "block" }}>
                  Power of AI
                </span>
              </h1>
            </div>

            <p style={{ color: MUTED, fontSize: "1.1rem", lineHeight: 1.8, maxWidth: 560, margin: "0 auto 52px", animation: "fadeUp .8s .4s ease both" }}>
              Real-time market data, neural signal engine, and crystalline risk intelligence — purpose-built for the modern investor.
            </p>

            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", animation: "fadeUp .8s .6s ease both" }}>
              {isLoggedIn
                ? <a href="/dashboard" className="btn-glow" style={{ padding: "15px 38px", fontSize: "1rem", borderRadius: 16 }}>Go to Dashboard <ArrowRight size={18} /></a>
                : <>
                    <a href="/signup" className="btn-glow"    style={{ padding: "15px 38px", fontSize: "1rem", borderRadius: 16 }}>Start Analyzing Free <ArrowRight size={18} /></a>
                    <a href="/login"  className="btn-outline" style={{ padding: "15px 30px", fontSize: "1rem" }}>Sign In</a>
                  </>
              }
            </div>

            {/* Floating 3D stats row */}
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap", marginTop: 52, animation: "fadeUp .8s .8s ease both" }}>
              {[
                { icon: <Activity size={14}/>,  label: "Stocks Tracked",  val: "10,000+" },
                { icon: <Brain size={14}/>,      label: "AI Analyses/Day", val: "50,000+" },
                { icon: <Eye size={14}/>,        label: "Avg Accuracy",    val: "89.3%" },
              ].map((s, i) => (
                <div key={i} className="hero-float" style={{
                  animationDelay: `${i * .3}s`,
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "12px 22px", borderRadius: 50,
                  background: CARD_BG, border: `1px solid ${BORDER}`,
                  backdropFilter: "blur(18px)", WebkitBackdropFilter: "blur(18px)",
                  boxShadow: isDark ? "0 8px 28px rgba(0,0,0,.35), inset 0 1px 0 rgba(255,255,255,.06)" : "0 8px 28px rgba(59,130,246,.08), inset 0 1px 0 rgba(255,255,255,.8)",
                  transition: "background .4s, border-color .4s",
                }}>
                  <span style={{ color: ACCENT }}>{s.icon}</span>
                  <span style={{ fontSize: 15, fontWeight: 800, color: TEXT, fontFamily: "'Syne', sans-serif" }}>{s.val}</span>
                  <span style={{ fontSize: 11, color: MUTED }}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ═══ TICKER ═══ */}
        <div style={{ borderTop: `1px solid ${BORDER}`, borderBottom: `1px solid ${BORDER}`, overflow: "hidden", position: "relative", padding: "18px 0", background: isDark ? "rgba(0,229,255,.02)" : "rgba(0,229,255,.015)", transition: "background .4s" }}>
          <div style={{ position: "absolute", top: 0, bottom: 0, left: 0, width: 120, background: `linear-gradient(to right, ${BG}, transparent)`, zIndex: 2, transition: "background .4s" }} />
          <div style={{ position: "absolute", top: 0, bottom: 0, right: 0, width: 120, background: `linear-gradient(to left, ${BG}, transparent)`, zIndex: 2, transition: "background .4s" }} />
          <div style={{ display: "flex", gap: 48, animation: "ticker 28s linear infinite", width: "max-content" }}>
            {[...TICKERS, ...TICKERS].map((tk, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, whiteSpace: "nowrap", fontFamily: "'Syne', sans-serif", fontSize: ".82rem" }}>
                <span style={{ fontWeight: 700, color: TEXT }}>{tk.sym}</span>
                <span style={{ color: MUTED }}>{tk.price}</span>
                <span style={{ color: tk.up ? GREEN : "#ff6b6b", fontSize: ".75rem", display: "flex", alignItems: "center", gap: 3 }}>
                  {tk.up ? <TrendingUp size={10}/> : <TrendingDown size={10}/>} {tk.chg}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ═══ FEATURE CARDS ═══ */}
        <section style={{ padding: "110px 24px", maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ marginBottom: 64 }}>
            <div style={{ display: "inline-block", padding: "6px 14px", borderRadius: 8, background: isDark ? "rgba(0,229,255,.07)" : "rgba(0,229,255,.10)", border: `1px solid rgba(0,229,255,.22)`, color: ACCENT, fontSize: ".72rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", marginBottom: 20 }}>
              Core Platform
            </div>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(2rem,4.5vw,3.8rem)", fontWeight: 800, lineHeight: 1.08, letterSpacing: "-.02em", color: TEXT, marginBottom: 14 }}>
              Everything you need<br />
              <span style={{ color: ACCENT }}>to invest with clarity</span>
            </h2>
            <p style={{ color: MUTED, fontSize: "1rem", maxWidth: 480, lineHeight: 1.75 }}>Three precision tools, one unified platform. No noise, only signal.</p>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: 24 }}>
            {[
              {
                icon: <BarChart3 size={22} />, color: ACCENT, bg: isDark ? "rgba(0,229,255,.12)" : "rgba(0,229,255,.10)",
                num: "01", title: "Real-Time Market Data",
                desc: "Live prices, depth charts, and historical patterns rendered with sub-second precision. Every tick, visualized.",
                extra: <SparkLine color={ACCENT} />,
              },
              {
                icon: <Brain size={22} />, color: GREEN, bg: isDark ? "rgba(0,255,163,.12)" : "rgba(0,255,163,.10)",
                num: "02", title: "AI Signal Engine",
                desc: "Neural models distill thousands of signals into clear BUY / SELL / HOLD verdicts with confidence scores.",
                extra: (
                  <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
                    {[
                      { l: "BUY",  c: GREEN,     b: isDark ? "rgba(0,255,163,.12)" : "rgba(0,255,163,.15)" },
                      { l: "HOLD", c: ACCENT,    b: isDark ? "rgba(0,229,255,.12)" : "rgba(0,229,255,.12)" },
                      { l: "SELL", c: "#ff6b6b", b: isDark ? "rgba(255,107,107,.12)" : "rgba(255,107,107,.12)" },
                    ].map(p => (
                      <span key={p.l} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 100, background: p.b, color: p.c, fontSize: ".78rem", fontWeight: 700, border: `1px solid ${p.c}33`, fontFamily: "'Syne', sans-serif" }}>
                        {p.l === "BUY" && <span style={{ width: 5, height: 5, borderRadius: "50%", background: p.c, boxShadow: `0 0 6px ${p.c}` }} />}
                        {p.l}
                      </span>
                    ))}
                  </div>
                ),
              },
              {
                icon: <Shield size={22} />, color: "#a78bfa", bg: isDark ? "rgba(167,139,250,.12)" : "rgba(167,139,250,.10)",
                num: "03", title: "Risk Intelligence",
                desc: "Multi-factor volatility scoring surfaces LOW / MEDIUM / HIGH risk before you commit a single dollar.",
                extra: (
                  <div style={{ marginTop: 20 }}>
                    {[
                      { l: "LOW",    w: "30%", c: GREEN },
                      { l: "MEDIUM", w: "60%", c: "#fbbf24" },
                      { l: "HIGH",   w: "90%", c: "#ff6b6b" },
                    ].map(r => (
                      <div key={r.l} style={{ marginBottom: 10 }}>
                        <div style={{ fontSize: ".72rem", color: MUTED, marginBottom: 4, fontWeight: 600 }}>{r.l}</div>
                        <div style={{ height: 6, borderRadius: 100, background: isDark ? "rgba(255,255,255,.06)" : "rgba(0,0,0,.08)", overflow: "hidden" }}>
                          <div style={{ height: "100%", width: r.w, borderRadius: 100, background: r.c, boxShadow: `0 0 8px ${r.c}80` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ),
              },
            ].map((f, i) => (
              <div key={i} className="card-3d" onClick={handleCTA}
                onMouseEnter={() => setHoverCard(i)}
                onMouseLeave={() => setHoverCard(null)}
              >
                {/* Glow blob inside card */}
                <div style={{ position: "absolute", top: -30, right: -30, width: 160, height: 160, background: `radial-gradient(circle, ${f.color}20 0%, transparent 70%)`, pointerEvents: "none", transition: "opacity .3s", opacity: hoverCard === i ? 1 : 0.4 }} />

                <span style={{ position: "absolute", top: 22, right: 26, fontFamily: "'Syne', sans-serif", fontSize: "3.8rem", fontWeight: 800, color: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)", lineHeight: 1, userSelect: "none" }}>{f.num}</span>

                <div style={{ width: 52, height: 52, borderRadius: 16, background: f.bg, display: "flex", alignItems: "center", justifyContent: "center", color: f.color, marginBottom: 22, boxShadow: `0 6px 20px ${f.color}28`, border: `1px solid ${f.color}28`, transition: "transform .3s, box-shadow .3s", transform: hoverCard === i ? "translateY(-4px) scale(1.08)" : "scale(1)", filter: hoverCard === i ? `drop-shadow(0 0 12px ${f.color})` : "none" }}>
                  {f.icon}
                </div>

                <h3 style={{ fontFamily: "'Syne', sans-serif", fontSize: "1.15rem", fontWeight: 700, marginBottom: 10, color: TEXT }}>{f.title}</h3>
                <p style={{ color: MUTED, fontSize: ".88rem", lineHeight: 1.75 }}>{f.desc}</p>
                <div style={{ display: "inline-flex", alignItems: "center", gap: 6, marginTop: 22, fontSize: ".82rem", color: f.color, fontWeight: 600, transition: "gap .2s" }}>
                  Explore <ArrowRight size={14} style={{ transition: "transform .2s", transform: hoverCard === i ? "translateX(4px)" : "translateX(0)" }}/>
                </div>
                {f.extra}
              </div>
            ))}
          </div>
        </section>

        {/* ═══ GLASSMORPHIC SHOWCASE ═══ */}
        <section style={{ padding: "80px 24px", maxWidth: 1280, margin: "0 auto" }}>
          <div style={{ position: "relative", borderRadius: 32, overflow: "hidden", border: `1px solid ${BORDER}`, background: CARD_BG, backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)", boxShadow: CARD_SH, padding: "56px 48px", transition: "background .4s, border-color .4s" }}>
            {/* Inner glow */}
            <div style={{ position: "absolute", top: -80, left: "50%", transform: "translateX(-50%)", width: 600, height: 400, background: `radial-gradient(ellipse, ${isDark ? "rgba(0,229,255,.07)" : "rgba(0,229,255,.05)"} 0%, transparent 70%)`, pointerEvents: "none" }} />

            <div style={{ position: "relative", zIndex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 56, alignItems: "center" }}>
              <div>
                <div style={{ display: "inline-block", padding: "5px 12px", borderRadius: 8, background: isDark ? "rgba(0,255,163,.07)" : "rgba(0,255,163,.10)", border: `1px solid rgba(0,255,163,.22)`, color: GREEN, fontSize: ".7rem", fontWeight: 700, letterSpacing: ".08em", marginBottom: 18 }}>
                  LIVE DEMO
                </div>
                <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(1.8rem,3.5vw,3rem)", fontWeight: 800, lineHeight: 1.1, letterSpacing: "-.02em", color: TEXT, marginBottom: 16 }}>
                  AI reads the market<br />
                  <span style={{ color: GREEN }}>so you don't have to</span>
                </h2>
                <p style={{ color: MUTED, fontSize: ".95rem", lineHeight: 1.8, marginBottom: 28 }}>
                  Our neural engine processes 200+ technical indicators in real-time, delivering crystal-clear signals that cut through market noise.
                </p>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {[
                    { icon: <Zap size={14}/>, c: ACCENT, t: "Sub-second data processing" },
                    { icon: <Brain size={14}/>, c: GREEN, t: "Multi-model consensus AI" },
                    { icon: <Shield size={14}/>, c: "#a78bfa", t: "Drawdown risk protection" },
                  ].map((p, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 16px", borderRadius: 12, background: isDark ? "rgba(255,255,255,.03)" : "rgba(255,255,255,.65)", border: `1px solid ${BORDER}`, transition: "background .4s" }}>
                      <span style={{ color: p.c, flexShrink: 0 }}>{p.icon}</span>
                      <span style={{ fontSize: 13, color: TEXT, fontWeight: 500 }}>{p.t}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mock dashboard card */}
              <div style={{ borderRadius: 22, background: isDark ? "rgba(255,255,255,.04)" : "rgba(255,255,255,.85)", border: `1px solid ${BORDER}`, padding: 24, boxShadow: isDark ? "0 16px 48px rgba(0,0,0,.4)" : "0 16px 48px rgba(59,130,246,.08)", backdropFilter: "blur(16px)", transition: "background .4s, border-color .4s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
                  <div>
                    <p style={{ fontSize: 12, color: MUTED, fontWeight: 600, margin: 0 }}>NVDA · NASDAQ</p>
                    <p style={{ fontSize: 28, fontWeight: 800, fontFamily: "'Syne', sans-serif", color: TEXT, margin: "4px 0 0" }}>$875.20</p>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <p style={{ fontSize: 11, color: MUTED, margin: 0 }}>AI Signal</p>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "4px 12px", borderRadius: 20, background: "rgba(0,255,163,.14)", color: GREEN, fontWeight: 800, fontSize: 13, border: "1px solid rgba(0,255,163,.25)", marginTop: 4 }}>
                      <span style={{ width: 5, height: 5, borderRadius: "50%", background: GREEN, boxShadow: `0 0 6px ${GREEN}`, animation: "blink 1.5s infinite" }} />
                      BUY · 94%
                    </span>
                  </div>
                </div>
                <SparkLine color={GREEN} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 16 }}>
                  {[["RSI", "62.4"], ["MACD", "+8.2"], ["Vol", "48M"]].map(([l, v]) => (
                    <div key={l} style={{ background: isDark ? "rgba(255,255,255,.04)" : "rgba(0,0,0,.04)", borderRadius: 10, padding: "8px 10px", textAlign: "center" }}>
                      <p style={{ fontSize: 10, color: MUTED, margin: 0 }}>{l}</p>
                      <p style={{ fontSize: 14, fontWeight: 700, color: TEXT, margin: "3px 0 0" }}>{v}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ═══ CTA ═══ */}
        <section style={{ padding: "120px 24px", textAlign: "center", position: "relative", overflow: "hidden" }}>
          {[500, 700, 900].map((s, i) => (
            <div key={i} style={{ position: "absolute", width: s, height: s, borderRadius: "50%", border: `1px solid ${isDark ? "rgba(0,229,255,.05)" : "rgba(0,229,255,.08)"}`, top: "50%", left: "50%", pointerEvents: "none", animation: `ring 3s ease-in-out infinite`, animationDelay: `${i}s`, transition: "border-color .4s" }} />
          ))}
          <div style={{ position: "relative", zIndex: 2 }}>
            <h2 style={{ fontFamily: "'Syne', sans-serif", fontSize: "clamp(2.5rem,6vw,5.5rem)", fontWeight: 800, letterSpacing: "-.04em", lineHeight: 1.05, color: TEXT, marginBottom: 22 }}>
              Invest Smarter.<br />
              <span style={{ background: `linear-gradient(90deg, ${ACCENT}, ${GREEN})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", backgroundClip: "text" }}>Not Harder.</span>
            </h2>
            <p style={{ color: MUTED, fontSize: "1.05rem", maxWidth: 440, margin: "0 auto 48px", lineHeight: 1.78 }}>
              Join thousands of investors using AI to cut through the noise and make confident market decisions.
            </p>
            <div style={{ display: "flex", gap: 14, justifyContent: "center", flexWrap: "wrap" }}>
              {isLoggedIn
                ? <a href="/dashboard" className="btn-glow" style={{ padding: "16px 44px", fontSize: "1rem", borderRadius: 16 }}>Go to Dashboard <ArrowRight size={20} /></a>
                : <>
                    <a href="/signup" className="btn-glow"    style={{ padding: "16px 44px", fontSize: "1rem", borderRadius: 16 }}>Create Free Account <ArrowRight size={20} /></a>
                    <a href="/login"  className="btn-outline" style={{ padding: "16px 34px", fontSize: "1rem" }}>Sign In</a>
                  </>
              }
            </div>
          </div>
        </section>

        <footer style={{ padding: "24px 28px", textAlign: "center", color: MUTED, fontSize: ".82rem", borderTop: `1px solid ${BORDER}`, transition: "border-color .4s" }}>
          © 2026 StockAnalyzer · Educational use only · Not financial advice
        </footer>

      </div>
    </>
  );
}