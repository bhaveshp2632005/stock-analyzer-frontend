/**
 * Favorites.jsx — Dedicated Favorites Page
 * ────────────────────────────────────────────────────────────
 * Full-page view for managing favorite stocks + price alerts.
 * Matches existing 3D glassmorphism design system exactly.
 *
 * Features:
 *  - Full favorites list with live prices
 *  - Add / remove favorites
 *  - Set / edit alertAbove + alertBelow per stock
 *  - Alert status display (SET / FIRED / TRIGGERED)
 *  - Filter: All / With Alerts / Triggered
 *  - Sort: By Symbol / Price / Change %
 *  - Price alert toast notifications
 *  - Inline add form + edit modal
 *  - Refresh button
 */

import React, { useState, useCallback, useRef } from "react";
import {
  Star, Bell, BellOff, Plus, Trash2,
  TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight,
  RefreshCw, X, Check, Edit3, AlertTriangle,
  Search, SlidersHorizontal, Zap, Activity,
} from "lucide-react";
import { useNavigate }   from "react-router-dom";
import AppShell          from "./AppShell.jsx";
import { useTheme }      from "../context/ThemeContext.jsx";
import { tokens }        from "../context/theme.js";
import useAuthGuard      from "../hooks/useAuthGuard.js";
import { useFavorites }  from "../hooks/useFavorites.js";
import { NotificationStack, useAlertNotifications } from "./AlertNotification.jsx";

/* ── price formatter ── */
const fmt = (price, currency) => {
  if (price == null || price === "") return "—";
  return currency === "INR"
    ? "₹" + Number(price).toLocaleString("en-IN", { minimumFractionDigits: 2 })
    : "$" + Number(price).toFixed(2);
};

/* ══════════════════════════════════════════════════
   ADD FORM — collapsible
══════════════════════════════════════════════════ */
const AddForm = ({ onAdd, t }) => {
  const [open,  setOpen]  = useState(false);
  const [sym,   setSym]   = useState("");
  const [above, setAbove] = useState("");
  const [below, setBelow] = useState("");
  const [err,   setErr]   = useState("");
  const [busy,  setBusy]  = useState(false);
  const inputRef = useRef(null);

  const inp = {
    background: t.inputBg, border: `1px solid ${t.inputBorder}`,
    borderRadius: 11, padding: "10px 14px", fontSize: 13,
    color: t.textPrimary, outline: "none",
    width: "100%", boxSizing: "border-box",
    transition: "border-color .2s, box-shadow .2s",
  };

  const handleAdd = async () => {
    const s = sym.trim().toUpperCase();
    if (!s) { setErr("Enter a stock symbol"); return; }
    setBusy(true); setErr("");
    const r = await onAdd(
      s,
      above !== "" ? Number(above) : null,
      below !== "" ? Number(below) : null,
    );
    setBusy(false);
    if (r?.ok === false) { setErr(r.error || "Failed to add"); return; }
    setSym(""); setAbove(""); setBelow(""); setOpen(false);
  };

  if (!open) return (
    <button
      onClick={() => { setOpen(true); setTimeout(() => inputRef.current?.focus(), 60); }}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "11px 20px", borderRadius: 14,
        background: `${t.accentPrimary}12`,
        border: `1.5px dashed ${t.accentPrimary}45`,
        color: t.accentPrimary, cursor: "pointer",
        fontSize: 13, fontWeight: 600,
        transition: "all .2s", width: "100%", justifyContent: "center",
      }}
      onMouseEnter={e => { e.currentTarget.style.background = `${t.accentPrimary}20`; e.currentTarget.style.borderStyle = "solid"; }}
      onMouseLeave={e => { e.currentTarget.style.background = `${t.accentPrimary}12`; e.currentTarget.style.borderStyle = "dashed"; }}>
      <Plus size={15} /> Add New Favorite
    </button>
  );

  return (
    <div style={{
      borderRadius: 18, padding: 20,
      background: t.cardGradient,
      border: `1px solid ${t.accentPrimary}28`,
      backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
      boxShadow: `${t.shadow}, inset 0 1px 0 ${t.glassEdge}`,
      animation: "fav-slide-in .28s cubic-bezier(.22,1,.36,1)",
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
          <div style={{
            width: 32, height: 32, borderRadius: 9,
            background: `linear-gradient(135deg,${t.accentPrimary}28,${t.accentSecond}12)`,
            border: `1px solid ${t.accentPrimary}35`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 3px 10px ${t.glowPrimary}`,
          }}>
            <Star size={14} style={{ color: t.accentPrimary }} />
          </div>
          <span style={{ fontSize: 14, fontWeight: 700, color: t.textPrimary }}>
            Add Favorite Stock
          </span>
        </div>
        <button onClick={() => { setOpen(false); setErr(""); }}
          style={{ background: "none", border: "none", cursor: "pointer", color: t.textMuted, padding: 4 }}>
          <X size={14} />
        </button>
      </div>

      {/* Symbol */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontSize: 11, fontWeight: 700, color: t.textSecondary, display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.06em" }}>
          Stock Symbol
        </label>
        <input ref={inputRef} value={sym}
          onChange={e => setSym(e.target.value.toUpperCase())}
          onKeyDown={e => e.key === "Enter" && handleAdd()}
          placeholder="e.g. AAPL, RELIANCE.NS, TSLA, NVDA"
          style={{ ...inp, fontWeight: 700, letterSpacing: "0.03em" }}
          onFocus={e => { e.target.style.borderColor = t.inputFocus; e.target.style.boxShadow = `0 0 0 3px ${t.accentPrimary}18`; }}
          onBlur={e  => { e.target.style.borderColor = t.inputBorder; e.target.style.boxShadow = "none"; }}
        />
      </div>

      {/* Alert thresholds */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#10b981", display: "block", marginBottom: 6 }}>
            🔺 Alert Above (optional)
          </label>
          <input value={above} onChange={e => setAbove(e.target.value)} type="number"
            placeholder="Price"
            style={{ ...inp, fontSize: 13 }}
            onFocus={e => { e.target.style.borderColor = "#10b981"; e.target.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.14)"; }}
            onBlur={e  => { e.target.style.borderColor = t.inputBorder; e.target.style.boxShadow = "none"; }}
          />
        </div>
        <div>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#f87171", display: "block", marginBottom: 6 }}>
            🔻 Alert Below (optional)
          </label>
          <input value={below} onChange={e => setBelow(e.target.value)} type="number"
            placeholder="Price"
            style={{ ...inp, fontSize: 13 }}
            onFocus={e => { e.target.style.borderColor = "#f87171"; e.target.style.boxShadow = "0 0 0 3px rgba(248,113,113,0.14)"; }}
            onBlur={e  => { e.target.style.borderColor = t.inputBorder; e.target.style.boxShadow = "none"; }}
          />
        </div>
      </div>

      {err && (
        <p style={{ margin: "0 0 12px", fontSize: 12, color: "#f87171", display: "flex", alignItems: "center", gap: 6 }}>
          <AlertTriangle size={12} /> {err}
        </p>
      )}

      <div style={{ display: "flex", gap: 8 }}>
        <button onClick={handleAdd} disabled={busy} style={{
          flex: 1, padding: "11px", borderRadius: 12, fontSize: 13, fontWeight: 700,
          background: t.gradientBtn || t.gradient, border: "none", color: "#fff",
          cursor: busy ? "not-allowed" : "pointer",
          boxShadow: `0 5px 18px ${t.glowPrimary}, inset 0 1px 0 rgba(255,255,255,0.18)`,
          display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
          opacity: busy ? 0.7 : 1, transition: "opacity .2s",
        }}>
          {busy
            ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} />
            : <Star size={13} />}
          {busy ? "Adding…" : "Add to Favorites"}
        </button>
        <button onClick={() => { setOpen(false); setErr(""); }}
          style={{
            padding: "11px 18px", borderRadius: 12, fontSize: 13,
            background: t.inputBg, border: `1px solid ${t.border}`,
            color: t.textSecondary, cursor: "pointer",
          }}>
          Cancel
        </button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   EDIT ALERT MODAL
══════════════════════════════════════════════════ */
const EditModal = ({ fav, prices, onSave, onClose, t }) => {
  const pd    = prices[fav.symbol];
  const [above, setAbove] = useState(fav.alertAbove ?? "");
  const [below, setBelow] = useState(fav.alertBelow ?? "");
  const [busy,  setBusy]  = useState(false);

  const inp = {
    background: t.inputBg, border: `1px solid ${t.inputBorder}`,
    borderRadius: 11, padding: "10px 14px", fontSize: 13,
    color: t.textPrimary, outline: "none",
    width: "100%", boxSizing: "border-box",
    transition: "border-color .2s, box-shadow .2s",
  };

  const handleSave = async () => {
    setBusy(true);
    await onSave(above !== "" ? Number(above) : null, below !== "" ? Number(below) : null);
    setBusy(false);
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(0,0,0,0.68)",
        backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: 20, animation: "sa-fadeIn .2s ease",
      }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        width: "100%", maxWidth: 400, borderRadius: 22,
        background: t.modalBg || (t.isDark ? "#08102A" : "#ffffff"),
        border: `1px solid ${t.border}`,
        boxShadow: `0 28px 90px rgba(0,0,0,0.55), inset 0 1px 0 ${t.glassEdge}`,
        padding: 28, animation: "fav-slide-in .32s cubic-bezier(.22,1,.36,1)",
        position: "relative",
      }}>
        <button onClick={onClose} style={{
          position: "absolute", top: 18, right: 18,
          width: 30, height: 30, borderRadius: 9,
          background: t.inputBg, border: `1px solid ${t.border}`,
          color: t.textMuted, cursor: "pointer",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}><X size={14} /></button>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 22 }}>
          <div style={{
            width: 46, height: 46, borderRadius: 14,
            background: `linear-gradient(135deg,${t.accentPrimary}28,${t.accentSecond}12)`,
            border: `1px solid ${t.accentPrimary}35`,
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: `0 5px 18px ${t.glowPrimary}`,
          }}>
            <Bell size={20} style={{ color: t.accentPrimary }} />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: 18, fontWeight: 800, color: t.textPrimary, fontFamily: "'Syne',sans-serif" }}>
              {fav.symbol}
            </p>
            {pd && (
              <p style={{ margin: 0, fontSize: 12, color: t.textSecondary }}>
                Current:{" "}
                <strong style={{ color: t.textPrimary }}>{fmt(pd.price, pd.currency)}</strong>
                {pd.changePercent && (
                  <span style={{ marginLeft: 7, color: Number(pd.changePercent) >= 0 ? "#34d399" : "#f87171" }}>
                    ({Number(pd.changePercent) >= 0 ? "+" : ""}{pd.changePercent}%)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Alert Above */}
        <div style={{ marginBottom: 16 }}>
          <label style={{
            fontSize: 12, fontWeight: 700, color: "#10b981",
            display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
          }}>
            <TrendingUp size={13} /> Alert when price goes ABOVE
          </label>
          <input value={above} onChange={e => setAbove(e.target.value)} type="number"
            placeholder="Enter price — leave blank to disable"
            style={inp}
            onFocus={e => { e.target.style.borderColor = "#10b981"; e.target.style.boxShadow = "0 0 0 3px rgba(16,185,129,0.14)"; }}
            onBlur={e  => { e.target.style.borderColor = t.inputBorder; e.target.style.boxShadow = "none"; }}
          />
        </div>

        {/* Alert Below */}
        <div style={{ marginBottom: 20 }}>
          <label style={{
            fontSize: 12, fontWeight: 700, color: "#f87171",
            display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
          }}>
            <TrendingDown size={13} /> Alert when price goes BELOW
          </label>
          <input value={below} onChange={e => setBelow(e.target.value)} type="number"
            placeholder="Enter price — leave blank to disable"
            style={inp}
            onFocus={e => { e.target.style.borderColor = "#f87171"; e.target.style.boxShadow = "0 0 0 3px rgba(248,113,113,0.14)"; }}
            onBlur={e  => { e.target.style.borderColor = t.inputBorder; e.target.style.boxShadow = "none"; }}
          />
        </div>

        <p style={{ fontSize: 11, color: t.textMuted, margin: "0 0 18px", lineHeight: 1.6 }}>
          💡 Saving resets the alert — it will fire again when the new threshold is crossed.
          Alert state is stored in the database and persists across sessions.
        </p>

        <div style={{ display: "flex", gap: 9 }}>
          <button onClick={handleSave} disabled={busy} style={{
            flex: 1, padding: "11px", borderRadius: 13, fontSize: 13, fontWeight: 700,
            background: t.gradientBtn || t.gradient, border: "none", color: "#fff",
            cursor: busy ? "not-allowed" : "pointer",
            boxShadow: `0 5px 18px ${t.glowPrimary}`,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 7,
            opacity: busy ? 0.7 : 1,
          }}>
            {busy ? <RefreshCw size={13} style={{ animation: "spin 1s linear infinite" }} /> : <Check size={13} />}
            {busy ? "Saving…" : "Save Alert"}
          </button>
          <button onClick={onClose} style={{
            padding: "11px 20px", borderRadius: 13, fontSize: 13,
            background: t.inputBg, border: `1px solid ${t.border}`,
            color: t.textSecondary, cursor: "pointer",
          }}>Cancel</button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   STAT CHIP — summary tiles
══════════════════════════════════════════════════ */
const StatChip = ({ label, value, color, icon: Icon, t }) => (
  <div style={{
    borderRadius: 16, padding: "16px 20px",
    background: t.cardGradient,
    border: `1px solid ${color}28`,
    backdropFilter: "blur(24px)", WebkitBackdropFilter: "blur(24px)",
    boxShadow: `${t.shadow}, 0 0 28px ${color}10, inset 0 1px 0 ${t.glassEdge}`,
    display: "flex", alignItems: "center", gap: 14,
    flex: 1, minWidth: 0, position: "relative", overflow: "hidden",
  }}>
    <div style={{ position: "absolute", top: -16, right: -12, width: 72, height: 72,
      borderRadius: "50%", background: `radial-gradient(circle,${color}20,transparent 70%)`, pointerEvents: "none" }} />
    <div style={{
      width: 40, height: 40, borderRadius: 12, flexShrink: 0,
      background: `linear-gradient(145deg,${color}28,${color}10)`,
      border: `1px solid ${color}40`,
      display: "flex", alignItems: "center", justifyContent: "center", color,
      boxShadow: `0 5px 16px ${color}28`,
      transform: "perspective(120px) rotateX(10deg) rotateY(-5deg)",
    }}>
      <Icon size={17} />
    </div>
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 26, fontWeight: 800, color: t.textPrimary,
        fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: 11, color: t.textSecondary, fontWeight: 600 }}>{label}</p>
    </div>
  </div>
);

/* ══════════════════════════════════════════════════
   FAVORITE CARD — grid card view
══════════════════════════════════════════════════ */
const FavCard = ({ fav, priceData, onRemove, onEdit, onAnalyze, t }) => {
  const [hov, setHov] = useState(false);

  const price    = priceData?.price;
  const currency = priceData?.currency || (fav.symbol.includes(".NS") ? "INR" : "USD");
  const chg      = priceData ? Number(priceData.changePercent) : null;
  const isUp     = chg != null ? chg >= 0 : null;

  const hasAlert  = fav.alertAbove != null || fav.alertBelow != null;
  const aboveTrig = fav.alertAbove != null && price != null && Number(price) > fav.alertAbove;
  const belowTrig = fav.alertBelow != null && price != null && Number(price) < fav.alertBelow;
  const triggered = aboveTrig || belowTrig;
  const anyFired  = fav.alertFiredAbove || fav.alertFiredBelow;

  const borderColor = triggered
    ? (aboveTrig ? "#10b98145" : "#f8717145")
    : hov ? `${t.accentPrimary}35` : t.border;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        borderRadius: 20, padding: 20,
        background: t.cardGradient,
        border: `1px solid ${borderColor}`,
        backdropFilter: "blur(26px) saturate(1.6)",
        WebkitBackdropFilter: "blur(26px) saturate(1.6)",
        boxShadow: triggered
          ? `${t.shadow}, 0 0 32px ${aboveTrig ? "rgba(16,185,129,0.16)" : "rgba(248,113,113,0.16)"}, inset 0 1px 0 ${t.glassEdge}`
          : `${t.shadow}, inset 0 1px 0 ${t.glassEdge}`,
        transition: "all .24s cubic-bezier(.22,1,.36,1)",
        transform: hov ? "translateY(-4px) scale(1.01)" : "translateY(0) scale(1)",
        position: "relative", overflow: "hidden",
        cursor: "default",
      }}>

      {/* triggered glow line at top */}
      {triggered && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, height: 2,
          background: `linear-gradient(90deg, transparent, ${aboveTrig ? "#10b981" : "#f87171"}, transparent)`,
          animation: "fav-glow 2s ease-in-out infinite",
        }} />
      )}

      {/* top row: avatar + symbol + actions */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* avatar */}
          <div style={{
            width: 40, height: 40, borderRadius: 12, flexShrink: 0,
            background: `linear-gradient(135deg,${t.accentPrimary}25,${t.accentSecond}10)`,
            border: `1px solid ${t.accentPrimary}30`,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 10, fontWeight: 800, color: t.accentPrimary,
            boxShadow: `0 4px 14px ${t.glowPrimary}`,
            transform: "perspective(100px) rotateX(8deg) rotateY(-4deg)",
          }}>
            {fav.symbol.replace(".NS","").replace(".BO","").slice(0, 3)}
          </div>
          <div>
            <button onClick={() => onAnalyze(fav.symbol)} style={{
              background: "none", border: "none", padding: 0, cursor: "pointer",
              fontSize: 15, fontWeight: 800, color: t.textPrimary,
              fontFamily: "'Syne',sans-serif", display: "block",
              transition: "color .15s",
            }}
              onMouseEnter={e => e.currentTarget.style.color = t.accentPrimary}
              onMouseLeave={e => e.currentTarget.style.color = t.textPrimary}>
              {fav.symbol}
            </button>
            <span style={{ fontSize: 10, color: t.textMuted }}>
              {fav.symbol.includes(".NS") || fav.symbol.includes(".BO") ? "NSE India" : "US Market"}
            </span>
          </div>
        </div>

        {/* action buttons */}
        <div style={{ display: "flex", gap: 5 }}>
          <button onClick={() => onEdit(fav)} title="Edit price alerts"
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: `${t.accentPrimary}16`, border: `1px solid ${t.accentPrimary}25`,
              color: t.accentPrimary, cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = `${t.accentPrimary}28`; e.currentTarget.style.transform = "scale(1.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = `${t.accentPrimary}16`; e.currentTarget.style.transform = "scale(1)"; }}>
            <Edit3 size={12} />
          </button>
          <button onClick={() => onRemove(fav.symbol)} title="Remove from favorites"
            style={{
              width: 28, height: 28, borderRadius: 8,
              background: "rgba(248,113,113,0.10)", border: "1px solid rgba(248,113,113,0.20)",
              color: "#f87171", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              transition: "all .15s",
            }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(248,113,113,0.24)"; e.currentTarget.style.transform = "scale(1.1)"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "rgba(248,113,113,0.10)"; e.currentTarget.style.transform = "scale(1)"; }}>
            <Trash2 size={12} />
          </button>
        </div>
      </div>

      {/* price display */}
      <div style={{ marginBottom: 14 }}>
        {!priceData ? (
          <div>
            <div style={{ width: "55%", height: 28, borderRadius: 6, background: t.inputBg,
              backgroundSize: "200% 100%", animation: "fav-shimmer 1.4s ease-in-out infinite", marginBottom: 6 }} />
            <div style={{ width: "35%", height: 14, borderRadius: 4, background: t.inputBg,
              backgroundSize: "200% 100%", animation: "fav-shimmer 1.4s ease-in-out .1s infinite" }} />
          </div>
        ) : (
          <>
            <p style={{ margin: 0, fontSize: 28, fontWeight: 800, color: t.textPrimary,
              fontFamily: "'Syne',sans-serif", letterSpacing: "-0.04em", lineHeight: 1 }}>
              {fmt(price, currency)}
            </p>
            <p style={{
              margin: "5px 0 0", fontSize: 12, fontWeight: 700,
              color: isUp === true ? "#34d399" : isUp === false ? "#f87171" : t.textMuted,
              display: "flex", alignItems: "center", gap: 3,
            }}>
              {isUp === true && <ArrowUpRight size={13} />}
              {isUp === false && <ArrowDownRight size={13} />}
              {chg != null ? (chg >= 0 ? "+" : "") + chg + "% today" : "Loading…"}
            </p>
          </>
        )}
      </div>

      {/* alert section */}
      <div style={{
        borderRadius: 12, padding: "10px 12px",
        background: hasAlert ? `${t.accentPrimary}08` : t.inputBg,
        border: `1px solid ${hasAlert ? t.accentPrimary + "20" : t.border}`,
      }}>
        {hasAlert ? (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 7 }}>
              <Bell size={10} style={{ color: (anyFired || triggered) ? "#fbbf24" : t.accentPrimary }} />
              <span style={{ fontSize: 10, fontWeight: 700,
                color: (anyFired || triggered) ? "#fbbf24" : t.accentPrimary,
                textTransform: "uppercase", letterSpacing: "0.06em",
                animation: (anyFired || triggered) ? "fav-glow 1.5s ease-in-out infinite" : "none",
              }}>
                {anyFired ? "Alert Fired" : triggered ? "Triggered Now" : "Alert Active"}
              </span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              {fav.alertAbove != null && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: t.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                    <TrendingUp size={9} style={{ color: "#10b981" }} /> Above
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#10b981",
                    opacity: fav.alertFiredAbove ? 0.55 : 1 }}>
                    {fmt(fav.alertAbove, currency)}
                    {fav.alertFiredAbove && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7 }}>(fired)</span>}
                  </span>
                </div>
              )}
              {fav.alertBelow != null && (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, color: t.textMuted, display: "flex", alignItems: "center", gap: 4 }}>
                    <TrendingDown size={9} style={{ color: "#f87171" }} /> Below
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#f87171",
                    opacity: fav.alertFiredBelow ? 0.55 : 1 }}>
                    {fmt(fav.alertBelow, currency)}
                    {fav.alertFiredBelow && <span style={{ fontSize: 9, marginLeft: 4, opacity: 0.7 }}>(fired)</span>}
                  </span>
                </div>
              )}
            </div>
          </>
        ) : (
          <button onClick={() => onEdit(fav)} style={{
            background: "none", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", gap: 6,
            color: t.textMuted, fontSize: 11, padding: 0,
            transition: "color .15s",
          }}
            onMouseEnter={e => e.currentTarget.style.color = t.accentPrimary}
            onMouseLeave={e => e.currentTarget.style.color = t.textMuted}>
            <BellOff size={11} />
            <span>No alert set — click to add</span>
          </button>
        )}
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   MAIN PAGE
══════════════════════════════════════════════════ */
const Favorites = () => {
  useAuthGuard();
  const { isDark, theme } = useTheme();
  const t        = tokens(theme);
  const navigate = useNavigate();

  const { toasts, notify, dismiss } = useAlertNotifications();
  const {
    favorites, prices, loading,
    addFavorite, removeFavorite, updateAlert,
    refreshPrices,
  } = useFavorites(notify);

  const [editFav,   setEditFav]   = useState(null);
  const [filter,    setFilter]    = useState("ALL");    // ALL | ALERTS | TRIGGERED
  const [search,    setSearch]    = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const goAnalyze = useCallback((sym) => navigate(`/analyze?symbol=${sym}`), [navigate]);

  const handleSaveAlert = useCallback(async (alertAbove, alertBelow) => {
    if (!editFav) return;
    await updateAlert(editFav.symbol, alertAbove, alertBelow);
    setEditFav(null);
  }, [editFav, updateAlert]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshPrices();
    setTimeout(() => setRefreshing(false), 800);
  }, [refreshPrices]);

  /* ── Filtered list ── */
  const filtered = favorites
    .filter(fav => {
      if (search) return fav.symbol.includes(search.toUpperCase());
      return true;
    })
    .filter(fav => {
      if (filter === "ALERTS") return fav.alertAbove != null || fav.alertBelow != null;
      if (filter === "TRIGGERED") {
        const p = prices[fav.symbol]?.price;
        if (!p) return false;
        return (
          (fav.alertAbove != null && Number(p) > fav.alertAbove) ||
          (fav.alertBelow != null && Number(p) < fav.alertBelow)
        );
      }
      return true;
    });

  /* ── Stats ── */
  const totalAlerts   = favorites.filter(f => f.alertAbove != null || f.alertBelow != null).length;
  const firedCount    = favorites.filter(f => f.alertFiredAbove || f.alertFiredBelow).length;
  const triggeredNow  = favorites.filter(fav => {
    const p = prices[fav.symbol]?.price;
    if (!p) return false;
    return (fav.alertAbove != null && Number(p) > fav.alertAbove) ||
           (fav.alertBelow != null && Number(p) < fav.alertBelow);
  }).length;

  /* ── Card style helper ── */
  const glassCard = () => ({
    background:           t.cardGradient,
    border:               `1px solid ${t.border}`,
    borderRadius:         22,
    backdropFilter:       "blur(28px) saturate(1.6)",
    WebkitBackdropFilter: "blur(28px) saturate(1.6)",
    boxShadow:            `${t.shadow}, inset 0 1px 0 ${t.glassEdge}`,
    position:             "relative",
    overflow:             "hidden",
  });

  return (
    <>
      <AppShell activePage="/favorites">
        <style>{`
          @keyframes fav-slide-in { from{opacity:0;transform:translateY(-10px)} to{opacity:1;transform:translateY(0)} }
          @keyframes fav-glow     { 0%,100%{opacity:0.55} 50%{opacity:1} }
          @keyframes fav-shimmer  { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
          @keyframes fav-card-in  { from{opacity:0;transform:translateY(16px) scale(0.97)} to{opacity:1;transform:translateY(0) scale(1)} }
        `}</style>

        {/* ══════════════════════
            PAGE HEADER
        ══════════════════════ */}
        <div style={{ marginBottom: 26, animation: "sa-slideUp .45s ease both" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{
                display: "inline-flex", alignItems: "center", gap: 7, marginBottom: 10,
                padding: "4px 14px 4px 9px", borderRadius: 20,
                background: "linear-gradient(90deg,rgba(251,191,36,0.18),rgba(245,158,11,0.08))",
                border: "1px solid rgba(251,191,36,0.30)",
              }}>
                <Star size={12} style={{ color: "#fbbf24" }} />
                <span style={{ fontSize: 11, fontWeight: 600, color: "#fbbf24" }}>
                  {loading ? "Syncing…" : `${favorites.length} stock${favorites.length !== 1 ? "s" : ""} tracked`}
                </span>
              </div>
              <h1 style={{
                margin: 0, fontSize: "clamp(24px,4vw,34px)", fontWeight: 800,
                letterSpacing: "-0.05em", fontFamily: "'Syne',sans-serif",
                color: t.titleColor, lineHeight: 1,
                textShadow: t.isDark ? `0 0 38px ${t.glowPrimary}, 0 2px 6px rgba(0,0,0,0.6)` : "none",
              }}>
                My Favorites
              </h1>
              <p style={{ margin: "6px 0 0", fontSize: 13, color: t.textSecondary }}>
                Live price monitoring with custom price alerts
              </p>
            </div>

            {/* Refresh button */}
            <button onClick={handleRefresh} disabled={refreshing}
              style={{
                display: "flex", alignItems: "center", gap: 7,
                padding: "10px 18px", borderRadius: 13, fontSize: 13, fontWeight: 600,
                background: t.inputBg, border: `1px solid ${t.border}`,
                color: t.textSecondary, cursor: refreshing ? "not-allowed" : "pointer",
                opacity: refreshing ? 0.7 : 1,
                transition: "all .2s",
              }}
              onMouseEnter={e => { if (!refreshing) { e.currentTarget.style.background = `${t.accentPrimary}12`; e.currentTarget.style.borderColor = `${t.accentPrimary}30`; e.currentTarget.style.color = t.accentPrimary; }}}
              onMouseLeave={e => { e.currentTarget.style.background = t.inputBg; e.currentTarget.style.borderColor = t.border; e.currentTarget.style.color = t.textSecondary; }}>
              <RefreshCw size={14} style={{ animation: refreshing ? "spin 1s linear infinite" : "none" }} />
              {refreshing ? "Refreshing…" : "Refresh Prices"}
            </button>
          </div>
        </div>

        {/* ══════════════════════
            STAT CHIPS
        ══════════════════════ */}
        <div style={{ display: "flex", gap: 14, marginBottom: 22, flexWrap: "wrap", animation: "sa-slideUp .45s .06s ease both" }}>
          <StatChip label="Total Favorites"    value={favorites.length} color="#3b82f6"  icon={Star}        t={t} />
          <StatChip label="Alerts Set"         value={totalAlerts}      color="#a78bfa"  icon={Bell}        t={t} />
          <StatChip label="Alerts Fired"       value={firedCount}       color="#fbbf24"  icon={Zap}         t={t} />
          <StatChip label="Triggered Now"      value={triggeredNow}     color="#10b981"  icon={Activity}    t={t} />
        </div>

        {/* ══════════════════════
            FILTER + SEARCH BAR
        ══════════════════════ */}
        <div style={{
          ...glassCard(), padding: "14px 18px", marginBottom: 20,
          animation: "sa-slideUp .45s .1s ease both",
          display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap",
        }}>
          {/* Search */}
          <div style={{ position: "relative", flex: 1, minWidth: 180 }}>
            <Search size={13} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: t.textMuted, pointerEvents: "none" }} />
            <input value={search} onChange={e => setSearch(e.target.value.toUpperCase())}
              placeholder="Search symbol…"
              style={{
                background: t.inputBg, border: `1px solid ${t.inputBorder}`,
                borderRadius: 11, padding: "8px 12px 8px 34px",
                fontSize: 12, color: t.textPrimary, outline: "none",
                width: "100%", boxSizing: "border-box", transition: "border-color .2s",
              }}
              onFocus={e => e.target.style.borderColor = t.inputFocus}
              onBlur={e  => e.target.style.borderColor = t.inputBorder}
            />
          </div>

          {/* Filter chips */}
          <div style={{ display: "flex", gap: 7 }}>
            {[
              { key: "ALL",       label: `All (${favorites.length})` },
              { key: "ALERTS",    label: `With Alerts (${totalAlerts})` },
              { key: "TRIGGERED", label: triggeredNow > 0 ? `Triggered (${triggeredNow}) 🔥` : "Triggered" },
            ].map(({ key, label }) => (
              <button key={key} onClick={() => setFilter(key)}
                style={{
                  padding: "7px 14px", borderRadius: 10, fontSize: 11, fontWeight: 600,
                  background: filter === key ? (key === "TRIGGERED" && triggeredNow > 0 ? "rgba(251,191,36,0.20)" : `${t.accentPrimary}20`) : t.inputBg,
                  border: `1px solid ${filter === key ? (key === "TRIGGERED" && triggeredNow > 0 ? "rgba(251,191,36,0.35)" : t.accentPrimary + "40") : t.border}`,
                  color: filter === key ? (key === "TRIGGERED" && triggeredNow > 0 ? "#fbbf24" : t.accentPrimary) : t.textSecondary,
                  cursor: "pointer", transition: "all .18s",
                  boxShadow: filter === key ? `0 2px 10px ${t.glowPrimary}` : "none",
                }}>
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ══════════════════════
            FAVORITES GRID
        ══════════════════════ */}
        {loading ? (
          /* Skeleton grid */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))", gap: 16, marginBottom: 20 }}>
            {[1, 2, 3, 4].map(i => (
              <div key={i} style={{ height: 220, borderRadius: 20,
                background: t.cardGradient, border: `1px solid ${t.border}`,
                backgroundSize: "200% 100%", animation: `fav-shimmer 1.4s ease-in-out ${i * .12}s infinite` }} />
            ))}
          </div>
        ) : filtered.length > 0 ? (
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill,minmax(280px,1fr))",
            gap: 16, marginBottom: 22,
          }}>
            {filtered.map((fav, i) => (
              <div key={fav._id || fav.symbol}
                style={{ animation: `fav-card-in .4s cubic-bezier(.22,1,.36,1) ${i * .055}s both` }}>
                <FavCard
                  fav={fav}
                  priceData={prices[fav.symbol]}
                  onRemove={removeFavorite}
                  onEdit={setEditFav}
                  onAnalyze={goAnalyze}
                  t={t}
                />
              </div>
            ))}
          </div>
        ) : (
          /* Empty state */
          <div style={{ ...glassCard(), padding: "56px 24px", textAlign: "center", marginBottom: 22 }}>
            <div style={{
              width: 64, height: 64, borderRadius: 20, margin: "0 auto 18px",
              background: `${t.accentPrimary}14`, border: `1px solid ${t.accentPrimary}22`,
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: `0 8px 26px ${t.glowPrimary}`,
            }}>
              <Star size={26} style={{ color: t.accentPrimary, opacity: 0.7 }} />
            </div>
            <p style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: t.textPrimary }}>
              {search || filter !== "ALL" ? "No matches found" : "No favorites yet"}
            </p>
            <p style={{ margin: "0 0 20px", fontSize: 13, color: t.textSecondary }}>
              {search
                ? `No stock matching "${search}"`
                : filter !== "ALL"
                  ? "Try changing the filter above"
                  : "Add your first stock using the form below"}
            </p>
            {filter !== "ALL" && (
              <button onClick={() => { setFilter("ALL"); setSearch(""); }}
                style={{
                  padding: "9px 20px", borderRadius: 11, fontSize: 12, fontWeight: 600,
                  background: `${t.accentPrimary}16`, border: `1px solid ${t.accentPrimary}28`,
                  color: t.accentPrimary, cursor: "pointer",
                }}>
                Clear filters
              </button>
            )}
          </div>
        )}

        {/* ══════════════════════
            ADD FORM
        ══════════════════════ */}
        <div style={{ animation: "sa-slideUp .45s .2s ease both" }}>
          <AddForm onAdd={addFavorite} t={t} isDark={isDark} />
        </div>
      </AppShell>

      {/* Edit modal (outside AppShell so it overlays properly) */}
      {editFav && (
        <EditModal
          fav={editFav}
          prices={prices}
          onSave={handleSaveAlert}
          onClose={() => setEditFav(null)}
          t={t}
        />
      )}

      {/* Alert toast notifications */}
      <NotificationStack toasts={toasts} onDismiss={dismiss} theme={t} />
    </>
  );
};

export default Favorites;