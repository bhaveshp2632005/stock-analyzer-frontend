/**
 * AITradingDashboard.jsx — with AppShell sidebar + theme system
 * Matches History.jsx patterns: AppShell, useTheme, tokens, useAuthGuard, api
 */

import React, { useState, useEffect, useCallback, useMemo } from "react";
import AppShell       from "./AppShell.jsx";
import { useTheme }   from "../context/ThemeContext.jsx";
import { tokens }     from "../context/theme.js";
import { api }        from "../utils/api.js";
import useAuthGuard   from "../hooks/useAuthGuard.js";
import {
  Brain, Shield, BarChart2, RefreshCw, AlertCircle, Activity,
  PieChart, Search, TrendingUp, TrendingDown, BookOpen, X,
  Zap, HelpCircle, ArrowUpRight, ArrowDownRight, Minus,
  Plus, Trash2,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTip, ResponsiveContainer,
  PieChart as RPie, Pie, Cell, Legend, ReferenceLine,
} from "recharts";

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
const isINR  = s  => /\.(NS|BO)$/i.test(s || "");
const f2     = n  => (n == null || isNaN(Number(n))) ? "—" : Number(n).toFixed(2);
const fp     = n  => (n == null || isNaN(Number(n))) ? "—" : `${Number(n) > 0 ? "+" : ""}${f2(n)}%`;
const fC     = (c, p) => {
  if (p == null || isNaN(Number(p))) return "—";
  return c === "INR"
    ? `₹${Number(p).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `$${Number(p).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
};
const pct100 = v => (v != null && Number(v) <= 1 && Number(v) >= -1) ? Number(v) * 100 : Number(v) || 0;

const trendCol = (t, trend) =>
  trend === "Bullish" ? t.green  :
  trend === "Bearish" ? t.red    : t.yellow;

const regimeCol = (t, r) =>
  (r === "Bull" || r === "Trending Up")   ? t.green :
  (r === "Bear" || r === "Trending Down") ? t.red   : t.yellow;

const riskLevelCol = (t, l) =>
  l === "Low"                        ? t.green :
  (l === "High" || l === "Critical") ? t.red   : t.yellow;

const signalCol = (t, s) =>
  s === "BUY"  ? t.green :
  s === "SELL" ? t.red   : t.yellow;

const buildCurve = bt => {
  if (!bt) return [];
  const total = Number(bt.totalReturn) || 0;
  const bh    = Number(bt.buyHoldReturn) || 0;
  return Array.from({ length: 30 }, (_, i) => {
    const p = i / 29, n = (Math.random() - .5) * 2;
    return {
      day:      `D${i * 4}`,
      strategy: +(100 * (1 + total / 100 * p) + n).toFixed(2),
      buyhold:  +(100 * (1 + bh    / 100 * p) + n * .4).toFixed(2),
    };
  });
};

const TIPS = {
  sharpe:     "Sharpe Ratio: risk-adjusted return. >1 = good, >2 = excellent.",
  maxdd:      "Max Drawdown: largest peak-to-trough loss. Lower is better.",
  winrate:    "Win Rate: % of trades that were profitable.",
  volatility: "Annualised price volatility. Higher = more risk.",
  var:        "VaR 95%: max expected 1-day loss with 95% confidence.",
  cvar:       "CVaR: expected loss when VaR threshold is breached.",
  confidence: "How strongly the ensemble model agrees.",
  alpha:      "Excess return over buy-and-hold. Positive = strategy wins.",
};

/* ═══════════════════════════════════════════════════════
   THEMED MICRO-COMPONENTS
═══════════════════════════════════════════════════════ */

const GlassCard = ({ children, style = {}, t }) => (
  <div style={{
    background:           t.cardGradient,
    border:               `1px solid ${t.border}`,
    borderRadius:         18,
    backdropFilter:       "blur(24px) saturate(1.5)",
    WebkitBackdropFilter: "blur(24px) saturate(1.5)",
    boxShadow:            `${t.shadow}, inset 0 1px 0 ${t.glassEdge}`,
    padding:              22,
    transition:           "background .35s, border-color .3s",
    ...style,
  }}>{children}</div>
);

const Tip = ({ text, children, t }) => {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: "relative", display: "inline-flex", alignItems: "center", gap: 3 }}
      onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      {show && text && (
        <div style={{
          position: "absolute", bottom: "calc(100% + 8px)", left: "50%",
          transform: "translateX(-50%)", zIndex: 9999,
          background: t.modalBg || t.cardBg,
          border: `1px solid ${t.border}`,
          borderRadius: 10, padding: "9px 13px", fontSize: 11.5,
          color: t.textPrimary, maxWidth: 230, lineHeight: 1.6,
          boxShadow: "0 16px 40px rgba(0,0,0,.7)",
          whiteSpace: "normal", pointerEvents: "none", minWidth: 160,
        }}>{text}</div>
      )}
    </span>
  );
};

const Lbl = ({ text, t }) => (
  <p style={{
    margin: 0, fontSize: 9.5, color: t.textMuted,
    textTransform: "uppercase", letterSpacing: "0.09em",
    fontWeight: 700, fontFamily: "monospace",
  }}>{text}</p>
);

const Badge = ({ text, color }) => (
  <span style={{
    display: "inline-flex", alignItems: "center", padding: "4px 11px",
    borderRadius: 999, background: `${color}18`,
    border: `1px solid ${color}45`,
    color, fontSize: 12, fontWeight: 700, letterSpacing: "0.03em",
  }}>{text}</span>
);

const PBar = ({ value, max = 100, color, h = 5, t }) => (
  <div style={{ height: h, background: t.inputBg, borderRadius: 999, overflow: "hidden", flex: 1 }}>
    <div style={{
      height: "100%", borderRadius: 999,
      width: `${Math.min(Math.max(isNaN(value) ? 0 : (value / max) * 100, 0), 100)}%`,
      background: `linear-gradient(90deg,${color}80,${color})`,
      transition: "width 1.1s cubic-bezier(.22,1,.36,1)",
    }} />
  </div>
);

const Tile = ({ label, value, color, sub, tip, t, style = {} }) => (
  <div style={{
    background: t.inputBg, border: `1px solid ${t.border}`,
    borderRadius: 13, padding: "14px 16px", ...style,
  }}>
    <Tip text={tip} t={t}>
      <div style={{ display: "flex", alignItems: "center", gap: 4, marginBottom: 6 }}>
        <Lbl text={label} t={t} />
        {tip && <HelpCircle size={9} color={t.textMuted} />}
      </div>
    </Tip>
    <p style={{
      margin: 0, fontSize: 21, fontWeight: 800,
      color: color || t.textPrimary,
      fontFamily: "monospace", letterSpacing: "-0.02em",
    }}>{value}</p>
    {sub && <p style={{ margin: "3px 0 0", fontSize: 10, color: t.textMuted }}>{sub}</p>}
  </div>
);

const DRow = ({ label, value, color, tip, t }) => (
  <div style={{
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "7px 0", borderBottom: `1px solid ${t.border}`, fontSize: 12.5,
  }}>
    <Tip text={tip} t={t}>
      <span style={{ color: t.textSecondary, display: "flex", alignItems: "center", gap: 4 }}>
        {label}{tip && <HelpCircle size={9} color={t.textMuted} />}
      </span>
    </Tip>
    <span style={{ color: color || t.textPrimary, fontWeight: 700, fontFamily: "monospace" }}>{value}</span>
  </div>
);

const CT = ({ active, payload, label, t }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: t.modalBg || t.cardBg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "9px 13px", fontSize: 12 }}>
      <p style={{ margin: "0 0 5px", color: t.textMuted, fontWeight: 600 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ margin: "2px 0", color: p.color || t.textPrimary, fontWeight: 700 }}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const SignalBox = ({ signal, confidence, t }) => {
  const c    = signalCol(t, signal);
  const Icon = signal === "BUY" ? ArrowUpRight : signal === "SELL" ? ArrowDownRight : Minus;
  return (
    <div style={{ textAlign: "center", padding: "20px 22px", borderRadius: 16, background: `${c}10`, border: `1px solid ${c}30`, boxShadow: `0 0 40px ${c}10` }}>
      <div style={{ width: 52, height: 52, borderRadius: "50%", margin: "0 auto 10px", background: `${c}18`, border: `1px solid ${c}35`, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <Icon size={24} color={c} />
      </div>
      <p style={{ margin: "0 0 4px", fontSize: 36, fontWeight: 900, color: c, fontFamily: "monospace", letterSpacing: "-0.04em", textShadow: `0 0 40px ${c}50` }}>
        {signal || "—"}
      </p>
      <Tip text={TIPS.confidence} t={t}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, justifyContent: "center", marginTop: 10, width: "100%" }}>
          <span style={{ fontSize: 11, color: t.textMuted, display: "flex", alignItems: "center", gap: 3, flexShrink: 0 }}>
            <HelpCircle size={9} /> Conf.
          </span>
          <PBar value={confidence || 0} color={c} h={4} t={t} />
          <span style={{ fontSize: 12, fontWeight: 800, color: c, fontFamily: "monospace", minWidth: 40 }}>{f2(confidence)}%</span>
        </div>
      </Tip>
    </div>
  );
};

const SentGauge = ({ score, t }) => {
  const norm = ((Number(score || 0) + 1) / 2) * 100;
  const arc  = (norm / 100) * 220;
  const col  = score > 0.1 ? t.green : score < -0.1 ? t.red : t.yellow;
  const r = 60, cx = 90, cy = 85;
  const toXY = deg => {
    const rad = (deg - 200) * (Math.PI / 180);
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
  };
  const p1 = toXY(0), p2 = toXY(Math.max(arc, 2)), large = arc > 180 ? 1 : 0;
  return (
    <div style={{ textAlign: "center" }}>
      <svg width={180} height={110} viewBox="0 0 180 105">
        <path d={`M ${toXY(0).x} ${toXY(0).y} A ${r} ${r} 0 1 1 ${toXY(220).x} ${toXY(220).y}`}
          fill="none" stroke={t.inputBg} strokeWidth={11} strokeLinecap="round" />
        {arc > 2 && (
          <path d={`M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`}
            fill="none" stroke={col} strokeWidth={11} strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 6px ${col}80)` }} />
        )}
        <text x={cx} y={80} fontSize={22} fontWeight={800} fill={col} textAnchor="middle" fontFamily="monospace">
          {Number(score || 0).toFixed(3)}
        </text>
        <text x={18}  y={103} fontSize={9} fill={t.red}    textAnchor="middle">−1</text>
        <text x={cx}  y={18}  fontSize={9} fill={t.yellow} textAnchor="middle">0</text>
        <text x={162} y={103} fontSize={9} fill={t.green}  textAnchor="middle">+1</text>
      </svg>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   GUIDE
═══════════════════════════════════════════════════════ */
const Guide = ({ t }) => {
  const [open, setOpen] = useState(true);
  const steps = [
    "Enter a stock ticker (TSLA, AAPL, RELIANCE.NS)",
    "Choose prediction horizon from dropdown",
    "Click Analyze — trains model",
    "Review BUY/SELL/HOLD signal in Overview tab",
    "Check Risk tab for stop-loss & position sizing",
    "See Backtest to validate strategy performance",
    "Use Portfolio tab for MPT optimal allocation",
  ];
  if (!open) return (
    <button onClick={() => setOpen(true)} style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 18, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 10, padding: "8px 14px", cursor: "pointer", color: t.accentPrimary, fontSize: 12, fontWeight: 600 }}>
      <BookOpen size={13} /> Show Quick Start Guide
    </button>
  );
  return (
    <GlassCard t={t} style={{ marginBottom: 20, padding: "18px 22px", background: `${t.accentPrimary}08`, border: `1px solid ${t.accentPrimary}25` }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 30, height: 30, borderRadius: 9, background: t.gradient, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <BookOpen size={14} color="#fff" />
          </div>
          <p style={{ margin: 0, fontSize: 13, fontWeight: 700, color: t.textPrimary }}>HOW TO USE</p>
          <Badge text="Quick Start" color={t.accentPrimary} />
        </div>
        <button onClick={() => setOpen(false)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}>
          <X size={14} />
        </button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(220px,1fr))", gap: 10 }}>
        {steps.map((s, i) => (
          <div key={i} style={{ display: "flex", gap: 10, padding: "10px 12px", borderRadius: 11, background: t.inputBg, border: `1px solid ${t.border}` }}>
            <span style={{ flexShrink: 0, width: 21, height: 21, borderRadius: "50%", background: t.gradient, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 900, color: "#fff" }}>{i + 1}</span>
            <p style={{ margin: 0, fontSize: 12, color: t.textSecondary, lineHeight: 1.55 }}>{s}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
};

/* ═══════════════════════════════════════════════════════
   TAB: OVERVIEW
═══════════════════════════════════════════════════════ */
const OverviewTab = ({ data, t }) => {
  const cur        = data.currency || "USD";
  const signal     = data.trend === "Bullish" ? "BUY" : data.trend === "Bearish" ? "SELL" : "HOLD";
  const tc         = trendCol(t, data.trend);
  const regime     = data.marketRegime || {};
  const regimeName = regime.currentRegime || regime.regime || "—";
  const regimeProb = pct100(regime.probability);
  const rc         = regimeCol(t, regimeName);
  const acc        = t.accentPrimary || "#4F9DFF";
  const acc2       = t.accentSecond  || "#A78BFA";

  const regProbs = regime.regimeProbs
    ? (Array.isArray(regime.regimeProbs)
        ? regime.regimeProbs
        : Object.entries(regime.regimeProbs).map(([name, value]) => ({ name, value: pct100(value) })))
    : [];

  const chartIsB64 = typeof data.chart === "string" && data.chart.length > 100;
  const chartIsArr = Array.isArray(data.chart) && data.chart.length > 0;

  const syntCurve = useMemo(() => {
    const base = Number(data.currentPrice) || 200;
    const pred = Number(data.predictedPrice) || base;
    return Array.from({ length: 20 }, (_, i) => {
      const p = i / 19, noise = (Math.random() - .5) * base * .02;
      return { day: `D${i}`, price: +(base * (.97 + p * .03) + noise).toFixed(2), predicted: null };
    }).concat(Array.from({ length: data.horizonDays || 5 }, (_, i) => {
      const step = (pred - base) / (data.horizonDays || 5);
      return { day: `+${i + 1}d`, price: null, predicted: +(base + step * (i + 1)).toFixed(2) };
    }));
  }, [data.currentPrice, data.predictedPrice, data.horizonDays]);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "clamp(200px,22%,260px) 1fr clamp(200px,22%,260px)", gap: 16 }}>

        {/* Signal */}
        <GlassCard t={t}>
          <Lbl text="AI Signal" t={t} />
          <div style={{ marginTop: 12 }}>
            <SignalBox signal={signal} confidence={data.confidence} t={t} />
          </div>
          <div style={{ marginTop: 14 }}>
            <DRow label="Predicted" value={fC(cur, data.predictedPrice)} color={acc} t={t} />
            <DRow label="Return"    value={fp(data.predictedReturn)} color={Number(data.predictedReturn) >= 0 ? t.green : t.red} t={t} />
            <DRow label="Horizon"   value={`${data.horizonDays || "—"}d`} t={t} />
            <DRow label="Low / High" value={`${fC(cur, data.priceRange?.low)} – ${fC(cur, data.priceRange?.high)}`} color={t.textSecondary} t={t} />
          </div>
        </GlassCard>

        {/* Chart */}
        <GlassCard t={t}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.textPrimary }}>Price Chart + AI Prediction</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textMuted }}>
                {chartIsB64 ? "AI-generated chart" : chartIsArr ? `Last ${Math.min(data.chart.length, 40)} sessions` : "Estimated trajectory"}
              </p>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, fontFamily: "monospace" }}>
              <span style={{ color: acc }}>● Actual</span>
              <span style={{ color: acc2 }}>- Predicted</span>
            </div>
          </div>

          {chartIsB64 && (
            <div style={{ borderRadius: 12, overflow: "hidden", border: `1px solid ${t.border}` }}>
              <img src={`data:image/png;base64,${data.chart}`} alt="AI chart"
                style={{ width: "100%", display: "block", maxHeight: 280, objectFit: "contain", background: t.inputBg }} />
            </div>
          )}

          {chartIsArr && (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={[
                ...data.chart.slice(-40).map(c => ({ day: c.date?.slice(5) || "", price: c.close, predicted: null })),
                ...Array.from({ length: data.horizonDays || 5 }, (_, i) => {
                  const last = data.chart.at(-1)?.close || data.currentPrice;
                  const step = (data.predictedPrice - last) / (data.horizonDays || 5);
                  return { day: `+${i + 1}d`, price: null, predicted: +(last + step * (i + 1)).toFixed(2) };
                }),
              ]}>
                <defs>
                  <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={acc} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={acc} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                <XAxis dataKey="day" tick={{ fontSize: 9.5, fill: t.textMuted }} tickLine={false} interval={6} />
                <YAxis tick={{ fontSize: 9.5, fill: t.textMuted }} tickLine={false} width={56} tickFormatter={v => isINR(data.symbol) ? `₹${v}` : `$${v}`} />
                <RechartsTip content={props => <CT {...props} t={t} />} />
                <Area dataKey="price"     stroke={acc}  fill="url(#cg)" strokeWidth={2}   dot={false} name="Price" />
                <Area dataKey="predicted" stroke={acc2} fill="none"     strokeWidth={2.5} dot={{ r: 3, fill: acc2 }} strokeDasharray="5 3" name="Predicted" />
              </AreaChart>
            </ResponsiveContainer>
          )}

          {!chartIsB64 && !chartIsArr && (
            <ResponsiveContainer width="100%" height={210}>
              <AreaChart data={syntCurve}>
                <defs>
                  <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={acc} stopOpacity={0.15} />
                    <stop offset="95%" stopColor={acc} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
                <XAxis dataKey="day" tick={{ fontSize: 9.5, fill: t.textMuted }} tickLine={false} />
                <YAxis tick={{ fontSize: 9.5, fill: t.textMuted }} tickLine={false} width={56} tickFormatter={v => isINR(data.symbol) ? `₹${v}` : `$${v}`} />
                <RechartsTip content={props => <CT {...props} t={t} />} />
                <Area dataKey="price"     stroke={acc}  fill="url(#cg2)" strokeWidth={2}   dot={false} name="Price" />
                <Area dataKey="predicted" stroke={acc2} fill="none"      strokeWidth={2.5} dot={{ r: 3, fill: acc2 }} strokeDasharray="5 3" name="Predicted" />
              </AreaChart>
            </ResponsiveContainer>
          )}

          <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
            {[
              ["Current",   fC(cur, data.currentPrice),     t.textPrimary],
              ["Predicted", fC(cur, data.predictedPrice),   tc],
              ["Return",    fp(data.predictedReturn),       Number(data.predictedReturn) >= 0 ? t.green : t.red],
              ["Dir. Acc.", `${f2(data.modelMetrics?.directional_accuracy)}%`, t.green],
              ["Features",  data.featureCount || "—",        t.textMuted],
            ].map(([l, v, c]) => (
              <div key={l} style={{ flex: "1 1 80px", padding: "8px 10px", borderRadius: 10, background: t.inputBg, border: `1px solid ${t.border}` }}>
                <Lbl text={l} t={t} />
                <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 800, color: c, fontFamily: "monospace" }}>{v}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        {/* Regime */}
        <GlassCard t={t}>
          <Lbl text="Market Regime" t={t} />
          <p style={{ margin: "8px 0 2px", fontSize: 26, fontWeight: 900, color: rc, fontFamily: "monospace" }}>{regimeName}</p>
          <p style={{ margin: "0 0 4px", fontSize: 12, color: t.textMuted }}>
            Probability: <strong style={{ color: rc }}>{f2(regimeProb)}%</strong>
          </p>
          {regime.volatility && (
            <p style={{ margin: "0 0 12px", fontSize: 11, color: t.textMuted }}>
              Vol: <strong style={{ color: t.yellow }}>{regime.volatility}</strong>
            </p>
          )}
          {regProbs.map((rp, i) => (
            <div key={i} style={{ marginBottom: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: t.textMuted, marginBottom: 3 }}>
                <span>{rp.name}</span>
                <span style={{ color: regimeCol(t, rp.name), fontWeight: 700 }}>{f2(rp.value)}%</span>
              </div>
              <PBar value={Number(rp.value)} color={regimeCol(t, rp.name)} t={t} />
            </div>
          ))}
          <div style={{ marginTop: 16, paddingTop: 14, borderTop: `1px solid ${t.border}` }}>
            <Lbl text="Model Metrics" t={t} />
            <div style={{ marginTop: 10 }}>
              {[
                ["RMSE",      f2(data.modelMetrics?.rmse)],
                ["MAE",       f2(data.modelMetrics?.mae)],
                ["Dir. Acc.", `${f2(data.modelMetrics?.directional_accuracy)}%`],
                ...(data.modelMetrics?.mape != null ? [["MAPE", `${f2(data.modelMetrics.mape)}%`]] : []),
                ["Compute",   data.meta?.computeTime ? `${data.meta.computeTime}s` : "—"],
              ].map(([l, v]) => <DRow key={l} label={l} value={v} t={t} />)}
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Meta strip */}
      <GlassCard t={t} style={{ padding: "14px 22px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 28, alignItems: "center" }}>
          {[
            ["Symbol",   data.symbol,                          acc],
            ["Company",  data.meta?.companyName || data.symbol, t.textPrimary],
            ["Sector",   data.meta?.sector,                    t.textSecondary],
            ["Exchange", data.meta?.exchange,                  t.textSecondary],
            ["Currency", data.currency,                        t.textSecondary],
            ["Data Pts", data.meta?.dataPoints,                t.textMuted],
            ["Date",     data.meta?.latestDate,                t.textMuted],
          ].map(([l, v, c]) => v ? (
            <div key={l}>
              <Lbl text={l} t={t} />
              <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 600, color: c }}>{v}</p>
            </div>
          ) : null)}
        </div>
      </GlassCard>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   TAB: SENTIMENT
═══════════════════════════════════════════════════════ */
const SentimentTab = ({ data, t }) => {
  const sent = data.sentiment || {};
  const sc   = sent.label === "Positive" ? t.green : sent.label === "Negative" ? t.red : t.yellow;
  const arts = Array.isArray(sent.articles) ? sent.articles : [];
  const pos  = arts.filter(a => a.label === "Positive").length;
  const neg  = arts.filter(a => a.label === "Negative").length;
  const neu  = arts.length - pos - neg;
  const pieData = [{ name: "Positive", value: pos || 0 }, { name: "Neutral", value: neu || 0 }, { name: "Negative", value: neg || 0 }];
  const PIE_C   = [t.green, t.yellow, t.red];

  return (
    <div style={{ display: "grid", gridTemplateColumns: "clamp(280px,33%,360px) 1fr", gap: 16 }}>
      <GlassCard t={t}>
        <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: t.textPrimary }}>Sentiment Score</p>
        <SentGauge score={sent.score} t={t} />
        <div style={{ textAlign: "center", marginBottom: 14 }}>
          <Badge text={sent.label || "Neutral"} color={sc} />
          <p style={{ margin: "8px 0 0", fontSize: 11, color: t.textMuted }}>
            {sent.article_count || 0} articles · {sent.model_used === "finbert" ? "FinBERT" : "Lexicon"}
            {sent.confidence != null && <> · Conf: {f2(pct100(sent.confidence))}%</>}
          </p>
        </div>
        <p style={{ margin: "0 0 10px", fontSize: 12, fontWeight: 700, color: t.textPrimary }}>Distribution</p>
        <ResponsiveContainer width="100%" height={160}>
          <RPie>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={64} dataKey="value" paddingAngle={3}>
              {pieData.map((_, i) => <Cell key={i} fill={PIE_C[i]} />)}
            </Pie>
            <RechartsTip content={props => <CT {...props} t={t} />} />
            <Legend iconType="circle" iconSize={8}
              formatter={v => <span style={{ color: t.textMuted, fontSize: 11 }}>{v}</span>} />
          </RPie>
        </ResponsiveContainer>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 4 }}>
          {[["Positive", pos, t.green], ["Neutral", neu, t.yellow], ["Negative", neg, t.red]].map(([l, v, c]) => (
            <div key={l} style={{ textAlign: "center", padding: "10px 8px", borderRadius: 11, background: `${c}0C`, border: `1px solid ${c}30` }}>
              <Lbl text={l} t={t} />
              <p style={{ margin: "4px 0 0", fontSize: 20, fontWeight: 800, color: c }}>{v}</p>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard t={t}>
        <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: t.textPrimary }}>News Feed</p>
        <div style={{ display: "flex", flexDirection: "column", maxHeight: 480, overflowY: "auto" }}>
          {arts.length === 0 && <p style={{ color: t.textMuted, textAlign: "center", padding: "40px 0", fontSize: 13 }}>No articles available</p>}
          {arts.map((a, i) => {
            const ac = a.label === "Positive" ? t.green : a.label === "Negative" ? t.red : t.yellow;
            return (
              <div key={i} style={{ display: "flex", gap: 12, padding: "12px 0", borderBottom: `1px solid ${t.border}` }}>
                <div style={{ flexShrink: 0, marginTop: 4, width: 8, height: 8, borderRadius: "50%", background: ac, boxShadow: `0 0 8px ${ac}60` }} />
                <div style={{ flex: 1 }}>
                  <p style={{ margin: "0 0 5px", fontSize: 13, color: t.textPrimary, lineHeight: 1.5 }}>{a.headline || a.title || "—"}</p>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontSize: 10.5, color: t.textMuted }}>{a.source || ""}</span>
                    <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                      {a.score != null && <span style={{ fontSize: 10.5, color: ac, fontWeight: 700, fontFamily: "monospace" }}>{f2(a.score)}</span>}
                      <Badge text={a.label || "Neutral"} color={ac} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </GlassCard>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   TAB: RISK
═══════════════════════════════════════════════════════ */
const RiskTab = ({ data, t }) => {
  const risk = data.risk || {};
  const cur  = data.currency || "USD";
  const lc   = riskLevelCol(t, risk.riskLevel);

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <GlassCard t={t}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.textPrimary }}>Risk Assessment</p>
            <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
              {risk.riskScore != null && <span style={{ fontSize: 11, color: t.textMuted, fontFamily: "monospace" }}>Score: <strong style={{ color: lc }}>{f2(risk.riskScore)}</strong></span>}
              <Badge text={risk.riskLevel || "—"} color={lc} />
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
            <Tile label="Position Size" value={`${f2(risk.suggestedPosition)}%`} color={t.accentPrimary} tip="Kelly Criterion optimal position size." t={t} />
            <Tile label="Stop Loss %"   value={`${f2(risk.stopLossPct)}%`}        color={t.red}           t={t} />
            <Tile label="VaR 95%"       value={`${f2(risk.var95)}%`}              color={t.red}           tip={TIPS.var}        t={t} />
            <Tile label="CVaR 95%"      value={`${f2(risk.cvar95)}%`}             color={t.red}           tip={TIPS.cvar}       t={t} />
            <Tile label="Max Drawdown"  value={`${f2(risk.maxDrawdown)}%`}        color={t.yellow}        tip={TIPS.maxdd}      t={t} />
            <Tile label="Volatility"    value={`${f2(risk.volatility)}%`}         color={t.yellow}        tip={TIPS.volatility} t={t} />
          </div>
          {risk.notes && (
            <div style={{ padding: "10px 14px", borderRadius: 11, background: `${t.yellow}08`, border: `1px solid ${t.yellow}25` }}>
              <p style={{ margin: 0, fontSize: 12, color: t.yellow, lineHeight: 1.6 }}>⚠ {risk.notes}</p>
            </div>
          )}
        </GlassCard>

        <GlassCard t={t}>
          <p style={{ margin: "0 0 18px", fontSize: 14, fontWeight: 700, color: t.textPrimary }}>Trade Setup</p>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 18 }}>
            <Tile label="Entry"       value={fC(cur, data.currentPrice)}    color={t.accentPrimary} t={t} />
            <Tile label="Target (TP)" value={fC(cur, risk.takeProfitPrice)} color={t.green}         t={t} />
            <Tile label="Stop Loss"   value={fC(cur, risk.stopLossPrice)}   color={t.red}           t={t} />
            <Tile label="R:R"
              value={risk.takeProfitPct && risk.stopLossPct
                ? `${(Number(risk.takeProfitPct) / Number(risk.stopLossPct)).toFixed(1)}:1` : "—"}
              t={t} />
          </div>
          {risk.stopLossPct && risk.takeProfitPct && (
            <>
              <Lbl text="Risk / Reward Bar" t={t} />
              <div style={{ display: "flex", height: 30, borderRadius: 9, overflow: "hidden", gap: 2, marginTop: 8 }}>
                <div style={{ flex: Number(risk.stopLossPct) || 1, background: `${t.red}18`, border: `1px solid ${t.red}35`, borderRadius: "9px 0 0 9px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: t.red, fontWeight: 700 }}>
                  −{f2(risk.stopLossPct)}%
                </div>
                <div style={{ flex: Number(risk.takeProfitPct) || 2, background: `${t.green}10`, border: `1px solid ${t.green}30`, borderRadius: "0 9px 9px 0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, color: t.green, fontWeight: 700 }}>
                  +{f2(risk.takeProfitPct)}%
                </div>
              </div>
              <p style={{ margin: "8px 0 0", fontSize: 10.5, color: t.textMuted }}>
                Kelly position: <strong style={{ color: t.accentPrimary }}>{f2(risk.suggestedPosition)}%</strong> of capital
              </p>
            </>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   TAB: BACKTEST
═══════════════════════════════════════════════════════ */
const BacktestTab = ({ data, t, onRunBacktest, backtestLoading }) => {
  const bt = data?.backtest;

  if (!bt) return (
    <GlassCard t={t} style={{ textAlign: "center", padding: 60 }}>
      <BarChart2 size={44} style={{ opacity: 0.12, margin: "0 auto 14px", color: t.textMuted }} />

      <p style={{ color: t.textMuted, fontSize: 14 }}>
        No backtest data
      </p>

      <button
        onClick={onRunBacktest}
        disabled={backtestLoading}
        style={{
          marginTop: 16,
          padding: "10px 16px",
          borderRadius: 10,
          border: "none",
          background: t.gradient,
          color: "#fff",
          cursor: "pointer",
          fontWeight: 700,
          opacity: backtestLoading ? 0.6 : 1
        }}
      >
        {backtestLoading ? "Running…" : "Run Backtest"}
      </button>
    </GlassCard>
  );

  const cur     = data.currentPrice;
  const alpha    = (Number(bt.totalReturn) || 0) - (Number(bt.buyHoldReturn) || 0);
  const equCurve = buildCurve(bt);
  const acc      = t.accentPrimary || "#4F9DFF";

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 12 }}>
        <Tile label="Total Return"  value={fp(bt.totalReturn)}  color={Number(bt.totalReturn) >= 0 ? t.green : t.red} t={t} />
        <Tile label="Win Rate"      value={`${f2(bt.winRate)}%`} color={t.green} tip={TIPS.winrate} t={t} />
        <Tile label="Sharpe Ratio"  value={f2(bt.sharpeRatio)}  color={acc}      tip={TIPS.sharpe}  t={t} />
        <Tile label="Max Drawdown"  value={`${f2(bt.maxDrawdown)}%`} color={t.red} tip={TIPS.maxdd} t={t} />
        <Tile label="Profit Factor" value={bt.profitFactor != null ? f2(bt.profitFactor) : "—"} color={acc} t={t} />
        <Tile label="Total Trades"  value={bt.totalTrades || "—"} t={t} />
        <Tile label="Buy & Hold"    value={bt.buyHoldReturn != null ? fp(bt.buyHoldReturn) : "—"} color={Number(bt.buyHoldReturn) >= 0 ? t.green : t.red} t={t} />
        <Tile label="Alpha"         value={fp(alpha)} color={alpha >= 0 ? t.green : t.red} tip={TIPS.alpha} sub={alpha >= 0 ? "Outperforms B&H" : "Underperforms B&H"} t={t} />
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 16 }}>
        <GlassCard t={t}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.textPrimary }}>Equity Curve</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textMuted }}>Strategy vs Buy & Hold · starting $100k</p>
            </div>
            <div style={{ display: "flex", gap: 14, fontSize: 11, fontFamily: "monospace" }}>
              <span style={{ color: acc }}>● AI Strategy</span>
              <span style={{ color: t.textMuted }}>● Buy & Hold</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={equCurve}>
              <defs>
                <linearGradient id="stg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={acc}         stopOpacity={0.28} />
                  <stop offset="95%" stopColor={acc}         stopOpacity={0} />
                </linearGradient>
                <linearGradient id="bhg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={t.textMuted} stopOpacity={0.1} />
                  <stop offset="95%" stopColor={t.textMuted} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={t.border} />
              <XAxis dataKey="day" tick={{ fontSize: 9.5, fill: t.textMuted }} tickLine={false} />
              <YAxis tick={{ fontSize: 9.5, fill: t.textMuted }} tickLine={false} tickFormatter={v => `$${v}k`} width={50} />
              <RechartsTip content={props => <CT {...props} t={t} />} />
              <ReferenceLine y={100} stroke={t.border} strokeDasharray="4 2" />
              <Area dataKey="strategy" stroke={acc}         fill="url(#stg)" strokeWidth={2.5} dot={false} name="AI Strategy" />
              <Area dataKey="buyhold"  stroke={t.textMuted} fill="url(#bhg)" strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Buy & Hold" />
            </AreaChart>
          </ResponsiveContainer>
        </GlassCard>

        <GlassCard t={t}>
          <p style={{ margin: "0 0 14px", fontSize: 14, fontWeight: 700, color: t.textPrimary }}>Strategy Details</p>
          <DRow label="Total Return"  value={fp(bt.totalReturn)}  color={Number(bt.totalReturn) >= 0 ? t.green : t.red} t={t} />
          <DRow label="Buy & Hold"    value={bt.buyHoldReturn != null ? fp(bt.buyHoldReturn) : "—"} color={Number(bt.buyHoldReturn) >= 0 ? t.green : t.red} t={t} />
          <DRow label="Alpha"         value={fp(alpha)} color={alpha >= 0 ? t.green : t.red} tip={TIPS.alpha} t={t} />
          {bt.calmarRatio != null && <DRow label="Calmar Ratio" value={f2(bt.calmarRatio)} color={acc} t={t} />}
          <DRow label="Profit Factor" value={bt.profitFactor != null ? f2(bt.profitFactor) : "—"} color={acc} t={t} />
          <DRow label="Final Value"   value={bt.finalPortfolio != null ? fC(cur, bt.finalPortfolio) : "—"} t={t} />
          <div style={{ marginTop: 16, padding: "12px 14px", borderRadius: 12, background: alpha >= 0 ? `${t.green}08` : `${t.red}08`, border: `1px solid ${alpha >= 0 ? t.green : t.red}25` }}>
            <Lbl text="vs Passive" t={t} />
            <p style={{ margin: "6px 0 0", fontSize: 26, fontWeight: 900, color: alpha >= 0 ? t.green : t.red, fontFamily: "monospace" }}>{fp(alpha)}</p>
            <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textMuted }}>{alpha >= 0 ? "Outperforms" : "Underperforms"} buy & hold</p>
          </div>
        </GlassCard>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   TAB: PORTFOLIO
═══════════════════════════════════════════════════════ */
const PortfolioTab = ({ portfolio, onOptimize, portLoading, t }) => {
  const [capital,  setCapital]  = useState("100000");
  const [addSym,   setAddSym]   = useState("");
  const [addSh,    setAddSh]    = useState("");
  const [holdings, setHoldings] = useState([
    { sym: "AAPL", shares: 10, price: 189.50 },
    { sym: "TSLA", shares: 5,  price: 242.10 },
    { sym: "NVDA", shares: 3,  price: 878.30 },
    { sym: "MSFT", shares: 8,  price: 415.20 },
  ]);
  const acc    = t.accentPrimary || "#4F9DFF";
  const acc2   = t.accentSecond  || "#A78BFA";
  const PALETTE = [acc, t.green, acc2, t.yellow, t.pink || "#F472B6", t.cyan || "#00D4FF"];
  const getC   = (sym, i) => sym === "CASH" ? t.textMuted : PALETTE[i % PALETTE.length];

  const totalPos = holdings.reduce((s, h) => s + h.shares * h.price, 0);
  const cash     = Math.max(0, (Number(capital) || 100000) - totalPos);
  const entries  = Object.entries(portfolio?.weights || {});
  const pieData  = entries.map(([name, value], i) => ({ name, value: Number(value), fill: getC(name, i) }));

  const addHolding = () => {
    if (!addSym || !addSh) return;
    setHoldings(h => [...h, { sym: addSym.toUpperCase(), shares: Number(addSh), price: 100 }]);
    setAddSym(""); setAddSh("");
  };

  return (
    <div style={{ display: "grid", gap: 16 }}>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
        <GlassCard t={t}>
          <p style={{ margin: "0 0 16px", fontSize: 14, fontWeight: 700, color: t.textPrimary }}>My Portfolio</p>
          <div style={{ marginBottom: 16, padding: "14px 16px", borderRadius: 13, background: `${acc}08`, border: `1px solid ${acc}22` }}>
            <Lbl text="Total Capital" t={t} />
            <input value={capital} onChange={e => setCapital(e.target.value)}
              style={{ background: "none", border: "none", fontSize: 22, fontWeight: 800, color: acc, fontFamily: "monospace", outline: "none", width: "100%", marginTop: 4 }}
              placeholder="$100,000" />
          </div>
          <div style={{ marginBottom: 14 }}>
            {holdings.map((h, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 0", borderBottom: `1px solid ${t.border}` }}>
                <div style={{ width: 9, height: 9, borderRadius: "50%", flexShrink: 0, background: PALETTE[i % PALETTE.length] }} />
                <span style={{ fontWeight: 700, color: t.textPrimary, fontSize: 13, minWidth: 52 }}>{h.sym}</span>
                <span style={{ color: t.textMuted, fontSize: 12 }}>{h.shares} sh</span>
                <div style={{ flex: 1 }} />
                <span style={{ fontWeight: 700, color: t.textPrimary, fontSize: 13, fontFamily: "monospace" }}>
                  ${(h.shares * h.price).toLocaleString("en-US", { maximumFractionDigits: 0 })}
                </span>
                <button onClick={() => setHoldings(hh => hh.filter((_, j) => j !== i))}
                  style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}
                  onMouseEnter={e => e.currentTarget.style.color = t.red}
                  onMouseLeave={e => e.currentTarget.style.color = t.textMuted}>
                  <Trash2 size={12} />
                </button>
              </div>
            ))}
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 14 }}>
            <input value={addSym} onChange={e => setAddSym(e.target.value.toUpperCase())}
              placeholder="Ticker" style={{ flex: 1, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 9, padding: "8px 11px", fontSize: 12, color: t.textPrimary, outline: "none" }} />
            <input value={addSh} onChange={e => setAddSh(e.target.value)} type="number"
              placeholder="Shares" style={{ flex: 1, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 9, padding: "8px 11px", fontSize: 12, color: t.textPrimary, outline: "none" }} />
            <button onClick={addHolding}
              style={{ padding: "8px 14px", borderRadius: 9, border: "none", background: t.gradient, color: "#fff", fontSize: 14, fontWeight: 800, cursor: "pointer" }}>
              <Plus size={14} />
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
            {[
              ["Value",  `$${totalPos.toLocaleString("en-US", { maximumFractionDigits: 0 })}`, acc],
              ["Cash",   `$${cash.toLocaleString("en-US",    { maximumFractionDigits: 0 })}`, t.green],
              ["Stocks", holdings.length,                                                       t.textPrimary],
            ].map(([l, v, c]) => (
              <div key={l} style={{ padding: "10px 12px", borderRadius: 12, textAlign: "center", background: t.inputBg, border: `1px solid ${t.border}` }}>
                <Lbl text={l} t={t} />
                <p style={{ margin: "4px 0 0", fontSize: 17, fontWeight: 800, color: c, fontFamily: "monospace" }}>{v}</p>
              </div>
            ))}
          </div>
        </GlassCard>

        <GlassCard t={t}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 700, color: t.textPrimary }}>Portfolio Optimizer (MPT)</p>
              <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textMuted }}>Max Sharpe · AAPL, TSLA, NVDA, MSFT</p>
            </div>
            <button onClick={onOptimize} disabled={portLoading}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 10, border: "none", background: t.gradient, color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: portLoading ? 0.6 : 1, boxShadow: `0 4px 20px ${t.glowPrimary}` }}>
              {portLoading ? <RefreshCw size={12} style={{ animation: "td-spin 1s linear infinite" }} /> : <Zap size={12} />}
              {portLoading ? "Optimizing…" : "Optimize"}
            </button>
          </div>

          {portfolio ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
                <Tile label="Exp. Return" value={fp(portfolio.expectedReturn)} color={t.green}  t={t} />
                <Tile label="Exp. Risk"   value={fp(portfolio.expectedRisk)}   color={t.red}    t={t} />
                <Tile label="Sharpe"      value={f2(portfolio.sharpeRatio)}    color={acc}      tip={TIPS.sharpe} t={t} />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 14 }}>
                <ResponsiveContainer width="100%" height={170}>
                  <RPie>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={66} dataKey="value" paddingAngle={3}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                    </Pie>
                    <RechartsTip content={props => <CT {...props} t={t} />} />
                  </RPie>
                </ResponsiveContainer>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, justifyContent: "center" }}>
                  {entries.map(([sym, pct], i) => {
                    const c = getC(sym, i);
                    return (
                      <div key={sym}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 3 }}>
                          <span style={{ color: t.textPrimary, fontWeight: 600, fontFamily: "monospace" }}>{sym}</span>
                          <span style={{ color: c, fontWeight: 700, fontFamily: "monospace" }}>{f2(pct)}%</span>
                        </div>
                        <PBar value={Number(pct)} color={c} t={t} h={4} />
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {entries.map(([sym, pct], i) => {
                  const c = getC(sym, i);
                  return (
                    <div key={sym} style={{ flex: "1 1 72px", padding: "10px 12px", borderRadius: 12, textAlign: "center", background: `${c}0C`, border: `1px solid ${c}30` }}>
                      <Lbl text={sym} t={t} />
                      <p style={{ margin: "4px 0 0", fontSize: 22, fontWeight: 900, color: c, fontFamily: "monospace" }}>{f2(pct)}%</p>
                    </div>
                  );
                })}
              </div>
            </>
          ) : (
            <div style={{ textAlign: "center", padding: "48px 0", color: t.textMuted }}>
              <PieChart size={40} style={{ opacity: 0.18, margin: "0 auto 14px" }} />
              <p style={{ fontSize: 13 }}>Click Optimize to run MPT allocation</p>
              <p style={{ fontSize: 11, marginTop: 4 }}>AAPL · TSLA · NVDA · MSFT</p>
            </div>
          )}
        </GlassCard>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════ */
export default function AITradingDashboard() {
  useAuthGuard();
  const { theme } = useTheme();
  const t = tokens(theme);

  /* Ensure semantic colour shorthands always exist */
  t.green  = t.green  || "#00E5A0";
  t.red    = t.red    || "#FF4D6A";
  t.yellow = t.yellow || "#FFB930";
  t.pink   = t.pink   || "#F472B6";
  t.cyan   = t.cyan   || "#00D4FF";

  const [inputSym,  setInputSym]  = useState("TSLA");
  const [symbol,    setSymbol]    = useState("TSLA");
  const [data,      setData]      = useState(null);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState(null);
  const [horizon,   setHorizon]   = useState(5);
  const [tab,       setTab]       = useState("overview");
  const [portfolio, setPortfolio] = useState(null);
  const [portLoad,  setPortLoad]  = useState(false);

  const TABS = [
    { id: "overview",  label: "Overview",  icon: Brain },
    { id: "sentiment", label: "Sentiment", icon: Activity },
    { id: "risk",      label: "Risk",      icon: Shield },
    { id: "backtest",  label: "Backtest",  icon: BarChart2 },
    { id: "portfolio", label: "Portfolio", icon: PieChart },
  ];

  const analyze = useCallback(async (sym = symbol, hor = horizon) => {
    if (!sym) return;
    setLoading(true); setError(null); setData(null); setPortfolio(null);
    try {
      const res = await api.post("/ai/predict", {
  symbol:          sym,
  horizon:         hor,
  skipSentiment:   false,
  includeChart:    false,     // ← TRUE tha, FALSE karo
  includeBacktest: false,     // ← TRUE tha, FALSE karo  
  includeRisk:     true,
  lstmEpochs:      30,        // ← 60 tha, 30 karo (2x faster)
});

      setData(res);
      setTab("overview");
    } catch (e) {
      setError(e?.response?.data?.detail || e?.response?.data?.message || e?.message || "Analysis failed");
    } finally {
      setLoading(false);
    }
  }, [symbol, horizon]);
  const [backtestLoading, setBacktestLoading] = useState(false);

const runBacktest = useCallback(async () => {
  if (!data || backtestLoading) return;

  setBacktestLoading(true);
  try {
    const res = await api.post("/ai/backtest", {
      symbol:           symbol,
      initial_cash:     100000,
      signal_threshold: 0.8,
    });

    setData(prev => ({ ...prev, backtest: res }));
  } catch (e) {
    console.error("Backtest:", e);
  } finally {
    setBacktestLoading(false);
  }
}, [data, symbol, backtestLoading]);

  const runPortfolio = useCallback(async () => {
    if (portfolio) return;
    setPortLoad(true);
    try {
      const res = await api.post("/ai/portfolio/optimize",
        { symbols: ["AAPL", "TSLA", "NVDA", "MSFT"], method: "max_sharpe" });
      setPortfolio(res);
    } catch (e) { console.error("Portfolio:", e); }
    finally { setPortLoad(false); }
  }, [portfolio]);

  useEffect(() => { analyze("TSLA", 5); }, []);

  const handleSearch = () => {
    const s = inputSym.trim().toUpperCase();
    if (!s) return;
    setSymbol(s); analyze(s, horizon);
  };
  const changeHorizon = h => { setHorizon(h); if (symbol) analyze(symbol, h); };
  const chgUp = Number(data?.changePercent || data?.predictedReturn || 0) >= 0;

  const cardBase = {
    background:           t.cardGradient,
    border:               `1px solid ${t.border}`,
    borderRadius:         18,
    backdropFilter:       "blur(24px) saturate(1.4)",
    WebkitBackdropFilter: "blur(24px) saturate(1.4)",
    boxShadow:            `${t.shadow}, inset 0 1px 0 ${t.glassEdge}`,
    padding:              20,
    transition:           "background .35s, border-color .3s",
  };

  return (
    <AppShell activePage="/ai-dashboard">

      {/* ── PAGE HEADER ── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between",
        marginBottom: 26, animation: "sa-slideUp 0.5s ease both", flexWrap: "wrap", gap: 14 }}>
        <div>
          <h1 style={{
            margin: 0, fontSize: 24, fontWeight: 800, letterSpacing: "-0.04em",
            fontFamily: "'Syne', sans-serif",
            color: t.titleColor || t.textPrimary,
            textShadow: t.isDark ? `0 0 24px ${t.glowPrimary}` : "none",
          }}>
            AI Trading Dashboard
          </h1>
          {/* <p style={{ margin: "4px 0 0", fontSize: 13, color: t.textMuted }}>
            LSTM · XGBoost · LightGBM · FinBERT · Regime Detection · MPT Portfolio
          </p> */}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Horizon pills */}
          <div style={{ display: "flex", gap: 3, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 11, padding: 3 }}>
            {[3, 5, 7, 10, 14].map(d => (
              <button key={d} onClick={() => changeHorizon(d)}
                style={{
                  padding: "5px 11px", borderRadius: 8, fontSize: 11, fontWeight: 600,
                  cursor: "pointer", border: "none", transition: "all .2s",
                  background: horizon === d ? (t.gradient || t.accentPrimary) : "transparent",
                  color: horizon === d ? "#fff" : t.textSecondary,
                  boxShadow: horizon === d ? `0 2px 10px ${t.glowPrimary}` : "none",
                }}>{d}d</button>
            ))}
          </div>

          {/* Search */}
          <div style={{ display: "flex", background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 12, overflow: "hidden" }}>
            <input value={inputSym}
              onChange={e => setInputSym(e.target.value.toUpperCase())}
              onKeyDown={e => e.key === "Enter" && handleSearch()}
              placeholder="TSLA · RELIANCE.NS"
              style={{ background: "none", border: "none", padding: "9px 14px", fontSize: 13, color: t.textPrimary, outline: "none", width: "clamp(130px,17vw,190px)", fontFamily: "monospace" }} />
            <button onClick={handleSearch} disabled={loading}
              style={{ padding: "9px 16px", border: "none", cursor: "pointer", background: t.gradient || t.accentPrimary, color: "#fff", fontWeight: 700, fontSize: 12, display: "flex", alignItems: "center", gap: 6, opacity: loading ? 0.6 : 1, transition: "opacity .2s", boxShadow: `0 4px 14px ${t.glowPrimary}` }}>
              {loading ? <RefreshCw size={13} style={{ animation: "td-spin 1s linear infinite" }} /> : <Search size={13} />}
              {loading ? "Running…" : "Analyze"}
            </button>
          </div>

          {/* Refresh */}
          {data && (
            <button onClick={() => analyze(symbol, horizon)} disabled={loading}
              style={{ padding: "9px 11px", borderRadius: 10, cursor: "pointer", background: t.inputBg, border: `1px solid ${t.border}`, color: t.textSecondary, display: "flex", alignItems: "center", transition: "all .2s", boxShadow: t.shadow }}
              onMouseEnter={e => e.currentTarget.style.borderColor = t.borderHover}
              onMouseLeave={e => e.currentTarget.style.borderColor = t.border}>
              <RefreshCw size={14} style={loading ? { animation: "td-spin 1s linear infinite" } : {}} />
            </button>
          )}
        </div>
      </div>

      {/* Guide */}
      <Guide t={t} />

      {/* Error */}
      {error && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "13px 18px", borderRadius: 13, marginBottom: 18, background: "rgba(239,68,68,.09)", border: "1px solid rgba(239,68,68,.22)", animation: "sa-slideUp 0.3s ease both" }}>
          <AlertCircle size={16} color={t.red} style={{ flexShrink: 0 }} />
          <span style={{ flex: 1, fontSize: 13, color: "#fca5a5" }}>{error}</span>
          <button onClick={() => { setError(null); analyze(symbol, horizon); }}
            style={{ background: "none", border: "1px solid rgba(239,68,68,.35)", color: t.red, cursor: "pointer", borderRadius: 8, padding: "4px 12px", fontSize: 11, fontWeight: 700 }}>Retry</button>
          <button onClick={() => setError(null)} style={{ background: "none", border: "none", color: t.textMuted, cursor: "pointer" }}>
            <X size={14} />
          </button>
        </div>
      )}

      {/* Stock header */}
      {data && !loading && (
        <div style={{ ...cardBase, marginBottom: 16, padding: "15px 22px", animation: "sa-slideUp 0.4s ease both" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <div style={{ width: 42, height: 42, borderRadius: 12, background: t.gradient, border: `1px solid rgba(255,255,255,0.15)`, boxShadow: `0 4px 16px ${t.glowPrimary}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>
                {data.symbol?.slice(0, 2)}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: "clamp(15px,2.2vw,20px)", fontWeight: 800, letterSpacing: "-0.04em", color: t.textPrimary, fontFamily: "'Syne', sans-serif" }}>
                    {data.symbol}
                  </h2>
                  {data.meta?.exchange && <Badge text={data.meta.exchange} color={t.textSecondary} />}
                </div>
                <p style={{ margin: "2px 0 0", fontSize: 11, color: t.textMuted }}>
                  {data.meta?.companyName || data.symbol}{data.meta?.sector ? ` · ${data.meta.sector}` : ""}
                </p>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
              <div style={{ textAlign: "right" }}>
                <p style={{ margin: 0, fontSize: "clamp(20px,3vw,28px)", fontWeight: 900, letterSpacing: "-0.05em", color: t.textPrimary, fontFamily: "'Syne', sans-serif" }}>
                  {fC(data.currency, data.currentPrice)}
                </p>
                <p style={{ margin: "3px 0 0", fontSize: 13, fontWeight: 700, display: "flex", alignItems: "center", gap: 4, justifyContent: "flex-end", color: chgUp ? t.green : t.red }}>
                  {chgUp ? <TrendingUp size={13} /> : <TrendingDown size={13} />}
                  {data.predictedReturn != null ? `${fp(data.predictedReturn)} predicted` : ""}
                </p>
              </div>
              <div style={{ padding: "10px 16px", borderRadius: 13, background: `${trendCol(t, data.trend)}10`, border: `1px solid ${trendCol(t, data.trend)}30` }}>
                <Lbl text="AI Trend" t={t} />
                <p style={{ margin: "4px 0 0", fontSize: 15, fontWeight: 800, color: trendCol(t, data.trend), fontFamily: "'Syne', sans-serif" }}>
                  {data.trend || "—"}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div style={{ ...cardBase, textAlign: "center", padding: "72px 20px", marginBottom: 18 }}>
          <div style={{ position: "relative", width: 60, height: 60, margin: "0 auto 20px" }}>
            <div style={{ position: "absolute", inset: 0, borderRadius: "50%", border: `3px solid ${t.border}`, borderTopColor: t.accentPrimary, animation: "td-spin 1s linear infinite" }} />
            <div style={{ position: "absolute", inset: 8, borderRadius: "50%", border: `3px solid ${t.border}`, borderTopColor: t.accentSecond || t.accentPrimary, animation: "td-spin .65s linear infinite reverse" }} />
            <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Brain size={18} color={t.accentPrimary} style={{ opacity: .8 }} />
            </div>
          </div>
          <p style={{ color: t.textPrimary, fontSize: 15, fontWeight: 700, margin: "0 0 8px", fontFamily: "'Syne', sans-serif" }}>
            Training models for {symbol}…
          </p>
          <p style={{ color: t.textMuted, fontSize: 12, margin: 0, lineHeight: 1.6 }}>
             May take 2–5 minutes
          </p>
          <div style={{ display: "flex", gap: 6, justifyContent: "center", marginTop: 14 }}>
            {["Loading", "Training", "Processing", "Aggregating"].map((m, i) => (
              <span key={m} style={{ fontSize: 10, padding: "3px 8px", borderRadius: 20, background: t.inputBg, border: `1px solid ${t.border}`, color: t.textMuted, animation: `sa-pulse 1.5s ${i * 0.3}s infinite` }}>
                {m}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Tabs + content */}
      {!loading && data && (
        <div style={{ animation: "sa-slideUp 0.5s 0.1s ease both" }}>
          {/* Tab pill bar — matches History.jsx filter pill style */}
          <div style={{ display: "flex", gap: 3, marginBottom: 18, background: t.inputBg, border: `1px solid ${t.border}`, borderRadius: 14, padding: 5, width: "fit-content", overflowX: "auto" }}>
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button key={id}
                  onClick={() => { setTab(id); if (id === "portfolio" && !portfolio) runPortfolio(); }}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "8px 18px", borderRadius: 10,
                    border: active ? `1px solid ${t.accentPrimary}30` : "1px solid transparent",
                    cursor: "pointer", fontSize: 12.5, fontWeight: 600,
                    whiteSpace: "nowrap", transition: "all .2s",
                    background: active ? (t.gradient || t.accentPrimary) : "transparent",
                    color: active ? "#fff" : t.textSecondary,
                    boxShadow: active ? `0 4px 14px ${t.glowPrimary}` : "none",
                  }}>
                  <Icon size={13} />{label}
                </button>
              );
            })}
          </div>

          {tab === "overview"  && <OverviewTab  data={data} t={t} />}
          {tab === "sentiment" && <SentimentTab data={data} t={t} />}
          {tab === "risk"      && <RiskTab      data={data} t={t} />}
      {tab === "backtest" && (
  <BacktestTab
    data={data}
    t={t}
    onRunBacktest={runBacktest}
    backtestLoading={backtestLoading}
  />
)}
          {tab === "portfolio" && <PortfolioTab portfolio={portfolio} onOptimize={runPortfolio} portLoading={portLoad} t={t} />}
        </div>
      )}

      {/* Empty state */}
      {!loading && !data && !error && (
        <div style={{ ...cardBase, textAlign: "center", padding: "80px 20px", animation: "sa-slideUp 0.5s ease both" }}>
          <div style={{ width: 86, height: 86, borderRadius: "50%", margin: "0 auto 22px", background: `${t.accentPrimary}14`, border: `1px solid ${t.accentPrimary}25`, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: `0 0 60px ${t.glowPrimary}` }}>
            <Brain size={36} color={t.accentPrimary} style={{ opacity: .8 }} />
          </div>
          <h2 style={{ margin: "0 0 10px", fontSize: 20, fontWeight: 800, color: t.textPrimary, fontFamily: "'Syne', sans-serif", letterSpacing: "-0.04em" }}>
            Enter a Stock Symbol to Begin
          </h2>
          <p style={{ margin: "0 0 28px", fontSize: 13, color: t.textMuted, maxWidth: 380, lineHeight: 1.6 }}>
            US stocks (TSLA, AAPL, NVDA) and Indian stocks (RELIANCE.NS, TCS.NS)
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
            {["TSLA", "AAPL", "NVDA", "MSFT", "RELIANCE.NS", "TCS.NS"].map(s => (
              <button key={s}
                onClick={() => { setInputSym(s); setSymbol(s); analyze(s, horizon); }}
                style={{ padding: "9px 16px", borderRadius: 11, fontSize: 12, fontWeight: 700, cursor: "pointer", transition: "all .22s", background: t.inputBg, border: `1px solid ${t.border}`, color: t.textSecondary, fontFamily: "monospace" }}
                onMouseEnter={e => { e.currentTarget.style.borderColor = t.borderHover; e.currentTarget.style.color = t.accentPrimary; e.currentTarget.style.background = `${t.accentPrimary}10`; }}
                onMouseLeave={e => { e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; e.currentTarget.style.background = t.inputBg; }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <style>{`
        @keyframes td-spin { to { transform: rotate(360deg); } }
        input::placeholder { color: ${t.textMuted}; }
        select option { background: ${t.cardBg}; color: ${t.textPrimary}; }
      `}</style>
    </AppShell>
  );
}