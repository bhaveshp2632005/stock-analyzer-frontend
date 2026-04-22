import { useEffect, useRef, useCallback, useState } from "react";
import { useTheme } from "../context/ThemeContext.jsx";
import { tokens }   from "../context/theme.js";

/* ─────────────────────────────────────────────────────────────
   PriceChart — Professional candlestick / OHLCV chart
   Features:
     • Candlestick + Wick rendering
     • Volume bars (bottom 18% of chart)
     • Live tick update (last candle morphs in real-time)
     • Crosshair + floating OHLCV tooltip
     • Signal marker (BUY▲ / SELL▼) on last candle
     • Pinch/scroll zoom & pan
     • Light / Dark theme via ThemeContext
     • Smooth resize via ResizeObserver
     • High-DPI (devicePixelRatio) rendering
───────────────────────────────────────────────────────────── */

const PriceChart = ({ data = [], indicators = {}, liveTick = null }) => {
  const { isDark }   = useTheme();
  const t            = tokens(isDark);
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const stateRef     = useRef({
    offset: 0,        // pan offset in candles
    zoom:   1,        // zoom multiplier (1 = fit all)
    mouse:  null,     // {x, y} canvas coords
    drag:   null,     // dragging start offset
    liveData: null,
  });
  const rafRef = useRef(null);

  /* ── merge live tick into last candle ── */
  const getDisplayData = useCallback(() => {
    const live = stateRef.current.liveData;
    if (!live || !data.length) return data;
    const arr  = [...data];
    const last = { ...arr[arr.length - 1] };
    last.close = Number(live.close);
    last.high  = Math.max(Number(last.high), Number(live.close));
    last.low   = Math.min(Number(last.low),  Number(live.close));
    arr[arr.length - 1] = last;
    return arr;
  }, [data]);

  /* ═══════════════════════════════════════════
     DRAW
  ═══════════════════════════════════════════ */
  const draw = useCallback(() => {
    const container = containerRef.current;
    const canvas    = canvasRef.current;
    if (!canvas || !container) return;

    const chartData = getDisplayData();
    if (!chartData.length) return;

    const dpr    = window.devicePixelRatio || 1;
    const W      = container.clientWidth;
    const H      = 420;

    if (canvas.width !== W * dpr || canvas.height !== H * dpr) {
      canvas.width        = W * dpr;
      canvas.height       = H * dpr;
      canvas.style.width  = W + "px";
      canvas.style.height = H + "px";
    }

    const ctx = canvas.getContext("2d");
    ctx.save();
    ctx.scale(dpr, dpr);

    /* theme colours */
    const BG        = isDark ? "#050810"   : "#f8faff";
    const GRID      = isDark ? "#1a2235"   : "#e2e8f0";
    const AXIS_TXT  = isDark ? "#64748b"   : "#94a3b8";
    const GREEN     = "#22c55e";
    const RED       = "#ef4444";
    const BULL_BODY = isDark ? "#22c55e"   : "#16a34a";
    const BEAR_BODY = isDark ? "#ef4444"   : "#dc2626";
    const CROSS     = isDark ? "rgba(148,163,184,0.55)" : "rgba(71,85,105,0.45)";
    const TIP_BG    = isDark ? "rgba(13,18,32,0.96)"   : "rgba(255,255,255,0.97)";
    const TIP_BORD  = isDark ? "rgba(59,130,246,0.35)" : "rgba(59,130,246,0.30)";
    const TIP_TXT   = isDark ? "#f1f5f9"   : "#0f172a";
    const TIP_MUT   = isDark ? "#64748b"   : "#94a3b8";
    const VOL_BULL  = isDark ? "rgba(34,197,94,0.28)"  : "rgba(22,163,74,0.22)";
    const VOL_BEAR  = isDark ? "rgba(239,68,68,0.28)"  : "rgba(220,38,38,0.22)";
    const LIVE_LINE = "rgba(99,102,241,0.55)";

    /* padding */
    const PAD_L = 12, PAD_R = 72, PAD_T = 18, PAD_B = 52;
    const VOL_H = Math.floor(H * 0.16);   // volume section height
    const PRICE_H = H - PAD_T - PAD_B - VOL_H - 6; // usable price area

    /* visible candle window */
    const n       = chartData.length;
    const { offset, zoom } = stateRef.current;
    const visCount = Math.max(5, Math.round(n / zoom));
    const startIdx = Math.max(0, Math.min(n - visCount, Math.round(offset)));
    const endIdx   = Math.min(n, startIdx + visCount);
    const visible  = chartData.slice(startIdx, endIdx);
    if (!visible.length) { ctx.restore(); return; }

    /* price range with 4% padding */
    let maxP = -Infinity, minP = Infinity;
    visible.forEach(d => {
      if (d.high  > maxP) maxP = d.high;
      if (d.low   < minP) minP = d.low;
    });
    const pad4  = (maxP - minP) * 0.06 || maxP * 0.02;
    maxP += pad4; minP -= pad4;
    const priceRange = maxP - minP || 1;

    /* volume range */
    let maxVol = 0;
    visible.forEach(d => { if ((d.volume || 0) > maxVol) maxVol = d.volume || 0; });

    const chartW = W - PAD_L - PAD_R;
    const toY    = p  => PAD_T + PRICE_H - ((p - minP) / priceRange) * PRICE_H;
    const toVolY = v  => H - PAD_B - (maxVol ? (v / maxVol) * VOL_H : 0);
    const toX    = i  => PAD_L + (i + 0.5) * (chartW / visible.length);

    const candleW = Math.max(2, Math.min(20, (chartW / visible.length) * 0.65));

    /* ── Background ── */
    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    /* ── Grid (price) ── */
    const gridTicks = 6;
    ctx.setLineDash([4, 4]);
    ctx.lineWidth   = 0.8;
    for (let i = 0; i <= gridTicks; i++) {
      const p  = minP + (priceRange / gridTicks) * i;
      const y  = toY(p);
      ctx.strokeStyle = GRID;
      ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
      /* price label */
      ctx.fillStyle  = AXIS_TXT;
      ctx.font       = "10px 'SF Mono','Fira Code',monospace";
      ctx.textAlign  = "left";
      ctx.fillText(p >= 1000 ? p.toFixed(1) : p.toFixed(2), W - PAD_R + 7, y + 4);
    }
    ctx.setLineDash([]);

    /* ── Volume separator line ── */
    const volY0 = H - PAD_B - VOL_H;
    ctx.strokeStyle = isDark ? "#1e2d42" : "#cbd5e1";
    ctx.lineWidth   = 0.7;
    ctx.beginPath(); ctx.moveTo(PAD_L, volY0 - 3); ctx.lineTo(W - PAD_R, volY0 - 3); ctx.stroke();

    /* ── Volume bars ── */
    visible.forEach((d, i) => {
      const isUp = d.close >= d.open;
      const x    = toX(i);
      const vTop = toVolY(d.volume || 0);
      const vBot = H - PAD_B;
      ctx.fillStyle = isUp ? VOL_BULL : VOL_BEAR;
      ctx.fillRect(x - candleW / 2, vTop, candleW, vBot - vTop);
    });

    /* ── Candles ── */
    visible.forEach((d, i) => {
      const x      = toX(i);
      const isUp   = d.close >= d.open;
      const color  = isUp ? BULL_BODY : BEAR_BODY;

      /* Wick */
      ctx.strokeStyle = color;
      ctx.lineWidth   = Math.max(1, candleW * 0.15);
      ctx.beginPath();
      ctx.moveTo(x, toY(d.high));
      ctx.lineTo(x, toY(d.low));
      ctx.stroke();

      /* Body */
      const bodyTop = Math.min(toY(d.open), toY(d.close));
      const bodyH   = Math.max(1.5, Math.abs(toY(d.close) - toY(d.open)));

      /* Glow on last candle if live */
      const isLast = (startIdx + i === n - 1) && stateRef.current.liveData;
      if (isLast) {
        ctx.shadowColor = color;
        ctx.shadowBlur  = 10;
      }
      ctx.fillStyle = color;
      /* Rounded rect for wider candles */
      if (candleW >= 6) {
        const r = Math.min(2, candleW * 0.18);
        ctx.beginPath();
        ctx.moveTo(x - candleW/2 + r, bodyTop);
        ctx.lineTo(x + candleW/2 - r, bodyTop);
        ctx.quadraticCurveTo(x + candleW/2, bodyTop, x + candleW/2, bodyTop + r);
        ctx.lineTo(x + candleW/2, bodyTop + bodyH - r);
        ctx.quadraticCurveTo(x + candleW/2, bodyTop + bodyH, x + candleW/2 - r, bodyTop + bodyH);
        ctx.lineTo(x - candleW/2 + r, bodyTop + bodyH);
        ctx.quadraticCurveTo(x - candleW/2, bodyTop + bodyH, x - candleW/2, bodyTop + bodyH - r);
        ctx.lineTo(x - candleW/2, bodyTop + r);
        ctx.quadraticCurveTo(x - candleW/2, bodyTop, x - candleW/2 + r, bodyTop);
        ctx.closePath();
        ctx.fill();
      } else {
        ctx.fillRect(x - candleW / 2, bodyTop, candleW, bodyH);
      }
      ctx.shadowBlur = 0;
    });

    /* ── Live price line ── */
    if (stateRef.current.liveData || visible.length) {
      const lastClose = visible[visible.length - 1].close;
      const ly        = toY(lastClose);
      ctx.setLineDash([5, 5]);
      ctx.strokeStyle = LIVE_LINE;
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.moveTo(PAD_L, ly); ctx.lineTo(W - PAD_R, ly); ctx.stroke();
      ctx.setLineDash([]);
      /* price tag */
      const tag = lastClose >= 1000 ? lastClose.toFixed(1) : lastClose.toFixed(2);
      ctx.fillStyle = "rgba(99,102,241,0.85)";
      const tagW = tag.length * 7 + 10;
      roundRect(ctx, W - PAD_R + 1, ly - 9, tagW, 18, 4);
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font      = "bold 10px 'SF Mono','Fira Code',monospace";
      ctx.textAlign = "left";
      ctx.fillText(tag, W - PAD_R + 7, ly + 4);
    }

    /* ── Signal marker ── */
    if (indicators?.signal && visible.length) {
      const last   = visible[visible.length - 1];
      const x      = toX(visible.length - 1);
      const isBuy  = indicators.signal === "BUY";
      const sigY   = isBuy ? toY(last.low) + 26 : toY(last.high) - 26;
      const sigCol = isBuy ? GREEN : RED;
      const arrow  = isBuy ? "▲" : "▼";
      ctx.fillStyle  = sigCol;
      ctx.shadowColor = sigCol;
      ctx.shadowBlur  = 12;
      ctx.font        = "bold 12px sans-serif";
      ctx.textAlign   = "center";
      ctx.fillText(arrow + " " + indicators.signal, x, sigY);
      ctx.shadowBlur  = 0;
    }

    /* ── X-axis date labels ── */
    ctx.fillStyle  = AXIS_TXT;
    ctx.font       = "10px 'SF Mono','Fira Code',monospace";
    ctx.textAlign  = "center";
    const step = Math.max(1, Math.floor(visible.length / 7));
    visible.forEach((d, i) => {
      if (i % step === 0) {
        const x     = toX(i);
        const label = fmtDate(d.date);
        ctx.fillText(label, x, H - PAD_B + 16);
      }
    });

    /* ── Crosshair + tooltip ── */
    const mouse = stateRef.current.mouse;
    if (mouse && mouse.x >= PAD_L && mouse.x <= W - PAD_R && mouse.y >= PAD_T && mouse.y <= H - PAD_B) {
      /* snap to nearest candle */
      const candleSpan = chartW / visible.length;
      const idx = Math.max(0, Math.min(visible.length - 1, Math.floor((mouse.x - PAD_L) / candleSpan)));
      const cx  = toX(idx);

      /* vertical line */
      ctx.setLineDash([4, 4]);
      ctx.strokeStyle = CROSS;
      ctx.lineWidth   = 1;
      ctx.beginPath(); ctx.moveTo(cx, PAD_T); ctx.lineTo(cx, H - PAD_B); ctx.stroke();
      /* horizontal line */
      ctx.beginPath(); ctx.moveTo(PAD_L, mouse.y); ctx.lineTo(W - PAD_R, mouse.y); ctx.stroke();
      ctx.setLineDash([]);

      /* price on right axis */
      const hoverPrice = maxP - ((mouse.y - PAD_T) / PRICE_H) * priceRange;
      if (hoverPrice >= minP && hoverPrice <= maxP) {
        const hTag = hoverPrice >= 1000 ? hoverPrice.toFixed(1) : hoverPrice.toFixed(2);
        const hTagW = hTag.length * 7 + 10;
        ctx.fillStyle = isDark ? "rgba(51,65,85,0.9)" : "rgba(226,232,240,0.95)";
        roundRect(ctx, W - PAD_R + 1, mouse.y - 9, hTagW, 18, 4); ctx.fill();
        ctx.fillStyle = TIP_TXT;
        ctx.font      = "10px 'SF Mono','Fira Code',monospace";
        ctx.textAlign = "left";
        ctx.fillText(hTag, W - PAD_R + 7, mouse.y + 4);
      }

      /* OHLCV tooltip box */
      const cd     = visible[idx];
      const isUp   = cd.close >= cd.open;
      const change = cd.open ? ((cd.close - cd.open) / cd.open * 100).toFixed(2) : "0.00";
      const lines  = [
        { l:"Date",   v: cd.date || "" },
        { l:"Open",   v: fmt(cd.open)  },
        { l:"High",   v: fmt(cd.high)  },
        { l:"Low",    v: fmt(cd.low)   },
        { l:"Close",  v: fmt(cd.close), bold: true, col: isUp ? GREEN : RED },
        { l:"Change", v: (isUp?"+":"")+change+"%", col: isUp ? GREEN : RED },
        { l:"Volume", v: fmtVol(cd.volume) },
      ];

      const TW = 188, TH = lines.length * 19 + 18, TR = 10;
      let tx = cx + 14;
      if (tx + TW > W - PAD_R - 4) tx = cx - TW - 14;
      let ty = Math.max(PAD_T + 4, Math.min(mouse.y - 20, H - PAD_B - TH - 4));

      /* shadow */
      ctx.shadowColor = "rgba(0,0,0,0.35)";
      ctx.shadowBlur  = 18;
      ctx.fillStyle   = TIP_BG;
      roundRect(ctx, tx, ty, TW, TH, TR); ctx.fill();
      ctx.shadowBlur  = 0;

      /* border */
      ctx.strokeStyle = TIP_BORD;
      ctx.lineWidth   = 1;
      roundRect(ctx, tx, ty, TW, TH, TR); ctx.stroke();

      /* accent bar left edge */
      ctx.fillStyle = isUp ? GREEN : RED;
      roundRect(ctx, tx, ty, 3, TH, [TR, 0, 0, TR]); ctx.fill();

      /* rows */
      lines.forEach((row, ri) => {
        const ry = ty + 14 + ri * 19;
        ctx.fillStyle  = TIP_MUT;
        ctx.font       = `10px 'SF Mono','Fira Code',monospace`;
        ctx.textAlign  = "left";
        ctx.fillText(row.l, tx + 12, ry);
        ctx.fillStyle  = row.col || TIP_TXT;
        ctx.font       = row.bold ? `bold 10px 'SF Mono','Fira Code',monospace` : `10px 'SF Mono','Fira Code',monospace`;
        ctx.textAlign  = "right";
        ctx.fillText(row.v, tx + TW - 10, ry);
      });

      /* date label on X axis */
      ctx.fillStyle = isDark ? "rgba(51,65,85,0.9)" : "rgba(226,232,240,0.95)";
      const dLabel  = fmtDate(cd.date);
      const dW      = dLabel.length * 7 + 12;
      roundRect(ctx, cx - dW/2, H - PAD_B + 4, dW, 16, 4); ctx.fill();
      ctx.fillStyle  = TIP_TXT;
      ctx.font       = "10px 'SF Mono','Fira Code',monospace";
      ctx.textAlign  = "center";
      ctx.fillText(dLabel, cx, H - PAD_B + 15);
    }

    ctx.restore();
  }, [data, indicators, isDark, getDisplayData]);

  /* ── schedule draw ── */
  const scheduleDraw = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  /* live tick */
  useEffect(() => {
    if (liveTick) stateRef.current.liveData = liveTick;
    scheduleDraw();
  }, [liveTick, scheduleDraw]);

  /* data / theme change */
  useEffect(() => {
    stateRef.current.offset = 0;
    scheduleDraw();
  }, [data, isDark, scheduleDraw]);

  /* resize */
  useEffect(() => {
    const ro = new ResizeObserver(scheduleDraw);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [scheduleDraw]);

  /* ── Mouse events ── */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getPos = e => {
      const r   = canvas.getBoundingClientRect();
      const dpr = window.devicePixelRatio || 1;
      return { x: (e.clientX - r.left), y: (e.clientY - r.top) };
    };

    const onMove = e => {
      const pos = getPos(e);
      stateRef.current.mouse = pos;
      if (stateRef.current.drag !== null) {
        const n       = data.length;
        const W       = containerRef.current.clientWidth;
        const PAD_L   = 12, PAD_R = 72;
        const chartW  = W - PAD_L - PAD_R;
        const visC    = Math.max(5, Math.round(n / stateRef.current.zoom));
        const pixPerC = chartW / visC;
        const delta   = (stateRef.current.drag - e.clientX) / pixPerC;
        stateRef.current.offset = Math.max(0, Math.min(n - visC, stateRef.current.dragOffset + delta));
      }
      scheduleDraw();
    };

    const onDown = e => {
      stateRef.current.drag       = e.clientX;
      stateRef.current.dragOffset = stateRef.current.offset;
      canvas.style.cursor = "grabbing";
    };

    const onUp = () => {
      stateRef.current.drag = null;
      canvas.style.cursor   = "crosshair";
    };

    const onLeave = () => {
      stateRef.current.mouse = null;
      stateRef.current.drag  = null;
      canvas.style.cursor    = "crosshair";
      scheduleDraw();
    };

    const onWheel = e => {
      e.preventDefault();
      const factor = e.deltaY > 0 ? 0.88 : 1.14;
      const n      = data.length;
      stateRef.current.zoom = Math.max(0.5, Math.min(n, stateRef.current.zoom * factor));
      scheduleDraw();
    };

    canvas.style.cursor = "crosshair";
    canvas.addEventListener("mousemove",  onMove);
    canvas.addEventListener("mousedown",  onDown);
    canvas.addEventListener("mouseup",    onUp);
    canvas.addEventListener("mouseleave", onLeave);
    canvas.addEventListener("wheel",      onWheel, { passive: false });
    return () => {
      canvas.removeEventListener("mousemove",  onMove);
      canvas.removeEventListener("mousedown",  onDown);
      canvas.removeEventListener("mouseup",    onUp);
      canvas.removeEventListener("mouseleave", onLeave);
      canvas.removeEventListener("wheel",      onWheel);
    };
  }, [data, scheduleDraw]);

  return (
    <div ref={containerRef} style={{ width:"100%", height:420, position:"relative" }}>
      <canvas ref={canvasRef} style={{ display:"block" }}/>
      {/* Zoom hint */}
      <div style={{ position:"absolute", bottom:6, left:14, fontSize:10,
        color: isDark ? "rgba(100,116,139,0.6)" : "rgba(148,163,184,0.8)",
        pointerEvents:"none", userSelect:"none" }}>
        Scroll to zoom · Drag to pan
      </div>
    </div>
  );
};

/* ── helpers ── */
function fmt(v) {
  if (v == null) return "--";
  const n = Number(v);
  return n >= 1000 ? n.toLocaleString("en-IN", { minimumFractionDigits:1, maximumFractionDigits:1 }) : n.toFixed(2);
}
function fmtVol(v) {
  if (!v) return "--";
  if (v >= 1e9) return (v/1e9).toFixed(2)+"B";
  if (v >= 1e6) return (v/1e6).toFixed(2)+"M";
  if (v >= 1e3) return (v/1e3).toFixed(1)+"K";
  return String(v);
}
function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d);
  if (isNaN(dt)) return d.slice(5) || d;
  return dt.toLocaleDateString("en-US", { month:"short", day:"numeric" });
}
function roundRect(ctx, x, y, w, h, r) {
  if (typeof r === "number") r = [r,r,r,r];
  const [tl,tr,br,bl] = r;
  ctx.beginPath();
  ctx.moveTo(x+tl, y);
  ctx.lineTo(x+w-tr, y);   ctx.quadraticCurveTo(x+w, y,   x+w, y+tr);
  ctx.lineTo(x+w, y+h-br); ctx.quadraticCurveTo(x+w, y+h, x+w-br, y+h);
  ctx.lineTo(x+bl, y+h);   ctx.quadraticCurveTo(x,   y+h, x, y+h-bl);
  ctx.lineTo(x, y+tl);     ctx.quadraticCurveTo(x,   y,   x+tl, y);
  ctx.closePath();
}

export default PriceChart;