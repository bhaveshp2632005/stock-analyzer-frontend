/**
 * AIPrediction.jsx — Institutional AI Prediction Panel
 * ═══════════════════════════════════════════════════════
 * Full LSTM + XGBoost + FinBERT prediction engine UI.
 * Shows: price target · confidence · trend · regime · risk · sentiment
 */
import React, { useState, useCallback } from "react";
import {
  Brain, TrendingUp, TrendingDown, Activity, RefreshCw,
  Shield, AlertTriangle, Newspaper, ChevronDown, ChevronUp,
  Target, BarChart2, Zap,
} from "lucide-react";
import { api, ApiError } from "../utils/api.js";
import { useTheme }       from "../context/ThemeContext.jsx";
import { tokens }         from "../context/theme.js";

// ── helpers ──────────────────────────────────────────────────────────────────
const fmt = (v, decimals = 2) =>
  v == null ? "--" : Number(v).toLocaleString("en-US", {
    minimumFractionDigits: decimals, maximumFractionDigits: decimals,
  });

const fmtPct = (v) => v == null ? "--" : `${Number(v) >= 0 ? "+" : ""}${fmt(v)}%`;

const Badge = ({ label, color, bg, border }) => (
  <span style={{
    fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 20,
    letterSpacing: ".04em", textTransform: "uppercase",
    background: bg, border: `1px solid ${border}`, color,
  }}>
    {label}
  </span>
);

const trendColors = (trend) => ({
  Bullish:  { color: "#34d399", bg: "rgba(16,185,129,.12)", border: "rgba(16,185,129,.25)" },
  Bearish:  { color: "#f87171", bg: "rgba(239,68,68,.12)",  border: "rgba(239,68,68,.25)"  },
  Neutral:  { color: "#fbbf24", bg: "rgba(234,179,8,.12)",  border: "rgba(234,179,8,.25)"  },
})[trend] ?? { color: "#94a3b8", bg: "rgba(148,163,184,.1)", border: "rgba(148,163,184,.2)" };

const riskColors = {
  Low:      { color: "#34d399", bg: "rgba(16,185,129,.10)",  border: "rgba(16,185,129,.22)" },
  Medium:   { color: "#fbbf24", bg: "rgba(234,179,8,.10)",   border: "rgba(234,179,8,.22)"  },
  High:     { color: "#f87171", bg: "rgba(239,68,68,.10)",   border: "rgba(239,68,68,.22)"  },
  Critical: { color: "#ef4444", bg: "rgba(239,68,68,.15)",   border: "rgba(239,68,68,.35)"  },
};

const regimeColors = {
  Bull:     { color: "#34d399", bg: "rgba(16,185,129,.10)",  border: "rgba(16,185,129,.22)" },
  Bear:     { color: "#f87171", bg: "rgba(239,68,68,.10)",   border: "rgba(239,68,68,.22)"  },
  Sideways: { color: "#fbbf24", bg: "rgba(234,179,8,.10)",   border: "rgba(234,179,8,.22)"  },
};

const sentColors = {
  Positive: { color: "#34d399", bg: "rgba(16,185,129,.10)",  border: "rgba(16,185,129,.22)" },
  Negative: { color: "#f87171", bg: "rgba(239,68,68,.10)",   border: "rgba(239,68,68,.22)"  },
  Neutral:  { color: "#94a3b8", bg: "rgba(148,163,184,.08)", border: "rgba(148,163,184,.2)" },
};

// ── sub-components ────────────────────────────────────────────────────────────
const InfoRow = ({ label, value, valueStyle = {} }) => {
  const { theme } = useTheme();
  const t = tokens(theme);
  return (
    <div style={{ display: "flex", justifyContent: "space-between",
      alignItems: "center", padding: "6px 0",
      borderBottom: `1px solid ${t.border}` }}>
      <span style={{ fontSize: 11, color: t.textSecondary }}>{label}</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: t.textPrimary, ...valueStyle }}>
        {value}
      </span>
    </div>
  );
};

const ConfidenceBar = ({ value, color }) => (
  <div style={{ width: "100%", height: 6, borderRadius: 4,
    background: "rgba(255,255,255,.08)", overflow: "hidden", marginTop: 6 }}>
    <div style={{
      height: "100%", borderRadius: 4, background: color,
      width: `${Math.min(100, Math.max(0, value))}%`,
      transition: "width 1s ease",
      boxShadow: `0 0 8px ${color}60`,
    }}/>
  </div>
);

const Section = ({ title, icon, children, defaultOpen = true }) => {
  const { theme } = useTheme();
  const t = tokens(theme);
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ marginTop: 12 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ width: "100%", display: "flex", alignItems: "center",
          justifyContent: "space-between", background: "none",
          border: "none", cursor: "pointer", padding: "4px 0", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, color: t.textPrimary,
          display: "flex", alignItems: "center", gap: 6,
          textTransform: "uppercase", letterSpacing: ".06em" }}>
          {icon} {title}
        </span>
        {open
          ? <ChevronUp  size={12} style={{ color: t.textMuted }}/>
          : <ChevronDown size={12} style={{ color: t.textMuted }}/>}
      </button>
      {open && children}
    </div>
  );
};

// ── main component ────────────────────────────────────────────────────────────
const AIPrediction = ({ symbol }) => {
  const { isDark, theme } = useTheme();
  const t = tokens(theme);

  const [loading,  setLoading]  = useState(false);
  const [result,   setResult]   = useState(null);
  const [error,    setError]    = useState(null);
  const [horizon,  setHorizon]  = useState(5);

  const card = {
    background:           t.cardGradient,
    border:              `1px solid ${t.border}`,
    backdropFilter:       "blur(24px) saturate(1.4)",
    WebkitBackdropFilter: "blur(24px) saturate(1.4)",
    borderRadius:         18,
    padding:              20,
    boxShadow:           `${t.shadow}, inset 0 1px 0 ${t.glassEdge}`,
    transition:           "background .35s, border-color .3s",
  };

  const accentBtn = {
    background: t.gradient || "linear-gradient(135deg,#3b82f6,#6366f1)",
    border: "none", color: "#fff",
    boxShadow: `0 4px 14px ${t.glowPrimary || "rgba(59,130,246,0.3)"}`,
  };

  const runPrediction = useCallback(async () => {
    if (!symbol) return;
    setLoading(true);
    setError(null);
    try {
      const data = await api.post("/ai/predict", {
        symbol,
        horizon,
        skipSentiment:   false,
        includeRisk:     true,
        includeBacktest: false,
        includeChart:    false,
        lstmEpochs:      60,
      });
      if (data) setResult(data);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : (err.message || "Prediction failed"));
    } finally {
      setLoading(false);
    }
  }, [symbol, horizon]);

  const tc     = result ? trendColors(result.trend) : null;
  const regime = result?.marketRegime;
  const risk   = result?.risk;
  const sent   = result?.sentiment;
  const rc     = regime ? (regimeColors[regime.currentRegime] ?? regimeColors.Sideways) : null;
  const sc     = sent   ? (sentColors[sent.label]   ?? sentColors.Neutral)   : null;
  const riskC  = risk   ? (riskColors[risk.riskLevel] ?? riskColors.Medium)  : null;

  return (
    <div style={card}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <p style={{ margin: 0, fontSize: 13, fontWeight: 700,
          display: "flex", alignItems: "center", gap: 7, color: t.textPrimary }}>
          <Brain size={15} style={{ color: t.accentSecond || "#a78bfa" }}/>
          AI Prediction Engine
          <Badge label="LSTM · XGB · FinBERT"
            color={t.accentSecond || "#a78bfa"}
            bg="rgba(167,139,250,.1)" border="rgba(167,139,250,.2)"/>
        </p>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {/* Horizon selector */}
          <div style={{ display: "flex", gap: 3, background: t.inputBg,
            border: `1px solid ${t.border}`, borderRadius: 9, padding: 3 }}>
            {[3, 5, 10].map((h) => (
              <button key={h} onClick={() => setHorizon(h)}
                style={{ padding: "4px 10px", borderRadius: 7, fontSize: 11,
                  fontWeight: 600, cursor: "pointer", border: "none", transition: "all .2s",
                  background: horizon === h ? (t.gradient || "#3b82f6") : "transparent",
                  color: horizon === h ? "#fff" : t.textSecondary }}>
                {h}d
              </button>
            ))}
          </div>
          <button onClick={runPrediction} disabled={loading || !symbol}
            style={{ display: "flex", alignItems: "center", gap: 6,
              padding: "8px 16px", borderRadius: 10, fontSize: 12, fontWeight: 600,
              cursor: loading || !symbol ? "not-allowed" : "pointer",
              opacity: loading || !symbol ? .6 : 1, ...accentBtn, transition: "all .2s" }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.transform = "translateY(-1px)"; }}
            onMouseLeave={e => e.currentTarget.style.transform = "translateY(0)"}>
            {loading
              ? <><RefreshCw size={13} style={{ animation: "sa-spin 1s linear infinite" }}/> Predicting…</>
              : <><Zap size={13}/> Run Prediction</>}
          </button>
        </div>
      </div>

      {/* Error */}
      {error && !loading && (
        <div style={{ padding: "10px 14px", borderRadius: 10, marginBottom: 14,
          background: "rgba(239,68,68,.09)", border: "1px solid rgba(239,68,68,.22)" }}>
          <p style={{ margin: 0, fontSize: 12, color: "#fca5a5", fontWeight: 600 }}>
            Prediction failed
          </p>
          <p style={{ margin: "3px 0 6px", fontSize: 11, color: "rgba(252,165,165,.75)" }}>
            {error}
          </p>
          <button onClick={runPrediction} style={{ fontSize: 11, color: "#60a5fa",
            background: "none", border: "none", cursor: "pointer", padding: 0,
            textDecoration: "underline" }}>
            Retry
          </button>
        </div>
      )}

      {/* Empty state */}
      {!loading && !result && !error && (
        <div style={{ textAlign: "center", padding: "32px 0", color: t.textMuted }}>
          <Brain size={40} style={{ marginBottom: 12, opacity: .2, display: "block", margin: "0 auto 12px" }}/>
          <p style={{ fontSize: 12, margin: "0 0 4px", color: t.textSecondary }}>
            Click <strong style={{ color: t.accentSecond || "#a78bfa" }}>Run Prediction</strong> to start
          </p>
          <p style={{ fontSize: 11, margin: 0, color: t.textMuted }}>
            Trains LSTM + XGBoost ensemble — takes ~60s first run
          </p>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: "center", padding: "32px 0" }}>
          <Brain size={36} style={{ color: t.accentSecond || "#a78bfa", marginBottom: 12,
            display: "block", margin: "0 auto 12px",
            animation: "sa-pulse 1.5s ease-in-out infinite" }}/>
          <p style={{ fontSize: 12, color: t.textSecondary, margin: "0 0 6px" }}>
            Training ensemble models…
          </p>
          <p style={{ fontSize: 11, color: t.textMuted, margin: 0 }}>
            LSTM · GRU · TFT · XGBoost · LightGBM · FinBERT
          </p>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 14 }}>
            {["LSTM", "XGB", "FinBERT", "Meta"].map((m, i) => (
              <span key={m} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20,
                background: t.inputBg, border: `1px solid ${t.border}`,
                color: t.textMuted, animation: `sa-pulse 1.5s ${i * 0.3}s infinite` }}>
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Results */}
      {result && !loading && (
        <div>
          {/* Main prediction card */}
          <div style={{ borderRadius: 14, padding: "18px 16px", marginBottom: 14,
            background: tc?.bg, border: `1px solid ${tc?.border}`,
            display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>

            {/* Trend + price */}
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: t.textMuted }}>Trend</p>
              <p style={{ margin: 0, fontSize: 22, fontWeight: 800,
                color: tc?.color, fontFamily: "'Syne', sans-serif" }}>
                {result.trend === "Bullish" ? "▲" : result.trend === "Bearish" ? "▼" : "◆"}{" "}
                {result.trend}
              </p>
            </div>

            {/* Target price */}
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: t.textMuted }}>
                {horizon}d Target
              </p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: t.textPrimary }}>
                ${fmt(result.predictedPrice)}
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 11, fontWeight: 600, color: tc?.color }}>
                {fmtPct(result.predictedReturn)}
              </p>
            </div>

            {/* Confidence */}
            <div style={{ textAlign: "center" }}>
              <p style={{ margin: "0 0 4px", fontSize: 11, color: t.textMuted }}>Confidence</p>
              <p style={{ margin: 0, fontSize: 20, fontWeight: 800, color: tc?.color }}>
                {fmt(result.confidence, 0)}%
              </p>
              <ConfidenceBar value={result.confidence} color={tc?.color}/>
            </div>
          </div>

          {/* Price range */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 12 }}>
            <div style={{ background: t.inputBg, border: `1px solid ${t.border}`,
              borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 10, color: t.textMuted, textTransform: "uppercase",
                letterSpacing: ".05em" }}>Price Low</p>
              <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700,
                color: "#f87171" }}>${fmt(result.priceRange?.low)}</p>
            </div>
            <div style={{ background: t.inputBg, border: `1px solid ${t.border}`,
              borderRadius: 10, padding: "10px 12px", textAlign: "center" }}>
              <p style={{ margin: 0, fontSize: 10, color: t.textMuted, textTransform: "uppercase",
                letterSpacing: ".05em" }}>Price High</p>
              <p style={{ margin: "4px 0 0", fontSize: 14, fontWeight: 700,
                color: "#34d399" }}>${fmt(result.priceRange?.high)}</p>
            </div>
          </div>

          {/* Regime + Sentiment row */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 14 }}>
            {regime && rc && (
              <div style={{ flex: "1 1 140px", background: rc.bg,
                border: `1px solid ${rc.border}`, borderRadius: 10, padding: "10px 12px" }}>
                <p style={{ margin: "0 0 4px", fontSize: 10, color: t.textMuted,
                  textTransform: "uppercase", letterSpacing: ".05em" }}>Market Regime</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: rc.color }}>
                  {regime.currentRegime}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: t.textMuted }}>
                  {fmt(regime.probability, 1)}% confidence
                </p>
              </div>
            )}
            {sent && sc && (
              <div style={{ flex: "1 1 140px", background: sc.bg,
                border: `1px solid ${sc.border}`, borderRadius: 10, padding: "10px 12px" }}>
                <p style={{ margin: "0 0 4px", fontSize: 10, color: t.textMuted,
                  textTransform: "uppercase", letterSpacing: ".05em" }}>Sentiment</p>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: sc.color }}>
                  {sent.label}
                </p>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: t.textMuted }}>
                  {sent.article_count} articles · {fmt(sent.confidence, 1)}% conf
                </p>
              </div>
            )}
          </div>

          {/* Risk section */}
          {risk && riskC && (
            <Section title="Risk Assessment"
              icon={<Shield size={11} style={{ color: riskC.color }}/>}>
              <div style={{ background: t.inputBg, border: `1px solid ${t.border}`,
                borderRadius: 10, padding: "12px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between",
                  alignItems: "center", marginBottom: 10 }}>
                  <Badge label={`${risk.riskLevel} Risk`}
                    color={riskC.color} bg={riskC.bg} border={riskC.border}/>
                  <span style={{ fontSize: 11, color: t.textMuted }}>
                    Score: {fmt(risk.riskScore, 1)}%
                  </span>
                </div>
                <InfoRow label="Suggested Position" value={`${fmt(risk.suggestedPosition, 1)}%`}
                  valueStyle={{ color: tc?.color }}/>
                <InfoRow label="Stop Loss"
                  value={`$${fmt(risk.stopLossPrice)} (${fmt(risk.stopLossPct)}%)`}
                  valueStyle={{ color: "#f87171" }}/>
                <InfoRow label="Take Profit"
                  value={`$${fmt(risk.takeProfitPrice)} (${fmt(risk.takeProfitPct)}%)`}
                  valueStyle={{ color: "#34d399" }}/>
                <InfoRow label="VaR (95%)" value={`${fmt(risk.var95)}%`}/>
                <InfoRow label="Max Drawdown" value={`${fmt(risk.maxDrawdown)}%`}
                  valueStyle={{ color: "#f87171" }}/>
                {risk.notes && (
                  <p style={{ margin: "8px 0 0", fontSize: 10, color: t.textMuted,
                    lineHeight: 1.6 }}>{risk.notes}</p>
                )}
              </div>
            </Section>
          )}

          {/* Model metrics */}
          {result.modelMetrics && (
            <Section title="Model Metrics"
              icon={<BarChart2 size={11} style={{ color: t.textMuted }}/>}
              defaultOpen={false}>
              <div style={{ background: t.inputBg, border: `1px solid ${t.border}`,
                borderRadius: 10, padding: "12px 14px" }}>
                <InfoRow label="RMSE"  value={fmt(result.modelMetrics.rmse, 5)}/>
                <InfoRow label="MAE"   value={fmt(result.modelMetrics.mae, 5)}/>
                <InfoRow label="MAPE"  value={`${fmt(result.modelMetrics.mape, 2)}%`}/>
                <InfoRow label="Directional Accuracy"
                  value={`${fmt(result.modelMetrics.directional_accuracy, 1)}%`}
                  valueStyle={{ color: "#34d399" }}/>
                <InfoRow label="Features used" value={result.featureCount ?? "--"}/>
              </div>
            </Section>
          )}

          {/* Meta */}
          {result.meta && (
            <div style={{ marginTop: 10, padding: "8px 12px",
              background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 8,
              display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
              <span style={{ fontSize: 10, color: t.textMuted }}>
                {result.meta.companyName}
                {result.meta.sector && ` · ${result.meta.sector}`}
              </span>
              <span style={{ fontSize: 10, color: t.textMuted }}>
                {result.meta.dataPoints} bars · {result.meta.latestDate} · {result.meta.computeTime}s
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default AIPrediction;