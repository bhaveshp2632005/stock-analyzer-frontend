import { useEffect, useRef, useCallback } from "react";
import { useTheme } from "../context/ThemeContext.jsx";

const RSIChart = ({ data = [] }) => {
  const { isDark }   = useTheme();
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const rafRef       = useRef(null);

  const draw = useCallback(() => {
    const el = containerRef.current;
    const c  = canvasRef.current;
    if (!c || !el) return;

    const dpr = window.devicePixelRatio || 1;
    const W   = el.clientWidth || 300;
    const H   = 140;

    c.width        = W * dpr;
    c.height       = H * dpr;
    c.style.width  = W + "px";
    c.style.height = H + "px";

    const ctx = c.getContext("2d");
    ctx.save();
    ctx.scale(dpr, dpr);

    const BG      = isDark ? "#050810"             : "#f8faff";
    const GRID    = isDark ? "#1a2235"             : "#e2e8f0";
    const AXIS    = isDark ? "#64748b"             : "#94a3b8";
    const LINE    = "#818cf8";
    const OB_FILL = isDark ? "rgba(239,68,68,.14)" : "rgba(239,68,68,.09)";
    const OS_FILL = isDark ? "rgba(34,197,94,.14)" : "rgba(34,197,94,.09)";
    const OB_EDGE = "rgba(239,68,68,.5)";
    const OS_EDGE = "rgba(34,197,94,.5)";

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const closes = data.map(d => Number(d.close)).filter(v => v > 0);

    /* ── not enough data ── */
    if (closes.length < 5) {
      drawMsg(ctx, W, H, AXIS, "Not enough data — switch to 1M or longer");
      ctx.restore();
      return;
    }

    /* ── adaptive period: use full RSI-14 when possible ── */
    const period  = closes.length > 28 ? 14 : Math.max(2, Math.floor(closes.length / 2));
    const rsiVals = calcRSI(closes, period);

    if (rsiVals.length < 2) {
      drawMsg(ctx, W, H, AXIS, `Need ≥${period + 1} candles for RSI-${period} (have ${closes.length})`);
      ctx.restore();
      return;
    }

    const PAD_L = 8, PAD_R = 50, PAD_T = 10, PAD_B = 24;
    const cW = W - PAD_L - PAD_R;
    const cH = H - PAD_T - PAD_B;

    /* RSI Y is always 0–100, top of canvas = 100, bottom = 0 */
    const toX = i => PAD_L + (rsiVals.length > 1 ? (i / (rsiVals.length - 1)) * cW : cW / 2);
    const toY = v => PAD_T + ((100 - v) / 100) * cH;   // ← correct: 100 maps to top, 0 to bottom

    /* ── overbought zone (70–100) ── */
    ctx.fillStyle = OB_FILL;
    ctx.fillRect(PAD_L, toY(100), cW, toY(70) - toY(100));   // height = toY(70)-toY(100) > 0

    /* ── oversold zone (0–30) ── */
    ctx.fillStyle = OS_FILL;
    ctx.fillRect(PAD_L, toY(30), cW, toY(0) - toY(30));      // height = toY(0)-toY(30) > 0

    /* ── horizontal reference lines ── */
    [[70, OB_EDGE, false], [50, GRID, true], [30, OS_EDGE, false]].forEach(([v, col, dash]) => {
      const y = toY(v);
      ctx.strokeStyle = col;
      ctx.lineWidth   = 0.8;
      ctx.setLineDash(dash ? [4, 4] : []);
      ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
      ctx.setLineDash([]);
      /* right-axis tick label */
      ctx.fillStyle = v === 70 ? "rgba(239,68,68,.8)" : v === 30 ? "rgba(34,197,94,.8)" : AXIS;
      ctx.font      = "9px 'SF Mono',monospace";
      ctx.textAlign = "left";
      ctx.fillText(String(v), W - PAD_R + 5, y + 3);
    });

    /* ── RSI line (colour by zone) ── */
    ctx.lineWidth = 2;
    ctx.lineJoin  = "round";
    for (let i = 1; i < rsiVals.length; i++) {
      const avg = (rsiVals[i - 1] + rsiVals[i]) / 2;
      ctx.strokeStyle = avg > 70 ? "#ef4444" : avg < 30 ? "#22c55e" : LINE;
      ctx.beginPath();
      ctx.moveTo(toX(i - 1), toY(rsiVals[i - 1]));
      ctx.lineTo(toX(i),     toY(rsiVals[i]));
      ctx.stroke();
    }

    /* ── last-value dot + badge ── */
    const last  = rsiVals[rsiVals.length - 1];
    const lastX = toX(rsiVals.length - 1);
    const lastY = toY(last);
    const col   = last > 70 ? "#ef4444" : last < 30 ? "#22c55e" : LINE;

    ctx.fillStyle   = col;
    ctx.shadowColor = col;
    ctx.shadowBlur  = 8;
    ctx.beginPath(); ctx.arc(lastX, lastY, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur  = 0;

    const badge = last.toFixed(1);
    const bW    = badge.length * 6.5 + 10;
    const bY    = Math.max(PAD_T + 8, Math.min(lastY, H - PAD_B - 8));
    ctx.fillStyle = col;
    rrect(ctx, W - PAD_R + 2, bY - 8, bW, 16, 4); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.font      = "bold 9px 'SF Mono',monospace";
    ctx.textAlign = "left";
    ctx.fillText(badge, W - PAD_R + 6, bY + 4);

    /* ── X-axis date labels ── */
    ctx.fillStyle = AXIS;
    ctx.font      = "9px 'SF Mono',monospace";
    ctx.textAlign = "center";
    const offset  = closes.length - rsiVals.length;   // how many candles were consumed for seeding
    const step    = Math.max(1, Math.floor(rsiVals.length / 5));
    rsiVals.forEach((_, ri) => {
      if (ri % step !== 0 && ri !== rsiVals.length - 1) return;
      const di = ri + offset;
      if (data[di]) ctx.fillText(fmtDate(data[di].date), toX(ri), H - 8);
    });

    /* ── adaptive-period notice ── */
    if (period < 14) {
      ctx.fillStyle = AXIS;
      ctx.font      = "8px 'SF Mono',monospace";
      ctx.textAlign = "left";
      ctx.fillText(`RSI-${period} (need more candles for RSI-14)`, PAD_L + 2, PAD_T + 9);
    }

    ctx.restore();
  }, [data, isDark]);

  const schedule = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(draw);
  }, [draw]);

  useEffect(() => { schedule(); }, [data, isDark, schedule]);
  useEffect(() => {
    const ro = new ResizeObserver(schedule);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [schedule]);

  return (
    <div ref={containerRef} style={{ width: "100%", height: 140 }}>
      <canvas ref={canvasRef} style={{ display: "block" }} />
    </div>
  );
};

/* Wilder smoothing RSI */
function calcRSI(closes, period = 14) {
  if (closes.length < period + 1) return [];
  let gains = 0, losses = 0;
  for (let i = 1; i <= period; i++) {
    const d = closes[i] - closes[i - 1];
    if (d > 0) gains += d; else losses -= d;
  }
  let avgG = gains / period, avgL = losses / period;
  const rsi = [avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL)];
  for (let i = period + 1; i < closes.length; i++) {
    const d = closes[i] - closes[i - 1];
    avgG = (avgG * (period - 1) + Math.max(d, 0)) / period;
    avgL = (avgL * (period - 1) + Math.max(-d, 0)) / period;
    rsi.push(avgL === 0 ? 100 : 100 - 100 / (1 + avgG / avgL));
  }
  return rsi;
}

function drawMsg(ctx, W, H, col, msg) {
  ctx.fillStyle = col;
  ctx.font      = "11px 'SF Mono',monospace";
  ctx.textAlign = "center";
  ctx.fillText(msg, W / 2, H / 2 - 6);
  ctx.font      = "9px 'SF Mono',monospace";
  ctx.fillText("Switch to 1M or 3M range for full indicator data", W / 2, H / 2 + 12);
}

function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y,     x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x,     y + h, r);
  ctx.arcTo(x,     y + h, x,     y,     r);
  ctx.arcTo(x,     y,     x + w, y,     r);
  ctx.closePath();
}

function fmtDate(d) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return isNaN(dt) ? String(d).slice(5) : dt.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default RSIChart;