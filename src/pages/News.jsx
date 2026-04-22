import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart3, LayoutDashboard, Search, GitCompare, History,
  LogOut, Zap, Newspaper, RefreshCw, Clock, ExternalLink,
  AlertCircle, TrendingUp,
} from "lucide-react";
import { Link, useSearchParams } from "react-router-dom";
import { api }             from "../utils/api.js";
import { getUser, logout } from "../utils/auth.js";
import useAuthGuard        from "../hooks/useAuthGuard.js";

/* ─────────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────────── */
const timeAgo = (dateStr) => {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m    = Math.floor(diff / 60000);
  if (m < 1)  return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};

/* ─────────────────────────────────────────────────────────
   SIDEBAR ITEM
───────────────────────────────────────────────────────── */
const SidebarItem = ({ icon, label, to, active }) => (
  <Link
    to={to || "#"}
    className={`flex items-center gap-3 px-3 py-2 rounded-xl transition text-sm ${
      active
        ? "bg-blue-500/15 text-blue-400"
        : "text-slate-400 hover:bg-white/5 hover:text-white"
    }`}
  >
    {icon} {label}
  </Link>
);

/* ─────────────────────────────────────────────────────────
   NEWS CARD
───────────────────────────────────────────────────────── */
const NewsCard = ({ article }) => {
  const [imgErr, setImgErr] = useState(false);

  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex gap-4 p-4 rounded-xl border border-white/8 bg-white/3
        hover:bg-white/6 hover:border-white/15 transition-all duration-200
        hover:-translate-y-0.5 group"
    >
      {/* Thumbnail */}
      <div className="w-18 h-18 shrink-0 rounded-lg overflow-hidden bg-white/5
        flex items-center justify-center" style={{ width: 72, height: 72 }}>
        {article.imageUrl && !imgErr ? (
          <img
            src={article.imageUrl}
            alt=""
            onError={() => setImgErr(true)}
            className="w-full h-full object-cover"
          />
        ) : (
          <Newspaper size={24} className="text-slate-600" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug line-clamp-2
          group-hover:text-blue-300 transition-colors">
          {article.headline}
        </p>
        {article.description && (
          <p className="text-xs text-slate-500 mt-1 line-clamp-2 leading-relaxed">
            {article.description}
          </p>
        )}
        <div className="flex items-center gap-3 mt-2">
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/10
            text-blue-400 border border-blue-500/20 font-medium">
            {article.source}
          </span>
          <span className="text-xs text-slate-600 flex items-center gap-1">
            <Clock size={10} />
            {timeAgo(article.publishedAt)}
          </span>
        </div>
      </div>

      {/* External link icon */}
      <ExternalLink size={14} className="text-slate-600 group-hover:text-slate-400
        transition shrink-0 mt-1" />
    </a>
  );
};

/* ─────────────────────────────────────────────────────────
   SKELETON LOADER
───────────────────────────────────────────────────────── */
const SkeletonCard = () => (
  <div className="flex gap-4 p-4 rounded-xl border border-white/8 bg-white/3 animate-pulse">
    <div className="w-[72px] h-[72px] shrink-0 rounded-lg bg-white/8" />
    <div className="flex-1 space-y-2">
      <div className="h-3.5 bg-white/8 rounded w-full" />
      <div className="h-3.5 bg-white/8 rounded w-4/5" />
      <div className="h-3 bg-white/8 rounded w-3/5 mt-1" />
      <div className="h-5 bg-white/8 rounded-full w-20 mt-2" />
    </div>
  </div>
);

/* ─────────────────────────────────────────────────────────
   POPULAR STOCK CHIPS
───────────────────────────────────────────────────────── */
const POPULAR = [
  { label: "AAPL",        symbol: "AAPL" },
  { label: "TSLA",        symbol: "TSLA" },
  { label: "NVDA",        symbol: "NVDA" },
  { label: "RELIANCE",    symbol: "RELIANCE.NS" },
  { label: "TCS",         symbol: "TCS.NS" },
  { label: "INFY",        symbol: "INFY.NS" },
  { label: "HDFCBANK",    symbol: "HDFCBANK.NS" },
  { label: "TATAMOTORS",  symbol: "TATAMOTORS.NS" },
];

/* ─────────────────────────────────────────────────────────
   MAIN PAGE
───────────────────────────────────────────────────────── */
const News = () => {
  useAuthGuard();
  const user = getUser();

  const [searchParams, setSearchParams] = useSearchParams();
  const initialSymbol = searchParams.get("symbol") || "";

  const [input,       setInput]       = useState(initialSymbol);
  const [symbol,      setSymbol]      = useState(initialSymbol);
  const [news,        setNews]        = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [refreshing,  setRefreshing]  = useState(false);
  const [error,       setError]       = useState(null);
  const [fetchedAt,   setFetchedAt]   = useState(null);

  /* ── Fetch news ── */
  const loadNews = useCallback(async (sym, force = false) => {
    if (!sym) return;
    force ? setRefreshing(true) : setLoading(true);
    setError(null);
    try {
      const endpoint = force ? `/news/fetch/${sym}` : `/news/${sym}`;
      const method   = force ? "post"                : "get";
      const data     = force
        ? await api.post(endpoint, {})
        : await api.get(endpoint);

      if (!data) return; // 401 → redirected
      setNews(data.articles || []);
      setFetchedAt(new Date().toISOString());
    } catch (err) {
      setError(err.message || "Failed to load news");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /* ── Auto load if symbol in URL ── */
  useEffect(() => {
    if (initialSymbol) loadNews(initialSymbol);
  }, []); // eslint-disable-line

  /* ── Search submit ── */
  const handleSearch = (sym) => {
    const s = (sym || input).toUpperCase().trim();
    if (!s) return;
    setSymbol(s);
    setSearchParams({ symbol: s });
    loadNews(s);
  };

  return (
    <div className="min-h-screen bg-[#0B0F14] text-white flex">

      {/* ── SIDEBAR ── */}
      <aside className="w-64 hidden md:flex flex-col border-r border-white/10 shrink-0">
        <div className="px-6 py-6 flex items-center gap-3 font-semibold text-lg">
          <div className="p-2 rounded-lg bg-blue-500/15">
            <BarChart3 className="text-blue-400" size={20} />
          </div>
          <div>
            StockAnalyzer
            <p className="text-xs text-slate-400 font-normal">AI-Powered Analysis</p>
          </div>
        </div>

        <nav className="flex-1 px-4 space-y-1 text-sm">
          <SidebarItem icon={<LayoutDashboard size={16} />} label="Dashboard"   to="/dashboard" />
          <SidebarItem icon={<Search size={16} />}          label="Analyze"     to="/analyze" />
          <SidebarItem icon={<GitCompare size={16} />}      label="Compare"     to="/compare" />
          <SidebarItem icon={<TrendingUp size={16} />}      label="Top Movers"  to="/movers" />
          <SidebarItem icon={<Newspaper size={16} />}       label="News"        to="/news" active />
          <SidebarItem icon={<History size={16} />}         label="History"     to="/history" />
        </nav>

        <div className="px-4 py-4 border-t border-white/10 text-sm">
          <p className="text-slate-400 text-xs truncate mb-1">{user?.email}</p>
          <p className="text-xs text-slate-500 mb-3">Free Plan</p>
          <button
            onClick={() => logout(true)}
            className="flex items-center gap-2 text-red-400 hover:text-red-300 transition text-sm"
          >
            <LogOut size={15} /> Sign Out
          </button>
        </div>
      </aside>

      {/* ── MAIN ── */}
      <main className="flex-1 p-6 md:p-8 overflow-y-auto min-w-0">

        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Newspaper className="text-purple-400" size={22} /> Stock News
          </h1>
          <p className="text-slate-400 text-sm mt-1">
            Latest news from Yahoo Finance, Finnhub & GNews
          </p>
        </div>

        {/* Search bar */}
        <div className="bg-[#0E141B] border border-white/10 rounded-2xl p-5 mb-6">
          <p className="text-sm font-medium text-white mb-3">Search stock news</p>
          <div className="flex gap-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. AAPL, RELIANCE.NS, TCS.NS"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm
                text-white placeholder:text-slate-600 focus:outline-none focus:border-blue-500/50 transition"
            />
            <button
              onClick={() => handleSearch()}
              disabled={loading || !input}
              className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 disabled:opacity-50
                rounded-xl text-sm font-medium flex items-center gap-2 transition"
            >
              {loading
                ? <RefreshCw size={14} className="animate-spin" />
                : <Search size={14} />}
              {loading ? "Loading" : "Search"}
            </button>
          </div>

          {/* Popular chips */}
          <div className="flex flex-wrap gap-2 mt-3">
            {POPULAR.map((p) => (
              <button
                key={p.symbol}
                onClick={() => { setInput(p.symbol); handleSearch(p.symbol); }}
                className="text-xs px-3 py-1 rounded-full bg-white/5 border border-white/10
                  text-slate-400 hover:text-white hover:bg-white/10 transition"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        {/* Results header */}
        {symbol && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h2 className="text-base font-semibold text-white flex items-center gap-2">
                <Newspaper size={16} className="text-purple-400" />
                {symbol}
                {news.length > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/15
                    text-purple-400 border border-purple-500/20 font-medium">
                    {news.length} articles
                  </span>
                )}
              </h2>
              {fetchedAt && !loading && (
                <span className="text-xs text-slate-600 flex items-center gap-1">
                  <Clock size={10} /> Updated {timeAgo(fetchedAt)}
                </span>
              )}
            </div>

            {symbol && !loading && (
              <button
                onClick={() => loadNews(symbol, true)}
                disabled={refreshing}
                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white
                  px-3 py-1.5 rounded-lg border border-white/10 hover:bg-white/5 transition"
              >
                <RefreshCw size={12} className={refreshing ? "animate-spin" : ""} />
                {refreshing ? "Fetching..." : "Refresh"}
              </button>
            )}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="space-y-3">
            {[...Array(5)].map((_, i) => <SkeletonCard key={i} />)}
          </div>
        )}

        {/* Error */}
        {error && !loading && (
          <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/8
            border border-red-500/20 text-red-400 text-sm mb-4">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
            <button
              onClick={() => loadNews(symbol)}
              className="ml-auto text-xs underline hover:no-underline"
            >
              Retry
            </button>
          </div>
        )}

        {/* News list */}
        {!loading && news.length > 0 && (
          <div className="space-y-3">
            {news.map((article, i) => (
              <NewsCard key={article.url || i} article={article} />
            ))}
          </div>
        )}

        {/* Empty state — no symbol */}
        {!loading && !symbol && (
          <div className="flex flex-col items-center justify-center py-24 text-slate-600">
            <Newspaper size={48} className="mb-4 opacity-20" />
            <p className="text-base font-medium text-slate-500">Search for a stock</p>
            <p className="text-sm text-slate-600 mt-1">
              Enter a symbol above to load latest news
            </p>
          </div>
        )}

        {/* Empty state — no articles */}
        {!loading && symbol && news.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-600">
            <Newspaper size={40} className="mb-4 opacity-20" />
            <p className="text-sm font-medium text-slate-500">No recent news found for {symbol}</p>
            <button
              onClick={() => loadNews(symbol, true)}
              className="mt-3 text-xs text-blue-400 hover:text-blue-300 underline transition"
            >
              Try fetching fresh news →
            </button>
          </div>
        )}
      </main>
    </div>
  );
};

export default News;