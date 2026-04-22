import React, { useState, useCallback } from "react";
import {
  Cpu, TrendingUp, TrendingDown, RefreshCw,
  AlertTriangle, BarChart2, Target, Shield, Zap, Play,
} from "lucide-react";
import AppShell     from "../components/AppShell.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { tokens }   from "../context/theme.js";
import { api }      from "../utils/api.js";
import useAuthGuard from "../hooks/useAuthGuard.js";

const QUICK = ["AAPL", "TSLA", "NVDA", "RELIANCE.NS", "TCS.NS", "MSFT"];

/* ── Mini sparkline from portfolio_history array ── */
const Sparkline = ({ data, color, width = 280, height = 56 }) => {
  if (!data || data.length < 2) return null;
  const min  = Math.min(...data);
  const max  = Math.max(...data);
  const rng  = max - min || 1;
  const xs   = data.map((_, i) => (i / (data.length - 1)) * width);
  const ys   = data.map(v => height - ((v - min) / rng) * (height - 8) - 4);
  const pts  = xs.map((x, i) => `${x},${ys[i]}`).join(" ");
  const area = `M ${xs[0]},${height} L ${pts.replace(/(\d+\.?\d*),/g, (_, x) => `${x},`)} L ${xs[xs.length-1]},${height} Z`;

  return (
    <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id="rl-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity=".28" />
          <stop offset="100%" stopColor={color} stopOpacity=".02" />
        </linearGradient>
      </defs>
      <path d={`M ${area}`} fill="url(#rl-grad)" />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2"
        strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
};

const StatBox = ({ label, value, color = "#3b82f6", sub, t }) => (
  <div style={{ padding: "12px 14px", borderRadius: 13,
    background: `${color}0c`, border: `1px solid ${color}1e` }}>
    <p style={{ margin: 0, fontSize: 10, color: t.textMuted }}>{label}</p>
    <p style={{ margin: "3px 0 0", fontSize: 17, fontWeight: 800, color }}>{value}</p>
    {sub && <p style={{ margin: "2px 0 0", fontSize: 10, color: t.textMuted }}>{sub}</p>}
  </div>
);

const Row = ({ label, value, color, t }) => (
  <div style={{ display: "flex", justifyContent: "space-between", padding: "8px 0",
    borderBottom: `1px solid ${t.border}` }}>
    <span style={{ fontSize: 12, color: t.textMuted }}>{label}</span>
    <span style={{ fontSize: 13, fontWeight: 700, color: color || t.textPrimary }}>{value}</span>
  </div>
);

/* ════════════════════════════════════════════════════════════ */

const RLAgent = () => {
  useAuthGuard();
  const { isDark } = useTheme();
  const t = tokens(isDark);

  const [symbol,     setSymbol]     = useState("");
  const [algorithm,  setAlgorithm]  = useState("PPO");
  const [timesteps,  setTimesteps]  = useState(30000);
  const [result,     setResult]     = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [phase,      setPhase]      = useState("");   // "training" | "evaluating"
  const [error,      setError]      = useState("");

  const train = useCallback(async (sym = symbol) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    setLoading(true); setError(""); setResult(null);
    setPhase("training");
    try {
      const res = await api.post("/ai/rl/train", {
        symbol: s, algorithm, total_timesteps: timesteps,
      });
      if (!res || res.error) throw new Error(res?.error || "Training failed");
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setPhase("");
    }
  }, [symbol, algorithm, timesteps]);

  const evaluate = useCallback(async (sym = symbol) => {
    const s = sym.trim().toUpperCase();
    if (!s) return;
    setLoading(true); setError(""); setResult(null);
    setPhase("evaluating");
    try {
      const res = await api.get(`/ai/rl/evaluate/${s}?algorithm=${algorithm}`);
      if (!res || res.error) throw new Error(res?.error || "Evaluation failed");
      setResult(res);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
      setPhase("");
    }
  }, [symbol, algorithm]);

  const ret     = result?.totalReturn;
  const bhr     = result?.buyHoldReturn;
  const retClr  = ret != null ? (ret >= 0 ? "#10b981" : "#f87171") : "#3b82f6";
  const vsClr   = ret != null && bhr != null
    ? (ret > bhr ? "#10b981" : "#f87171") : t.textMuted;

  return (
    <AppShell activePage="/rl">
      {/* HEADER */}
      <div className="flex-row slideUp"
        style={{ justifyContent: "space-between", marginBottom: 22, flexWrap: "wrap", gap: 12 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: "clamp(18px,4vw,24px)", fontWeight: 800,
            letterSpacing: "-.04em", display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ background: "linear-gradient(135deg,#06b6d4,#8b5cf6)",
              WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
              🤖 RL Trading Agent
            </span>
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: t.textMuted }}>
            PPO / A2C reinforcement learning · Custom Gym environment · RSI + MA50 + ATR features
          </p>
        </div>
      </div>

      {/* CONTROLS */}
      <div className="slideUp1" style={{ marginBottom: 16 }}>
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginBottom: 10 }}>
          {/* Symbol */}
          <input value={symbol} placeholder="Symbol  e.g. TSLA"
            onChange={e => setSymbol(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === "Enter" && train()}
            style={{ flex: 1, minWidth: 160, padding: "9px 13px", borderRadius: 11,
              background: t.inputBg, border: `1px solid ${t.border}`,
              color: t.textPrimary, fontSize: 13, outline: "none" }}
          />
          {/* Algorithm */}
          <select value={algorithm} onChange={e => setAlgorithm(e.target.value)} style={{
            padding: "9px 12px", borderRadius: 11, fontSize: 12,
            background: t.inputBg, border: `1px solid ${t.border}`,
            color: t.textPrimary, outline: "none", cursor: "pointer",
          }}>
            <option value="PPO">PPO (Stable)</option>
            <option value="A2C">A2C (Fast)</option>
          </select>
          {/* Timesteps */}
          <select value={timesteps} onChange={e => setTimesteps(+e.target.value)} style={{
            padding: "9px 12px", borderRadius: 11, fontSize: 12,
            background: t.inputBg, border: `1px solid ${t.border}`,
            color: t.textPrimary, outline: "none", cursor: "pointer",
          }}>
            <option value={10000}>10k steps (quick)</option>
            <option value={30000}>30k steps (default)</option>
            <option value={50000}>50k steps (thorough)</option>
          </select>
        </div>

        {/* Quick picks */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 10 }}>
          {QUICK.map(s => (
            <button key={s} onClick={() => setSymbol(s)} style={{
              padding: "3px 10px", borderRadius: 7, fontSize: 11, fontWeight: 600,
              background: symbol === s ? "rgba(6,182,212,.16)" : t.inputBg,
              border: `1px solid ${symbol === s ? "rgba(6,182,212,.3)" : t.border}`,
              color: symbol === s ? "#06b6d4" : t.textSecondary, cursor: "pointer",
            }}>{s}</button>
          ))}
        </div>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
          <button onClick={() => train()} disabled={loading || !symbol.trim()} style={{
            padding: "10px 22px", borderRadius: 11, fontSize: 13, fontWeight: 600,
            background: "linear-gradient(135deg,#06b6d4,#8b5cf6)", border: "none",
            color: "#fff", cursor: "pointer",
            opacity: loading || !symbol.trim() ? .6 : 1,
            display: "flex", alignItems: "center", gap: 7,
            boxShadow: "0 4px 14px rgba(6,182,212,.3)",
          }}>
            {loading && phase === "training"
              ? <><RefreshCw size={13} style={{ animation: "sa-spin 1s linear infinite" }} /> Training…</>
              : <><Cpu size={13} /> Train Agent</>}
          </button>
          <button onClick={() => evaluate()} disabled={loading || !symbol.trim()} style={{
            padding: "10px 20px", borderRadius: 11, fontSize: 13, fontWeight: 600,
            background: t.inputBg, border: `1px solid ${t.border}`,
            color: t.textSecondary, cursor: "pointer",
            opacity: loading || !symbol.trim() ? .6 : 1,
            display: "flex", alignItems: "center", gap: 7,
          }}>
            {loading && phase === "evaluating"
              ? <><RefreshCw size={13} style={{ animation: "sa-spin 1s linear infinite" }} /> Evaluating…</>
              : <><Play size={13} /> Evaluate Only</>}
          </button>
        </div>
      </div>

      {/* How it works */}
      <div style={{ borderRadius: 13, padding: "11px 15px", marginBottom: 16,
        background: "rgba(6,182,212,.07)", border: "1px solid rgba(6,182,212,.18)" }}>
        <p style={{ margin: 0, fontSize: 11, color: t.textSecondary, lineHeight: 1.5 }}>
          <strong style={{ color: "#06b6d4" }}>How it works:</strong> The agent learns to
          HOLD / BUY / SELL based on 19 technical features + portfolio state.
          Training uses a custom Gym env with AdamW optimiser.
          Evaluation runs the trained policy on the full price history and
          compares against buy-and-hold. If no trained model exists, a rule-based
          RSI fallback is used.
        </p>
      </div>

      {/* ERROR */}
      {error && (
        <div style={{ display: "flex", gap: 10, padding: "12px 16px", borderRadius: 12,
          marginBottom: 14, background: "rgba(239,68,68,.09)",
          border: "1px solid rgba(239,68,68,.25)" }}>
          <AlertTriangle size={14} style={{ color: "#f87171", flexShrink: 0, marginTop: 1 }} />
          <p style={{ margin: 0, fontSize: 13, color: "#fca5a5" }}>{error}</p>
        </div>
      )}

      {/* LOADING */}
      {loading && (
        <div style={{ animation: "sa-pulse 1.5s ease infinite" }}>
          {[100, 70, 70, 50].map((h, i) => (
            <div key={i} style={{ height: h, borderRadius: 14, background: t.inputBg,
              marginBottom: 10, opacity: 1 - i * 0.2 }} />
          ))}
          <p style={{ textAlign: "center", fontSize: 12, color: t.textMuted, marginTop: 8 }}>
            {phase === "training"
              ? `Training ${algorithm} agent for ${(timesteps / 1000).toFixed(0)}k steps… ☕ grab a coffee`
              : "Loading saved model and evaluating…"}
          </p>
        </div>
      )}

      {/* RESULT */}
      {result && !loading && (
        <div style={{ animation: "sa-slideUp .4s ease both" }}>

          {/* Header card */}
          <div style={{ borderRadius: 20, padding: "20px 22px", marginBottom: 14,
            background: isDark
              ? `linear-gradient(135deg,${retClr}10,rgba(255,255,255,.03))`
              : `linear-gradient(135deg,${retClr}07,rgba(255,255,255,.9))`,
            border: `1px solid ${retClr}25`,
            backdropFilter: "blur(20px)", boxShadow: t.shadow }}>
            <div className="flex-row" style={{ justifyContent: "space-between",
              flexWrap: "wrap", gap: 12, marginBottom: 14 }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 5 }}>
                  <span style={{ fontSize: 18, fontWeight: 800, color: t.textPrimary }}>
                    {result.symbol}
                  </span>
                  <span style={{ fontSize: 11, padding: "2px 9px", borderRadius: 20,
                    background: "rgba(6,182,212,.15)", color: "#06b6d4", fontWeight: 700,
                    border: "1px solid rgba(6,182,212,.25)" }}>
                    {result.algorithm || algorithm}
                  </span>
                  {result.loaded === false && (
                    <span style={{ fontSize: 10, padding: "2px 8px", borderRadius: 20,
                      background: "rgba(245,158,11,.14)", color: "#f59e0b",
                      border: "1px solid rgba(245,158,11,.22)", fontWeight: 600 }}>
                      rule-based fallback
                    </span>
                  )}
                </div>
                <p style={{ margin: 0, fontSize: 12, color: t.textMuted }}>
                  {result.totalTrades} trades · {timesteps.toLocaleString()} training steps
                </p>
              </div>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: "0 0 2px", fontSize: 11, color: t.textMuted }}>RL Return vs Buy & Hold</p>
                <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                  <span style={{ fontSize: 24, fontWeight: 800, color: retClr }}>
                    {ret >= 0 ? "+" : ""}{ret?.toFixed(2)}%
                  </span>
                  <span style={{ fontSize: 12, color: t.textMuted }}>vs</span>
                  <span style={{ fontSize: 18, fontWeight: 700, color: vsClr }}>
                    {bhr >= 0 ? "+" : ""}{bhr?.toFixed(2)}%
                  </span>
                </div>
                <p style={{ margin: "3px 0 0", fontSize: 10,
                  color: ret > bhr ? "#10b981" : "#f87171", fontWeight: 600 }}>
                  {ret > bhr ? "✅ Beat buy & hold" : "⚠️ Underperformed buy & hold"}
                </p>
              </div>
            </div>

            {/* Sparkline */}
            {result.portfolioHistory?.length > 2 && (
              <Sparkline data={result.portfolioHistory} color={retClr} height={52} />
            )}
          </div>

          {/* Stats grid */}
          <div className="g3" style={{ marginBottom: 14 }}>
            <StatBox label="Total Return"   value={`${ret >= 0 ? "+" : ""}${ret?.toFixed(2)}%`} color={retClr} t={t} />
            <StatBox label="Sharpe Ratio"   value={result.sharpeRatio?.toFixed(3)} color="#3b82f6"
              sub={result.sharpeRatio > 1 ? "Good" : result.sharpeRatio > 0 ? "OK" : "Poor"} t={t} />
            <StatBox label="Max Drawdown"   value={`${result.maxDrawdown?.toFixed(2)}%`} color="#f87171" t={t} />
            <StatBox label="Win Rate"       value={`${result.winRate?.toFixed(1)}%`} color="#f59e0b" t={t} />
            <StatBox label="Total Trades"   value={result.totalTrades} color="#8b5cf6" t={t} />
            <StatBox label="Final Portfolio" value={`$${result.finalPortfolio?.toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
              color="#06b6d4" sub="started at $100,000" t={t} />
          </div>

          {/* Comparison table */}
          <div style={{ borderRadius: 16, padding: "16px 18px",
            background: t.cardBg, border: `1px solid ${t.border}`,
            backdropFilter: "blur(20px)" }}>
            <p style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700,
              color: t.textPrimary, display: "flex", alignItems: "center", gap: 6 }}>
              <BarChart2 size={13} style={{ color: "#06b6d4" }} /> Strategy Comparison
            </p>
            <Row label="RL Agent Return" value={`${ret >= 0 ? "+" : ""}${ret?.toFixed(2)}%`}
              color={retClr} t={t} />
            <Row label="Buy & Hold Return" value={`${bhr >= 0 ? "+" : ""}${bhr?.toFixed(2)}%`}
              color={vsClr} t={t} />
            <Row label="Alpha (RL − B&H)"
              value={`${(ret - bhr) >= 0 ? "+" : ""}${(ret - bhr)?.toFixed(2)}%`}
              color={(ret - bhr) >= 0 ? "#10b981" : "#f87171"} t={t} />
            <Row label="Sharpe Ratio"  value={result.sharpeRatio?.toFixed(3)}  t={t} />
            <Row label="Max Drawdown"  value={`${result.maxDrawdown?.toFixed(2)}%`}  color="#f87171" t={t} />
            <Row label="Win Rate"      value={`${result.winRate?.toFixed(1)}%`}  color="#f59e0b" t={t} />
            <Row label="Total Trades"  value={result.totalTrades}  t={t} />
            <Row label="Algorithm"     value={result.algorithm || algorithm}  color="#8b5cf6" t={t} />
          </div>
        </div>
      )}

      {/* EMPTY */}
      {!result && !loading && !error && (
        <div style={{ textAlign: "center", padding: "55px 20px", color: t.textMuted }}>
          <Cpu size={48} style={{ opacity: .18, margin: "0 auto 16px", display: "block" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: t.textSecondary, margin: "0 0 6px" }}>
            Select a symbol and train or evaluate the RL agent
          </p>
          <p style={{ fontSize: 12, margin: 0 }}>
            PPO / A2C · Custom Gym env · 19 features · HOLD/BUY/SELL actions
          </p>
        </div>
      )}
    </AppShell>
  );
};

export default RLAgent;