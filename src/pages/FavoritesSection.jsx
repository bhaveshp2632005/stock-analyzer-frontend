/**
 * components/FavoritesSection.jsx
 * ──────────────────────────────────────────────────────────────
 * "My Favorites" dashboard section.
 * Matches existing 3D glassmorphism design — no style changes.
 * All data from useFavorites hook (backend-connected).
 *
 * Exports:
 *   default FavoritesSection  — the main dashboard section
 *   StarButton                — reusable button for Analyze page
 */

import React, { useState, useCallback } from "react";
import {
  Star, Bell, Plus, Trash2, TrendingUp, TrendingDown,
  ArrowUpRight, ArrowDownRight, RefreshCw,
  X, Check, Edit3, AlertTriangle,
} from "lucide-react";

const fmt = (price, currency) => {
  if (price == null || price === "") return "—";
  return currency === "INR"
    ? "₹" + Number(price).toLocaleString("en-IN", { minimumFractionDigits: 2 })
    : "$" + Number(price).toFixed(2);
};

/* ══════════════════════════════════════════════════
   ADD FORM — collapsible inline
══════════════════════════════════════════════════ */
const AddForm = ({ onAdd, t }) => {
  const [open,  setOpen]  = useState(false);
  const [sym,   setSym]   = useState("");
  const [above, setAbove] = useState("");
  const [below, setBelow] = useState("");
  const [err,   setErr]   = useState("");
  const [busy,  setBusy]  = useState(false);

  const inp = {
    background:t.inputBg, border:`1px solid ${t.inputBorder}`,
    borderRadius:10, padding:"8px 12px", fontSize:12,
    color:t.textPrimary, outline:"none",
    width:"100%", boxSizing:"border-box",
    transition:"border-color .2s, box-shadow .2s",
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
    if (r?.ok === false) { setErr(r.error || "Failed"); return; }
    setSym(""); setAbove(""); setBelow(""); setOpen(false);
  };

  if (!open) return (
    <button onClick={() => setOpen(true)} style={{
      display:"flex", alignItems:"center", gap:7,
      padding:"8px 14px", borderRadius:12,
      background:`${t.accentPrimary}12`,
      border:`1px dashed ${t.accentPrimary}40`,
      color:t.accentPrimary, cursor:"pointer",
      fontSize:12, fontWeight:600,
      transition:"all .2s", width:"100%", justifyContent:"center",
    }}
      onMouseEnter={e => { e.currentTarget.style.background=`${t.accentPrimary}20`; e.currentTarget.style.borderStyle="solid"; }}
      onMouseLeave={e => { e.currentTarget.style.background=`${t.accentPrimary}12`; e.currentTarget.style.borderStyle="dashed"; }}>
      <Plus size={14}/> Add to Favorites
    </button>
  );

  return (
    <div style={{ borderRadius:14, padding:14,
      background:`${t.accentPrimary}08`,
      border:`1px solid ${t.accentPrimary}28`,
      animation:"fav-in .25s cubic-bezier(.22,1,.36,1)" }}>
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:10 }}>
        <span style={{ fontSize:12,fontWeight:700,color:t.textPrimary }}>Add Favorite Stock</span>
        <button onClick={() => { setOpen(false); setErr(""); }}
          style={{ background:"none",border:"none",cursor:"pointer",color:t.textMuted,padding:2 }}>
          <X size={13}/>
        </button>
      </div>

      {/* Symbol input */}
      <input value={sym} onChange={e => setSym(e.target.value.toUpperCase())}
        onKeyDown={e => e.key === "Enter" && handleAdd()}
        placeholder="e.g. AAPL, RELIANCE.NS, TSLA"
        style={{ ...inp, marginBottom:8, fontWeight:700, letterSpacing:"0.02em" }}
        onFocus={e => { e.target.style.borderColor=t.inputFocus; e.target.style.boxShadow=`0 0 0 3px ${t.accentPrimary}15`; }}
        onBlur={e  => { e.target.style.borderColor=t.inputBorder; e.target.style.boxShadow="none"; }}
      />

      {/* Alert thresholds */}
      <div style={{ display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginBottom:10 }}>
        <div>
          <label style={{ fontSize:10,color:"#10b981",fontWeight:700,display:"block",marginBottom:4 }}>
            🔺 Alert Above (optional)
          </label>
          <input value={above} onChange={e => setAbove(e.target.value)} type="number"
            placeholder="Price" style={{ ...inp, fontSize:11 }}
            onFocus={e => { e.target.style.borderColor="#10b981"; e.target.style.boxShadow="0 0 0 3px rgba(16,185,129,0.12)"; }}
            onBlur={e  => { e.target.style.borderColor=t.inputBorder; e.target.style.boxShadow="none"; }}
          />
        </div>
        <div>
          <label style={{ fontSize:10,color:"#f87171",fontWeight:700,display:"block",marginBottom:4 }}>
            🔻 Alert Below (optional)
          </label>
          <input value={below} onChange={e => setBelow(e.target.value)} type="number"
            placeholder="Price" style={{ ...inp, fontSize:11 }}
            onFocus={e => { e.target.style.borderColor="#f87171"; e.target.style.boxShadow="0 0 0 3px rgba(248,113,113,0.12)"; }}
            onBlur={e  => { e.target.style.borderColor=t.inputBorder; e.target.style.boxShadow="none"; }}
          />
        </div>
      </div>

      {err && (
        <p style={{ margin:"0 0 8px",fontSize:11,color:"#f87171",
          display:"flex",alignItems:"center",gap:5 }}>
          <AlertTriangle size={11}/>{err}
        </p>
      )}

      <div style={{ display:"flex",gap:7 }}>
        <button onClick={handleAdd} disabled={busy} style={{
          flex:1, padding:"8px", borderRadius:10, fontSize:12, fontWeight:700,
          background:t.gradientBtn||t.gradient, border:"none", color:"#fff",
          cursor:busy?"not-allowed":"pointer",
          boxShadow:`0 4px 14px ${t.glowPrimary}`,
          display:"flex",alignItems:"center",justifyContent:"center",gap:6,
          opacity:busy?0.7:1, transition:"opacity .2s",
        }}>
          {busy
            ? <RefreshCw size={12} style={{ animation:"spin 1s linear infinite" }}/>
            : <Star size={12}/>}
          {busy ? "Adding…" : "Add to Favorites"}
        </button>
        <button onClick={() => { setOpen(false); setErr(""); }}
          style={{ padding:"8px 12px",borderRadius:10,fontSize:12,
            background:t.inputBg,border:`1px solid ${t.border}`,
            color:t.textSecondary,cursor:"pointer" }}>
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
  const [above, setAbove] = useState(fav.alertAbove  ?? "");
  const [below, setBelow] = useState(fav.alertBelow  ?? "");
  const [busy,  setBusy]  = useState(false);

  const inp = {
    background:t.inputBg, border:`1px solid ${t.inputBorder}`,
    borderRadius:10, padding:"9px 12px", fontSize:13,
    color:t.textPrimary, outline:"none",
    width:"100%", boxSizing:"border-box",
    transition:"border-color .2s, box-shadow .2s",
  };

  const handleSave = async () => {
    setBusy(true);
    await onSave(
      above !== "" ? Number(above) : null,
      below !== "" ? Number(below) : null,
    );
    setBusy(false);
  };

  return (
    <div style={{ position:"fixed",inset:0,zIndex:1000,
      background:"rgba(0,0,0,0.65)",
      backdropFilter:"blur(10px)",WebkitBackdropFilter:"blur(10px)",
      display:"flex",alignItems:"center",justifyContent:"center",
      padding:20, animation:"sa-fadeIn .2s ease" }}
      onClick={e => e.target===e.currentTarget && onClose()}>

      <div style={{ width:"100%",maxWidth:370,borderRadius:20,
        background:t.modalBg||(t.isDark?"#080d20":"#ffffff"),
        border:`1px solid ${t.border}`,
        boxShadow:`0 24px 80px rgba(0,0,0,0.5), inset 0 1px 0 ${t.glassEdge}`,
        padding:24, animation:"fav-in .3s cubic-bezier(.22,1,.36,1)",
        position:"relative" }}>

        <button onClick={onClose} style={{
          position:"absolute",top:16,right:16,width:28,height:28,borderRadius:8,
          background:t.inputBg,border:`1px solid ${t.border}`,
          color:t.textMuted,cursor:"pointer",
          display:"flex",alignItems:"center",justifyContent:"center" }}>
          <X size={13}/>
        </button>

        {/* Header */}
        <div style={{ display:"flex",alignItems:"center",gap:10,marginBottom:20 }}>
          <div style={{ width:40,height:40,borderRadius:12,
            background:`linear-gradient(135deg,${t.accentPrimary}28,${t.accentSecond}12)`,
            border:`1px solid ${t.accentPrimary}35`,
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:`0 4px 14px ${t.glowPrimary}` }}>
            <Bell size={18} style={{ color:t.accentPrimary }}/>
          </div>
          <div>
            <p style={{ margin:0,fontSize:16,fontWeight:800,color:t.textPrimary,
              fontFamily:"'Syne',sans-serif" }}>{fav.symbol}</p>
            {pd && (
              <p style={{ margin:0,fontSize:11,color:t.textSecondary }}>
                Current:{" "}
                <strong style={{ color:t.textPrimary }}>{fmt(pd.price,pd.currency)}</strong>
                {pd.changePercent && (
                  <span style={{ marginLeft:6, color: Number(pd.changePercent) >= 0 ? "#34d399" : "#f87171" }}>
                    ({Number(pd.changePercent) >= 0 ? "+" : ""}{pd.changePercent}%)
                  </span>
                )}
              </p>
            )}
          </div>
        </div>

        {/* Alert Above */}
        <div style={{ marginBottom:14 }}>
          <label style={{ fontSize:11,fontWeight:700,color:"#10b981",
            display:"flex",alignItems:"center",gap:5,marginBottom:6 }}>
            <TrendingUp size={12}/> Alert when price goes ABOVE
          </label>
          <input value={above} onChange={e => setAbove(e.target.value)} type="number"
            placeholder="Enter price — leave blank to disable"
            style={inp}
            onFocus={e => { e.target.style.borderColor="#10b981"; e.target.style.boxShadow="0 0 0 3px rgba(16,185,129,0.14)"; }}
            onBlur={e  => { e.target.style.borderColor=t.inputBorder; e.target.style.boxShadow="none"; }}
          />
        </div>

        {/* Alert Below */}
        <div style={{ marginBottom:18 }}>
          <label style={{ fontSize:11,fontWeight:700,color:"#f87171",
            display:"flex",alignItems:"center",gap:5,marginBottom:6 }}>
            <TrendingDown size={12}/> Alert when price goes BELOW
          </label>
          <input value={below} onChange={e => setBelow(e.target.value)} type="number"
            placeholder="Enter price — leave blank to disable"
            style={inp}
            onFocus={e => { e.target.style.borderColor="#f87171"; e.target.style.boxShadow="0 0 0 3px rgba(248,113,113,0.14)"; }}
            onBlur={e  => { e.target.style.borderColor=t.inputBorder; e.target.style.boxShadow="none"; }}
          />
        </div>

        <p style={{ fontSize:10,color:t.textMuted,margin:"0 0 16px",lineHeight:1.5 }}>
          💡 Saving resets the alert — it will fire again when the new threshold is crossed.
          Alert state is stored in the database and persists across sessions.
        </p>

        <div style={{ display:"flex",gap:8 }}>
          <button onClick={handleSave} disabled={busy} style={{
            flex:1,padding:"10px",borderRadius:12,fontSize:13,fontWeight:700,
            background:t.gradientBtn||t.gradient,border:"none",color:"#fff",
            cursor:busy?"not-allowed":"pointer",
            boxShadow:`0 4px 14px ${t.glowPrimary}`,
            display:"flex",alignItems:"center",justifyContent:"center",gap:6,
            opacity:busy?0.7:1,
          }}>
            {busy
              ? <RefreshCw size={13} style={{ animation:"spin 1s linear infinite" }}/>
              : <Check size={13}/>}
            {busy ? "Saving…" : "Save Alert"}
          </button>
          <button onClick={onClose}
            style={{ padding:"10px 16px",borderRadius:12,fontSize:13,
              background:t.inputBg,border:`1px solid ${t.border}`,
              color:t.textSecondary,cursor:"pointer" }}>
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   FAVORITE ROW
══════════════════════════════════════════════════ */
const FavRow = ({ fav, priceData, onRemove, onEdit, onAnalyze, t }) => {
  const [hov, setHov] = useState(false);

  const price    = priceData?.price;
  const currency = priceData?.currency || (fav.symbol.includes(".NS") ? "INR" : "USD");
  const chg      = priceData ? Number(priceData.changePercent) : null;
  const isUp     = chg != null ? chg >= 0 : true;

  const hasAlert  = fav.alertAbove != null || fav.alertBelow != null;
  const aboveTrig = fav.alertAbove != null && price != null && Number(price) > fav.alertAbove;
  const belowTrig = fav.alertBelow != null && price != null && Number(price) < fav.alertBelow;
  const triggered = aboveTrig || belowTrig;

  // Show "fired" state from DB flags
  const firedAbove = fav.alertFiredAbove;
  const firedBelow = fav.alertFiredBelow;
  const anyFired   = firedAbove || firedBelow;

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display:"flex", alignItems:"center", gap:10,
        padding:"11px 14px", borderRadius:14,
        background: hov ? `${t.accentPrimary}0c` : t.inputBg,
        border:`1px solid ${
          triggered
            ? aboveTrig ? "#10b98138" : "#f8717138"
            : hov ? `${t.accentPrimary}28` : t.border
        }`,
        transition:"all .18s cubic-bezier(.22,1,.36,1)",
        transform: hov ? "translateX(3px)" : "none",
        boxShadow: triggered
          ? `0 0 18px ${aboveTrig ? "rgba(16,185,129,0.14)" : "rgba(248,113,113,0.14)"}`
          : "none",
        position:"relative", overflow:"hidden",
      }}>

      {/* triggered glow bar */}
      {triggered && (
        <div style={{ position:"absolute",left:0,top:0,bottom:0,width:3,
          background: aboveTrig ? "#10b981" : "#f87171",
          borderRadius:"14px 0 0 14px",
          boxShadow:`0 0 8px ${aboveTrig ? "#10b981" : "#f87171"}`,
          animation:"fav-glow 2s ease-in-out infinite" }}/>
      )}

      {/* symbol avatar */}
      <div style={{ width:34,height:34,borderRadius:10,flexShrink:0,
        background:`linear-gradient(135deg,${t.accentPrimary}22,${t.accentSecond}10)`,
        border:`1px solid ${t.accentPrimary}28`,
        display:"flex",alignItems:"center",justifyContent:"center",
        fontSize:9,fontWeight:800,color:t.accentPrimary,
        letterSpacing:"0.02em" }}>
        {fav.symbol.replace(".NS","").replace(".BO","").slice(0,3)}
      </div>

      {/* symbol + alert thresholds */}
      <div style={{ flex:1,minWidth:0 }}>
        <div style={{ display:"flex",alignItems:"center",gap:6,flexWrap:"wrap" }}>
          {/* clickable symbol → Analyze page */}
          <button onClick={() => onAnalyze(fav.symbol)} style={{
            background:"none",border:"none",padding:0,cursor:"pointer",
            fontSize:12,fontWeight:800,color:t.textPrimary,
            fontFamily:"'Syne',sans-serif",
            transition:"color .15s",
          }}
            onMouseEnter={e => e.currentTarget.style.color=t.accentPrimary}
            onMouseLeave={e => e.currentTarget.style.color=t.textPrimary}>
            {fav.symbol}
          </button>

          {/* alert status badge */}
          {hasAlert && (
            <span style={{
              fontSize:9,padding:"1px 5px",borderRadius:8,fontWeight:700,
              background: anyFired
                ? "rgba(251,191,36,0.18)"
                : triggered
                  ? "rgba(251,191,36,0.18)"
                  : "rgba(168,139,250,0.14)",
              color: (anyFired || triggered) ? "#fbbf24" : "#a78bfa",
              border:`1px solid ${(anyFired || triggered) ? "rgba(251,191,36,0.28)" : "rgba(168,139,250,0.22)"}`,
              display:"flex",alignItems:"center",gap:3,
              animation:(anyFired||triggered)?"fav-glow 1.5s ease-in-out infinite":"none",
            }}>
              <Bell size={8}/>
              {anyFired ? "FIRED" : triggered ? "TRIGGERED" : "SET"}
            </span>
          )}
        </div>

        {/* threshold pills */}
        {hasAlert && (
          <div style={{ display:"flex",gap:7,marginTop:3,flexWrap:"wrap" }}>
            {fav.alertAbove != null && (
              <span style={{ fontSize:9,color:"#10b981",display:"flex",alignItems:"center",gap:2,
                opacity: firedAbove ? 0.5 : 1 }}>
                <TrendingUp size={8}/>
                ↑ {fmt(fav.alertAbove,currency)}
                {firedAbove && <span style={{ fontSize:8,marginLeft:2,opacity:0.7 }}>(fired)</span>}
              </span>
            )}
            {fav.alertBelow != null && (
              <span style={{ fontSize:9,color:"#f87171",display:"flex",alignItems:"center",gap:2,
                opacity: firedBelow ? 0.5 : 1 }}>
                <TrendingDown size={8}/>
                ↓ {fmt(fav.alertBelow,currency)}
                {firedBelow && <span style={{ fontSize:8,marginLeft:2,opacity:0.7 }}>(fired)</span>}
              </span>
            )}
          </div>
        )}
      </div>

      {/* live price + change */}
      <div style={{ textAlign:"right",flexShrink:0,minWidth:68 }}>
        {!priceData ? (
          <div style={{ display:"flex",flexDirection:"column",gap:4,alignItems:"flex-end" }}>
            <div style={{ width:46,height:8,borderRadius:3,background:t.inputBg,
              backgroundSize:"200% 100%",animation:"fav-shimmer 1.4s ease-in-out infinite" }}/>
            <div style={{ width:32,height:6,borderRadius:3,background:t.inputBg,
              backgroundSize:"200% 100%",animation:"fav-shimmer 1.4s ease-in-out .15s infinite" }}/>
          </div>
        ) : (
          <>
            <p style={{ margin:0,fontSize:12,fontWeight:700,color:t.textPrimary }}>
              {fmt(price,currency)}
            </p>
            <p style={{ margin:0,fontSize:10,fontWeight:700,
              color:isUp?"#34d399":"#f87171",
              display:"flex",alignItems:"center",justifyContent:"flex-end",gap:1 }}>
              {isUp ? <ArrowUpRight size={9}/> : <ArrowDownRight size={9}/>}
              {chg != null ? chg + "%" : "—"}
            </p>
          </>
        )}
      </div>

      {/* action buttons — revealed on hover */}
      <div style={{ display:"flex",gap:4,flexShrink:0,
        opacity:hov?1:0, transition:"opacity .18s",
        pointerEvents:hov?"all":"none" }}>
        <button onClick={() => onEdit(fav)} title="Edit price alerts"
          style={{ width:26,height:26,borderRadius:7,
            background:`${t.accentPrimary}18`,border:`1px solid ${t.accentPrimary}28`,
            color:t.accentPrimary,cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",
            transition:"background .15s" }}
          onMouseEnter={e => e.currentTarget.style.background=`${t.accentPrimary}30`}
          onMouseLeave={e => e.currentTarget.style.background=`${t.accentPrimary}18`}>
          <Edit3 size={11}/>
        </button>
        <button onClick={() => onRemove(fav.symbol)} title="Remove from favorites"
          style={{ width:26,height:26,borderRadius:7,
            background:"rgba(248,113,113,0.10)",
            border:"1px solid rgba(248,113,113,0.20)",
            color:"#f87171",cursor:"pointer",
            display:"flex",alignItems:"center",justifyContent:"center",
            transition:"background .15s" }}
          onMouseEnter={e => e.currentTarget.style.background="rgba(248,113,113,0.22)"}
          onMouseLeave={e => e.currentTarget.style.background="rgba(248,113,113,0.10)"}>
          <Trash2 size={11}/>
        </button>
      </div>
    </div>
  );
};

/* ══════════════════════════════════════════════════
   MAIN SECTION
══════════════════════════════════════════════════ */
const FavoritesSection = ({
  favorites, prices, loading,
  addFavorite, removeFavorite, updateAlert,
  isDark, t, onAnalyze, onRefresh,
}) => {
  const [editFav, setEditFav] = useState(null);

  const handleSaveAlert = useCallback(async (alertAbove, alertBelow) => {
    if (!editFav) return;
    await updateAlert(editFav.symbol, alertAbove, alertBelow);
    setEditFav(null);
  }, [editFav, updateAlert]);

  // Count currently-triggered alerts (price has crossed threshold right now)
  const triggeredCount = favorites.filter(fav => {
    const p = prices[fav.symbol]?.price;
    if (p == null) return false;
    return (
      (fav.alertAbove != null && Number(p) > fav.alertAbove) ||
      (fav.alertBelow != null && Number(p) < fav.alertBelow)
    );
  }).length;

  return (
    <>
      <style>{`
        @keyframes fav-in     { from{opacity:0;transform:translateY(-8px)} to{opacity:1;transform:translateY(0)} }
        @keyframes fav-glow   { 0%,100%{opacity:0.55} 50%{opacity:1} }
        @keyframes fav-shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
      `}</style>

      {/* ── Section header ── */}
      <div style={{ display:"flex",alignItems:"center",justifyContent:"space-between",
        marginBottom:14,flexWrap:"wrap",gap:8 }}>
        <div style={{ display:"flex",alignItems:"center",gap:10 }}>
          {/* Icon */}
          <div style={{ width:34,height:34,borderRadius:11,
            background:"linear-gradient(135deg,rgba(251,191,36,0.26),rgba(245,158,11,0.12))",
            border:"1px solid rgba(251,191,36,0.32)",
            display:"flex",alignItems:"center",justifyContent:"center",
            boxShadow:"0 4px 16px rgba(251,191,36,0.22)" }}>
            <Star size={16} style={{ color:"#fbbf24" }}/>
          </div>
          <div>
            <h2 style={{ margin:0,fontSize:16,fontWeight:800,
              fontFamily:"'Syne',sans-serif",color:"#fbbf24",
              textShadow:"0 0 24px rgba(251,191,36,0.48)" }}>
              My Favorites
            </h2>
            <span style={{ fontSize:10,color:t.textMuted }}>
              {loading
                ? "Syncing with database…"
                : `${favorites.length} stock${favorites.length!==1?"s":""} · DB-backed · Live prices`}
            </span>
          </div>

          {/* triggered badge */}
          {triggeredCount > 0 && (
            <span style={{ fontSize:10,padding:"3px 9px",borderRadius:10,fontWeight:700,
              background:"rgba(251,191,36,0.18)",color:"#fbbf24",
              border:"1px solid rgba(251,191,36,0.32)",
              display:"flex",alignItems:"center",gap:4,
              animation:"fav-glow 1.5s ease-in-out infinite",
              boxShadow:"0 0 14px rgba(251,191,36,0.28)" }}>
              <Bell size={10}/> {triggeredCount} alert{triggeredCount!==1?"s":""} triggered
            </span>
          )}
        </div>

        {/* Refresh button */}
        {onRefresh && (
          <button onClick={onRefresh} title="Refresh prices & check alerts"
            style={{ padding:"6px 10px",borderRadius:9,fontSize:11,
              background:t.inputBg,border:`1px solid ${t.border}`,
              color:t.textSecondary,cursor:"pointer",
              display:"flex",alignItems:"center",gap:5,
              transition:"all .18s" }}
            onMouseEnter={e => {
              e.currentTarget.style.background=`${t.accentPrimary}12`;
              e.currentTarget.style.borderColor=`${t.accentPrimary}28`;
              e.currentTarget.style.color=t.accentPrimary;
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background=t.inputBg;
              e.currentTarget.style.borderColor=t.border;
              e.currentTarget.style.color=t.textSecondary;
            }}>
            <RefreshCw size={11}/> Refresh
          </button>
        )}
      </div>

      {/* ── Loading skeleton ── */}
      {loading && (
        <div style={{ display:"flex",flexDirection:"column",gap:7,marginBottom:12 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ height:52,borderRadius:14,
              background:t.inputBg,backgroundSize:"200% 100%",
              animation:`fav-shimmer 1.4s ease-in-out ${i*.12}s infinite` }}/>
          ))}
        </div>
      )}

      {/* ── Favorite rows ── */}
      {!loading && favorites.length > 0 && (
        <div style={{ display:"flex",flexDirection:"column",gap:7,marginBottom:12 }}>
          {favorites.map(fav => (
            <FavRow
              key={fav._id || fav.symbol}
              fav={fav}
              priceData={prices[fav.symbol]}
              onRemove={removeFavorite}
              onEdit={setEditFav}
              onAnalyze={onAnalyze}
              t={t}
            />
          ))}
        </div>
      )}

      {/* ── Empty state ── */}
      {!loading && favorites.length === 0 && (
        <div style={{ textAlign:"center",padding:"24px 0 16px" }}>
          <Star size={26} style={{ display:"block",margin:"0 auto 10px",
            color:t.textMuted, opacity:0.35 }}/>
          <p style={{ margin:"0 0 3px",fontWeight:600,color:t.textSecondary,fontSize:13 }}>
            No favorites yet
          </p>
          <p style={{ margin:0,fontSize:11,color:t.textMuted }}>
            Add stocks to monitor live prices and set price alerts
          </p>
        </div>
      )}

      {/* ── Add form ── */}
      <AddForm onAdd={addFavorite} t={t}/>

      {/* ── Edit alert modal ── */}
      {editFav && (
        <EditModal
          fav={editFav}
          prices={prices}
          onSave={handleSaveAlert}
          onClose={() => setEditFav(null)}
          t={t}
        />
      )}
    </>
  );
};

export default FavoritesSection;

/* ── StarButton — for Analyze page integration ── */
export const StarButton = ({ symbol, isFavorite, onAdd, onRemove, t }) => {
  const [hov, setHov] = useState(false);
  const active = isFavorite(symbol);
  return (
    <button
      onClick={() => active ? onRemove(symbol) : onAdd(symbol)}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      title={active ? "Remove from favorites" : "Add to favorites"}
      style={{
        display:"flex",alignItems:"center",gap:6,
        padding:"7px 13px",borderRadius:11,fontSize:12,fontWeight:600,
        background: active ? "rgba(251,191,36,0.14)" : (hov ? `${t.accentPrimary}12` : t.inputBg),
        border:`1px solid ${active ? "rgba(251,191,36,0.32)" : (hov ? `${t.accentPrimary}28` : t.border)}`,
        color: active ? "#fbbf24" : (hov ? t.accentPrimary : t.textSecondary),
        cursor:"pointer",
        boxShadow: active ? "0 2px 12px rgba(251,191,36,0.20)" : "none",
        transition:"all .2s cubic-bezier(.22,1,.36,1)",
      }}>
      <Star size={13} style={{ fill:active?"#fbbf24":"none", strokeWidth:2 }}/>
      {active ? "Favorited" : "Add to Favorites"}
    </button>
  );
};