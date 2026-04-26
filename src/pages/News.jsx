/**
 * News.jsx — Rewritten to match History.jsx design system
 * AppShell + theme tokens (midnight / arctic / aurora)
 * Same card style, sidebar, filters, skeleton as History.jsx
 */

import React, { useState, useEffect, useCallback } from "react";
import {
  Newspaper, Search, RefreshCw, Clock, ExternalLink,
  AlertTriangle, X,
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
import AppShell          from "./AppShell.jsx";
import { api }           from "../utils/api.js";
import { useTheme }      from "../context/ThemeContext.jsx";
import { tokens }        from "../context/theme.js";
import useAuthGuard      from "../hooks/useAuthGuard.js";

/* ── Helpers ─────────────────────────────────────────────── */
const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

const sentColor = (label) =>
  label === "Positive" ? "#34d399"
  : label === "Negative" ? "#f87171"
  : "#fbbf24";

/* ── Popular chips ──────────────────────────────────────── */
const POPULAR = [
  { label: "AAPL",      symbol: "AAPL"        },
  { label: "TSLA",      symbol: "TSLA"        },
  { label: "NVDA",      symbol: "NVDA"        },
  { label: "MSFT",      symbol: "MSFT"        },
  { label: "RELIANCE",  symbol: "RELIANCE.NS" },
  { label: "TCS",       symbol: "TCS.NS"      },
  { label: "INFY",      symbol: "INFY.NS"     },
  { label: "HDFCBANK",  symbol: "HDFCBANK.NS" },
];

/* ── Skeleton (same as History.jsx shimmer) ─────────────── */
const Skel = ({ t }) => (
  <div style={{
    display: "flex", gap: 14, padding: "16px 18px",
    borderRadius: 14, border: `1px solid ${t.border}`,
    background: t.cardGradient,
    animation: "sa-pulse 1.5s ease-in-out infinite",
  }}>
    <div style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 10,
      background: `rgba(255,255,255,0.06)` }}/>
    <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8 }}>
      <div style={{ height: 13, borderRadius: 6,
        background: `rgba(255,255,255,0.06)`, width: "90%" }}/>
      <div style={{ height: 13, borderRadius: 6,
        background: `rgba(255,255,255,0.06)`, width: "70%" }}/>
      <div style={{ height: 10, borderRadius: 6,
        background: `rgba(255,255,255,0.04)`, width: "50%", marginTop: 4 }}/>
      <div style={{ height: 20, borderRadius: 20,
        background: `rgba(255,255,255,0.04)`, width: 80 }}/>
    </div>
  </div>
);

/* ── News card ──────────────────────────────────────────── */
const NewsCard = ({ article, t }) => {
  const [imgErr, setImgErr] = useState(false);
  const sc = article.sentiment ? sentColor(article.sentiment) : null;

  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer"
      style={{
        display: "flex", gap: 14, padding: "14px 18px",
        borderRadius: 14, border: `1px solid ${t.border}`,
        background: t.cardGradient,
        backdropFilter: "blur(16px)", WebkitBackdropFilter: "blur(16px)",
        boxShadow: t.shadow, textDecoration: "none",
        transition: "all .22s cubic-bezier(.22,1,.36,1)",
        cursor: "pointer", position: "relative", overflow: "hidden",
      }}
      onMouseEnter={e => {
        e.currentTarget.style.borderColor = `${t.accentPrimary}40`;
        e.currentTarget.style.transform   = "translateY(-2px)";
        e.currentTarget.style.boxShadow   = `${t.shadow}, 0 8px 24px ${t.glowPrimary}`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.borderColor = t.border;
        e.currentTarget.style.transform   = "translateY(0)";
        e.currentTarget.style.boxShadow   = t.shadow;
      }}>

      {/* Left accent bar (sentiment colour) */}
      {sc && (
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 3,
          background: `linear-gradient(180deg,${sc},${sc}40)`,
          borderRadius: "14px 0 0 14px" }}/>
      )}

      {/* Thumbnail */}
      <div style={{ width: 72, height: 72, flexShrink: 0, borderRadius: 10,
        overflow: "hidden", background: t.inputBg,
        display: "flex", alignItems: "center", justifyContent: "center",
        border: `1px solid ${t.border}` }}>
        {article.imageUrl && !imgErr ? (
          <img src={article.imageUrl} alt=""
            onError={() => setImgErr(true)}
            style={{ width: "100%", height: "100%", objectFit: "cover" }}/>
        ) : (
          <Newspaper size={22} style={{ color: t.textMuted, opacity: 0.4 }}/>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: "0 0 5px", fontSize: 13, fontWeight: 600,
          color: t.textPrimary, lineHeight: 1.45,
          overflow: "hidden", display: "-webkit-box",
          WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
          {article.headline}
        </p>
        {article.description && (
          <p style={{ margin: "0 0 8px", fontSize: 11, color: t.textSecondary,
            lineHeight: 1.55, overflow: "hidden", display: "-webkit-box",
            WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
            {article.description}
          </p>
        )}
        <div style={{ display: "flex", alignItems: "center",
          gap: 8, flexWrap: "wrap" }}>
          {article.source && (
            <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 999,
              background: `${t.accentPrimary}14`, color: t.accentPrimary,
              border: `1px solid ${t.accentPrimary}28`, fontWeight: 700 }}>
              {article.source}
            </span>
          )}
          {article.publishedAt && (
            <span style={{ fontSize: 10, color: t.textMuted,
              display: "flex", alignItems: "center", gap: 3 }}>
              <Clock size={9}/> {timeAgo(article.publishedAt)}
            </span>
          )}
          {sc && (
            <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 999,
              background: `${sc}14`, color: sc,
              border: `1px solid ${sc}28`, fontWeight: 700, marginLeft: "auto" }}>
              {article.sentiment}
            </span>
          )}
        </div>
      </div>

      <ExternalLink size={13} style={{ color: t.textMuted, flexShrink: 0,
        marginTop: 2, transition: "color .15s" }}/>
    </a>
  );
};

/* ═══════════════════════════════════════════════════════════
   MAIN PAGE
═══════════════════════════════════════════════════════════ */
const News = () => {
  useAuthGuard();
  const { isDark, theme } = useTheme();
  const t = tokens(theme);

  const [searchParams, setSearchParams] = useSearchParams();
  const initialSymbol = searchParams.get("symbol") || "";

  const [input,      setInput]      = useState(initialSymbol);
  const [symbol,     setSymbol]     = useState(initialSymbol);
  const [news,       setNews]       = useState([]);
  const [loading,    setLoading]    = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error,      setError]      = useState(null);
  const [fetchedAt,  setFetchedAt]  = useState(null);
  const [filter,     setFilter]     = useState("ALL");

  /* Shared card style — identical to History.jsx */
  const card = {
    background:     t.cardGradient,
    border:         `1px solid ${t.border}`,
    borderRadius:   18,
    backdropFilter: "blur(22px)", WebkitBackdropFilter: "blur(22px)",
    boxShadow:      t.shadow,
    padding:        20,
    transition:     "background .35s, border-color .3s",
  };

  const accentBtn = {
    background: t.gradient || "linear-gradient(135deg,#3b82f6,#6366f1)",
    border: "none", color: "#fff",
    boxShadow: `0 4px 14px ${t.glowPrimary || "rgba(59,130,246,0.3)"}`,
  };

  /* ── Fetch ── */
  const loadNews = useCallback(async (sym, force = false) => {
    if (!sym) return;
    force ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const data = force
        ? await api.post(`/news/fetch/${sym}`, {})
        : await api.get(`/news/${sym}`);
      if (!data) return;
      setNews(data.articles || []);
      setFetchedAt(new Date().toISOString());
      setFilter("ALL");
    } catch (err) {
      setError(err.message || "Failed to load news");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    if (initialSymbol) loadNews(initialSymbol);
  }, []); // eslint-disable-line

  const handleSearch = (sym) => {
    const s = (sym || input).toUpperCase().trim();
    if (!s) return;
    setSymbol(s); setSearchParams({ symbol: s });
    setNews([]); loadNews(s);
  };

  /* ── Filter + counts ── */
  const filtered = filter === "ALL" ? news
    : news.filter(a => a.sentiment === filter);

  const counts = {
    Positive: news.filter(a => a.sentiment === "Positive").length,
    Neutral:  news.filter(a => a.sentiment === "Neutral").length,
    Negative: news.filter(a => a.sentiment === "Negative").length,
  };

  return (
    <AppShell activePage="/news">

      {/* ── HEADER ── */}
      <div style={{ display: "flex", alignItems: "center",
        justifyContent: "space-between", marginBottom: 26,
        animation: "sa-slideUp 0.5s ease both", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800,
            letterSpacing: "-0.04em", fontFamily: "'Syne', sans-serif",
            color: t.titleColor || t.textPrimary,
            textShadow: isDark ? `0 0 24px ${t.glowPrimary}` : "none" }}>
            Stock News
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: t.textMuted }}>
            Latest news from Yahoo Finance, Finnhub & GNews
          </p>
        </div>

        {symbol && !loading && (
          <button onClick={() => loadNews(symbol, true)} disabled={refreshing}
            style={{ padding: "8px 14px", borderRadius: 10, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 6,
              fontSize: 12, fontWeight: 600, transition: "all .2s",
              background: t.inputBg, border: `1px solid ${t.border}`,
              color: t.textSecondary, opacity: refreshing ? .6 : 1,
              boxShadow: t.shadow }}>
            <RefreshCw size={13} style={refreshing
              ? { animation: "sa-spin 1s linear infinite" } : {}}/>
            {refreshing ? "Fetching…" : "Refresh"}
          </button>
        )}
      </div>

      {/* ── SEARCH CARD ── */}
      <div style={{ ...card, marginBottom: 18,
        animation: "sa-slideUp 0.5s 0.06s ease both" }}>
        <p style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700,
          color: t.textPrimary }}>Search stock news</p>

        <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
          <div style={{ flex: 1, position: "relative" }}>
            <Search size={13} style={{ position: "absolute", left: 13,
              top: "50%", transform: "translateY(-50%)",
              color: t.textMuted, pointerEvents: "none" }}/>
            <input value={input}
              onChange={e => setInput(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="AAPL · RELIANCE.NS · TCS.NS"
              style={{ width: "100%", boxSizing: "border-box",
                background: t.inputBg,
                border: `1px solid ${t.inputBorder || t.border}`,
                borderRadius: 11, padding: "9px 13px 9px 36px",
                fontSize: 13, color: t.textPrimary, outline: "none",
                transition: "border-color .2s, box-shadow .2s" }}
              onFocus={e => {
                e.target.style.borderColor = t.inputFocus || t.accentPrimary;
                e.target.style.boxShadow   = `0 0 0 3px ${t.accentPrimary}18`;
              }}
              onBlur={e => {
                e.target.style.borderColor = t.inputBorder || t.border;
                e.target.style.boxShadow   = "none";
              }}/>
          </div>

          <button onClick={() => handleSearch()} disabled={loading || !input}
            style={{ padding: "9px 18px", borderRadius: 11, fontSize: 13,
              fontWeight: 600, cursor: loading || !input ? "not-allowed" : "pointer",
              display: "flex", alignItems: "center", gap: 6,
              opacity: loading || !input ? .6 : 1,
              transition: "all .2s", ...accentBtn }}>
            {loading
              ? <RefreshCw size={13} style={{ animation: "sa-spin 1s linear infinite" }}/>
              : <Search size={13}/>}
            {loading ? "Loading…" : "Search"}
          </button>
        </div>

        {/* Popular chips */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 7 }}>
          {POPULAR.map(p => (
            <button key={p.symbol}
              onClick={() => { setInput(p.symbol); handleSearch(p.symbol); }}
              style={{ fontSize: 11, padding: "5px 12px", borderRadius: 999,
                cursor: "pointer", transition: "all .2s",
                background: t.inputBg, border: `1px solid ${t.border}`,
                color: t.textSecondary, fontWeight: 600 }}
              onMouseEnter={e => {
                e.currentTarget.style.borderColor = `${t.accentPrimary}50`;
                e.currentTarget.style.color       = t.accentPrimary;
                e.currentTarget.style.background  = `${t.accentPrimary}10`;
              }}
              onMouseLeave={e => {
                e.currentTarget.style.borderColor = t.border;
                e.currentTarget.style.color       = t.textSecondary;
                e.currentTarget.style.background  = t.inputBg;
              }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── RESULTS HEADER + STAT TILES ── */}
      {symbol && !loading && news.length > 0 && (
        <>
          {/* Stat tiles — identical structure to History.jsx */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)",
            gap: 12, marginBottom: 14,
            animation: "sa-slideUp 0.5s 0.08s ease both" }}>
            {[
              { label: "Total",    value: news.length,     color: t.accentPrimary || "#3b82f6" },
              { label: "Positive", value: counts.Positive, color: "#34d399" },
              { label: "Neutral",  value: counts.Neutral,  color: "#fbbf24" },
              { label: "Negative", value: counts.Negative, color: "#f87171" },
            ].map((s, i) => (
              <div key={i} style={{ ...card, textAlign: "center", padding: 16,
                boxShadow: `${t.shadow}, 0 0 20px ${s.color}10`,
                border: `1px solid ${s.color}20` }}>
                <p style={{ fontSize: 24, fontWeight: 800, margin: 0, color: s.color,
                  fontFamily: "'Syne', sans-serif", lineHeight: 1 }}>{s.value}</p>
                <p style={{ fontSize: 11, color: t.textSecondary,
                  marginTop: 5, fontWeight: 600 }}>{s.label}</p>
              </div>
            ))}
          </div>

          {/* Results header + filter (identical to History.jsx filter bar) */}
          <div style={{ display: "flex", alignItems: "center",
            justifyContent: "space-between", marginBottom: 14,
            flexWrap: "wrap", gap: 10,
            animation: "sa-slideUp 0.5s 0.1s ease both" }}>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700,
                color: t.textPrimary, fontFamily: "'Syne', sans-serif",
                display: "flex", alignItems: "center", gap: 8 }}>
                <Newspaper size={15} style={{ color: t.accentSecond || "#a78bfa" }}/>
                {symbol}
              </h2>
              <span style={{ fontSize: 10, padding: "2px 9px", borderRadius: 999,
                background: `${t.accentSecond || "#a78bfa"}14`,
                color: t.accentSecond || "#a78bfa",
                border: `1px solid ${t.accentSecond || "#a78bfa"}28`, fontWeight: 700 }}>
                {news.length} articles
              </span>
              {fetchedAt && (
                <span style={{ fontSize: 10, color: t.textMuted,
                  display: "flex", alignItems: "center", gap: 3 }}>
                  <Clock size={9}/> {timeAgo(fetchedAt)}
                </span>
              )}
            </div>

            {/* Sentiment filter — same style as History.jsx signal filter */}
            <div style={{ display: "flex", gap: 3, background: t.inputBg,
              border: `1px solid ${t.border}`, borderRadius: 11, padding: 4 }}>
              {[
                { key: "ALL",      label: "ALL",      color: t.accentPrimary || "#60a5fa" },
                { key: "Positive", label: "POSITIVE", color: "#34d399" },
                { key: "Neutral",  label: "NEUTRAL",  color: "#fbbf24" },
                { key: "Negative", label: "NEGATIVE", color: "#f87171" },
              ].map(f => {
                const active = filter === f.key;
                return (
                  <button key={f.key} onClick={() => setFilter(f.key)}
                    style={{ padding: "5px 12px", borderRadius: 8,
                      fontSize: 12, fontWeight: 600, cursor: "pointer",
                      border:      active ? `1px solid ${f.color}30` : "1px solid transparent",
                      background:  active ? `${f.color}16` : "transparent",
                      color:       active ? f.color : t.textSecondary,
                      transition:  "all .2s" }}>
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
        </>
      )}

      {/* ── ERROR ── */}
      {error && !loading && (
        <div style={{ display: "flex", alignItems: "center", gap: 12,
          padding: "13px 16px", borderRadius: 13, marginBottom: 16,
          background: "rgba(248,113,113,0.08)",
          border: "1px solid rgba(248,113,113,0.22)" }}>
          <AlertTriangle size={15} style={{ color: "#f87171", flexShrink: 0 }}/>
          <span style={{ flex: 1, fontSize: 13, color: "#fca5a5" }}>{error}</span>
          <button onClick={() => loadNews(symbol)}
            style={{ fontSize: 11, fontWeight: 600, color: "#60a5fa",
              background: "none", border: "1px solid rgba(96,165,250,.3)",
              borderRadius: 7, padding: "4px 10px", cursor: "pointer" }}>
            Retry
          </button>
          <button onClick={() => setError(null)}
            style={{ background: "none", border: "none",
              color: "rgba(252,165,165,.5)", cursor: "pointer", padding: 2 }}>
            <X size={13}/>
          </button>
        </div>
      )}

      {/* ── LOADING SKELETONS ── */}
      {loading && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8,
          animation: "sa-slideUp 0.5s 0.1s ease both" }}>
          {[...Array(5)].map((_, i) => <Skel key={i} t={t}/>)}
        </div>
      )}

      {/* ── NEWS LIST ── */}
      {!loading && filtered.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8,
          animation: "sa-slideUp 0.5s 0.14s ease both" }}>
          {filtered.map((article, i) => (
            <NewsCard key={article.url || i} article={article} t={t}/>
          ))}
        </div>
      )}

      {/* ── EMPTY: no symbol entered ── */}
      {!loading && !symbol && (
        <div style={{ ...card, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          minHeight: 380, textAlign: "center",
          animation: "sa-slideUp 0.5s 0.12s ease both" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", marginBottom: 16,
            background: `${t.accentPrimary || "#3b82f6"}14`,
            border: `1px solid ${t.accentPrimary || "#3b82f6"}28`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 0 30px ${t.glowPrimary || "rgba(59,130,246,0.2)"}` }}>
            <Newspaper size={28} style={{ color: t.accentPrimary || "#60a5fa" }}/>
          </div>
          <h2 style={{ margin: "0 0 8px", fontSize: 17, fontWeight: 700,
            fontFamily: "'Syne', sans-serif", color: t.textPrimary }}>
            Search for a Stock
          </h2>
          <p style={{ margin: "0 0 20px", fontSize: 13, color: t.textSecondary }}>
            Enter a symbol above to load the latest news
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "center" }}>
            {["AAPL","TSLA","NVDA","RELIANCE.NS","TCS.NS"].map(s => (
              <button key={s}
                onClick={() => { setInput(s); handleSearch(s); }}
                style={{ padding: "6px 13px", borderRadius: 9, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", background: t.inputBg,
                  border: `1px solid ${t.border}`, color: t.textSecondary,
                  transition: "all .2s" }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = `${t.accentPrimary}50`;
                  e.currentTarget.style.color       = t.accentPrimary;
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = t.border;
                  e.currentTarget.style.color       = t.textSecondary;
                }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* ── EMPTY: symbol searched, no results ── */}
      {!loading && symbol && news.length === 0 && !error && (
        <div style={{ ...card, textAlign: "center", padding: "60px 20px",
          animation: "sa-slideUp 0.5s 0.12s ease both" }}>
          <Newspaper size={40} style={{ opacity: 0.15, margin: "0 auto 14px",
            display: "block" }}/>
          <p style={{ fontSize: 14, fontWeight: 600, color: t.textPrimary,
            margin: "0 0 6px" }}>No news found for {symbol}</p>
          <p style={{ fontSize: 12, color: t.textMuted, margin: "0 0 18px" }}>
            Try fetching fresh articles directly from the source
          </p>
          <button onClick={() => loadNews(symbol, true)}
            style={{ padding: "9px 22px", borderRadius: 11, fontSize: 13,
              fontWeight: 600, cursor: "pointer", ...accentBtn }}>
            Fetch Fresh News
          </button>
        </div>
      )}

      {/* ── EMPTY: filter returned nothing ── */}
      {!loading && news.length > 0 && filtered.length === 0 && (
        <div style={{ textAlign: "center", padding: "48px 0",
          color: t.textMuted, fontSize: 13 }}>
          No {filter} articles found
          <button onClick={() => setFilter("ALL")}
            style={{ display: "block", margin: "10px auto 0", fontSize: 11,
              color: t.accentPrimary, background: "none", border: "none",
              cursor: "pointer", textDecoration: "underline" }}>
            Show all articles
          </button>
        </div>
      )}

    </AppShell>
  );
};

export default News;