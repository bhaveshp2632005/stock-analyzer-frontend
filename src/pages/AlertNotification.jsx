/**
 * components/AlertNotification.jsx
 * ─────────────────────────────────────────────────────────────
 * Toast notification stack for price alerts.
 * Matches existing 3D glassmorphism design system.
 *
 * Exports:
 *   NotificationStack  — renders the fixed toast container
 *   useAlertNotifications — hook to manage toast list
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { TrendingUp, TrendingDown, X } from "lucide-react";

const TOAST_DURATION = 8000;
const MAX_TOASTS     = 5;

const fmt = (price, currency) =>
  currency === "INR"
    ? "₹" + Number(price).toLocaleString("en-IN", { minimumFractionDigits: 2 })
    : "$" + Number(price).toFixed(2);

/* ── Single Toast ── */
const Toast = ({ toast, onDismiss, theme }) => {
  const [exiting, setExiting] = useState(false);
  const timerRef = useRef(null);
  const isAbove  = toast.condition === "above";
  const acc      = isAbove ? "#10b981" : "#f87171";
  const Icon     = isAbove ? TrendingUp : TrendingDown;

  const dismiss = useCallback(() => {
    setExiting(true);
    setTimeout(() => onDismiss(toast.id), 320);
  }, [toast.id, onDismiss]);

  useEffect(() => {
    timerRef.current = setTimeout(dismiss, TOAST_DURATION);
    return () => clearTimeout(timerRef.current);
  }, [dismiss]);

  return (
    <div style={{
      display:"flex", alignItems:"flex-start", gap:12,
      padding:"14px 16px", borderRadius:16,
      background: theme?.isDark ? "rgba(10,15,38,0.97)" : "rgba(255,255,255,0.98)",
      border:`1px solid ${acc}38`,
      boxShadow:[
        "0 20px 60px rgba(0,0,0,0.40)",
        `0 0 0 1px ${acc}12`,
        "inset 0 1px 0 rgba(255,255,255,0.10)",
        `0 0 32px ${acc}16`,
      ].join(", "),
      backdropFilter:"blur(28px) saturate(1.8)",
      WebkitBackdropFilter:"blur(28px) saturate(1.8)",
      width:320, maxWidth:"calc(100vw - 32px)",
      position:"relative", overflow:"hidden",
      animation: exiting
        ? "toast-out .3s cubic-bezier(.4,0,1,1) forwards"
        : "toast-in .35s cubic-bezier(.22,1,.36,1) forwards",
    }}>
      {/* left accent bar */}
      <div style={{ position:"absolute",left:0,top:0,bottom:0,width:3,
        background:`linear-gradient(180deg,${acc},${acc}40)`,
        borderRadius:"16px 0 0 16px" }}/>
      {/* countdown bar */}
      <div style={{ position:"absolute",bottom:0,left:0,right:0,height:2,
        background:`${acc}20`, overflow:"hidden" }}>
        <div style={{ height:"100%",
          background:`linear-gradient(90deg,${acc},${acc}70)`,
          animation:`toast-progress ${TOAST_DURATION}ms linear forwards`,
          transformOrigin:"left" }}/>
      </div>
      {/* icon */}
      <div style={{ width:36,height:36,borderRadius:10,flexShrink:0,
        background:`linear-gradient(145deg,${acc}28,${acc}10)`,
        border:`1px solid ${acc}40`,
        display:"flex",alignItems:"center",justifyContent:"center",
        boxShadow:`0 4px 14px ${acc}30`, marginTop:1 }}>
        <Icon size={16} style={{ color:acc }}/>
      </div>
      {/* content */}
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:6,marginBottom:3 }}>
          <span style={{ fontSize:13,fontWeight:800,color:acc,fontFamily:"'Syne',sans-serif" }}>
            {toast.symbol}
          </span>
          <span style={{ fontSize:9,padding:"1px 6px",borderRadius:10,fontWeight:700,
            background:`${acc}18`,color:acc,border:`1px solid ${acc}28` }}>
            PRICE ALERT
          </span>
        </div>
        <p style={{ margin:0,fontSize:12,fontWeight:600,lineHeight:1.4,
          color: theme?.isDark?"#FFFFFF":"#0A1628" }}>
          Price {isAbove?"rose above":"dropped below"}{" "}
          <span style={{ color:acc }}>{fmt(toast.threshold,toast.currency)}</span>
        </p>
        <p style={{ margin:"4px 0 0",fontSize:11,
          color: theme?.isDark?"#A8C0E8":"#2A4068" }}>
          Current:{" "}
          <strong style={{ color:theme?.isDark?"#FFFFFF":"#0A1628" }}>
            {fmt(toast.price,toast.currency)}
          </strong>
        </p>
      </div>
      {/* dismiss button */}
      <button onClick={dismiss} style={{
        width:22,height:22,borderRadius:6,flexShrink:0,
        background:"rgba(255,255,255,0.08)",
        border:"1px solid rgba(255,255,255,0.12)",
        color: theme?.isDark?"#A8C0E8":"#4A6890",
        cursor:"pointer",display:"flex",alignItems:"center",
        justifyContent:"center",padding:0,transition:"all .15s",marginTop:1,
      }}
        onMouseEnter={e => { e.currentTarget.style.background="rgba(248,113,113,0.18)"; e.currentTarget.style.color="#f87171"; }}
        onMouseLeave={e => { e.currentTarget.style.background="rgba(255,255,255,0.08)"; e.currentTarget.style.color=theme?.isDark?"#A8C0E8":"#4A6890"; }}>
        <X size={12}/>
      </button>
    </div>
  );
};

/* ── Notification Stack ── */
export const NotificationStack = ({ toasts, onDismiss, theme }) => {
  if (!toasts?.length) return null;
  return (
    <>
      <style>{`
        @keyframes toast-in       { from{opacity:0;transform:translateX(110%)} to{opacity:1;transform:translateX(0)} }
        @keyframes toast-out      { from{opacity:1;transform:translateX(0)}    to{opacity:0;transform:translateX(110%)} }
        @keyframes toast-progress { from{transform:scaleX(1)} to{transform:scaleX(0)} }
      `}</style>
      <div style={{ position:"fixed",bottom:24,right:24,zIndex:9999,
        display:"flex",flexDirection:"column",gap:10,
        pointerEvents:"none",alignItems:"flex-end" }}>
        {toasts.map(t => (
          <div key={t.id} style={{ pointerEvents:"all" }}>
            <Toast toast={t} onDismiss={onDismiss} theme={theme}/>
          </div>
        ))}
      </div>
    </>
  );
};

/* ── Hook ── */
export const useAlertNotifications = () => {
  const [toasts,   setToasts]   = useState([]);
  const counterRef = useRef(0);

  const notify = useCallback((alert) => {
    const id = ++counterRef.current;
    setToasts(prev => {
      const next = [...prev, { ...alert, id }];
      return next.length > MAX_TOASTS ? next.slice(-MAX_TOASTS) : next;
    });
  }, []);

  const dismiss = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, notify, dismiss };
};