import { useEffect, useRef, useCallback } from "react";
import { useTheme } from "../context/ThemeContext.jsx";

const MACDChart = ({ data = [] }) => {
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

    const BG       = isDark ? "#050810"              : "#f8faff";
    const GRID     = isDark ? "#1a2235"              : "#e2e8f0";
    const AXIS     = isDark ? "#64748b"              : "#94a3b8";
    const MACD_C   = "#3b82f6";
    const SIG_C    = "#f59e0b";
    const HIST_POS = isDark ? "rgba(34,197,94,.7)"   : "rgba(22,163,74,.65)";
    const HIST_NEG = isDark ? "rgba(239,68,68,.7)"   : "rgba(220,38,38,.65)";
    const ZERO_C   = isDark ? "rgba(148,163,184,.3)" : "rgba(100,116,139,.3)";

    ctx.fillStyle = BG;
    ctx.fillRect(0, 0, W, H);

    const closes = data.map(d => Number(d.close)).filter(v => v > 0);

    if (closes.length < 10) {
      drawMsg(ctx, W, H, AXIS, "Not enough data — switch to 1M or longer");
      ctx.restore();
      return;
    }

    /* ── adaptive MACD periods ── */
    const slow   = Math.min(26, Math.floor(closes.length * 0.55));
    const fast   = Math.min(12, Math.max(3, Math.floor(slow * 0.46)));
    const sigP   = Math.min(9,  Math.max(2, Math.floor(slow * 0.35)));
    const isPartial = slow < 26;

    const { macdLine, signalLine, histogram } = calcMACD(closes, fast, slow, sigP);

    if (macdLine.length < 2) {
      drawMsg(ctx, W, H, AXIS, `Need ≥${slow + sigP} candles (have ${closes.length})`);
      ctx.restore();
      return;
    }

    const PAD_L = 8, PAD_R = 60, PAD_T = 18, PAD_B = 24;
    const cW = W - PAD_L - PAD_R;
    const cH = H - PAD_T - PAD_B;
    const N  = macdLine.length;

    /* ── value range ── */
    const allV = [...macdLine, ...signalLine.filter(Boolean), ...histogram];
    let hi = Math.max(...allV), lo = Math.min(...allV);
    const pad = (hi - lo) * 0.18 || 0.001;
    hi += pad; lo -= pad;
    const vR = hi - lo;

    const toX = i => PAD_L + (N > 1 ? (i / (N - 1)) * cW : cW / 2);
    /* toY: hi maps to top (PAD_T), lo maps to bottom (PAD_T+cH) */
    const toY = v => PAD_T + ((hi - v) / vR) * cH;
    const z0  = toY(0);

    /* ── subtle grid ── */
    ctx.strokeStyle = GRID;
    ctx.lineWidth   = 0.6;
    ctx.setLineDash([3, 4]);
    [hi * 0.5, lo * 0.5].forEach(v => {
      const y = toY(v);
      if (y > PAD_T && y < H - PAD_B) {
        ctx.beginPath(); ctx.moveTo(PAD_L, y); ctx.lineTo(W - PAD_R, y); ctx.stroke();
      }
    });
    ctx.setLineDash([]);

    /* ── zero line ── */
    ctx.strokeStyle = ZERO_C;
    ctx.lineWidth   = 1;
    ctx.beginPath(); ctx.moveTo(PAD_L, z0); ctx.lineTo(W - PAD_R, z0); ctx.stroke();

    /* ── histogram bars ── */
    const barW = Math.max(1.5, (cW / N) * 0.55);
    histogram.forEach((v, i) => {
      const x    = toX(i);
      const yV   = toY(v);
      const top  = v >= 0 ? yV : z0;
      const barH = Math.abs(yV - z0);
      if (barH < 0.5) return;
      ctx.fillStyle = v >= 0 ? HIST_POS : HIST_NEG;
      ctx.fillRect(x - barW / 2, top, barW, barH);
    });

    /* ── MACD line ── */
    ctx.strokeStyle = MACD_C;
    ctx.lineWidth   = 2;
    ctx.lineJoin    = "round";
    ctx.beginPath();
    macdLine.forEach((v, i) => {
      i === 0 ? ctx.moveTo(toX(i), toY(v)) : ctx.lineTo(toX(i), toY(v));
    });
    ctx.stroke();

    /* ── Signal line (dashed) ── */
    const sigClean = signalLine.filter(Boolean);
    if (sigClean.length > 1) {
      ctx.strokeStyle = SIG_C;
      ctx.lineWidth   = 1.5;
      ctx.setLineDash([5, 3]);
      let started = false;
      ctx.beginPath();
      signalLine.forEach((v, i) => {
        if (!v) return;
        if (!started) { ctx.moveTo(toX(i), toY(v)); started = true; }
        else            ctx.lineTo(toX(i), toY(v));
      });
      ctx.stroke();
      ctx.setLineDash([]);
    }

    /* ── right-axis value badges ── */
    const lastMACD = macdLine[N - 1];
    const lastSig  = signalLine[N - 1];
    [[lastMACD, MACD_C], [lastSig, SIG_C]].forEach(([val, col]) => {
      if (val == null) return;
      const y  = toY(val);
      if (y < PAD_T || y > H - PAD_B) return;
      const lbl = (val >= 0 ? "+" : "") + val.toFixed(3);
      const bW  = lbl.length * 6.2 + 10;
      ctx.fillStyle = col;
      rrect(ctx, W - PAD_R + 2, y - 8, bW, 16, 4); ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font      = "bold 8px 'SF Mono',monospace";
      ctx.textAlign = "left";
      ctx.fillText(lbl, W - PAD_R + 5, y + 4);
    });

    /* ── legend ── */
    const lbl = isPartial ? `MACD ${fast}-${slow}-${sigP}*` : `MACD ${fast}-${slow}-${sigP}`;
    [[MACD_C, lbl], [SIG_C, "Signal"], [HIST_POS, "Hist"]].forEach(([col, label], idx) => {
      const lx = PAD_L + idx * Math.min(72, (W - PAD_L - PAD_R) / 3);
      ctx.fillStyle = col;
      ctx.fillRect(lx, 5, 7, 7);
      ctx.fillStyle  = AXIS;
      ctx.font       = "8.5px 'SF Mono',monospace";
      ctx.textAlign  = "left";
      ctx.fillText(label, lx + 10, 12);
    });

    /* ── X-axis dates ── */
    const offset = closes.length - N;
    const step   = Math.max(1, Math.floor(N / 5));
    ctx.fillStyle  = AXIS;
    ctx.font       = "9px 'SF Mono',monospace";
    ctx.textAlign  = "center";
    macdLine.forEach((_, mi) => {
      if (mi % step !== 0 && mi !== N - 1) return;
      const di = mi + offset;
      if (data[di]) ctx.fillText(fmtDate(data[di].date), toX(mi), H - 8);
    });

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

/* ── EMA ── */
function calcEMA(arr, period) {
  if (arr.length < period) return new Array(arr.length).fill(null);
  const k   = 2 / (period + 1);
  const out  = new Array(period - 1).fill(null);
  let val    = arr.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out.push(val);
  for (let i = period; i < arr.length; i++) {
    val = arr[i] * k + val * (1 - k);
    out.push(val);
  }
  return out;
}

/* ── MACD ── */
function calcMACD(closes, fast = 12, slow = 26, sigP = 9) {
  const eFast = calcEMA(closes, fast);
  const eSlow = calcEMA(closes, slow);

  /* MACD line: diff where both EMAs exist */
  const macdFull = closes.map((_, i) =>
    eFast[i] != null && eSlow[i] != null ? eFast[i] - eSlow[i] : null
  );

  /* trim leading nulls */
  const start = macdFull.findIndex(v => v != null);
  if (start < 0) return { macdLine: [], signalLine: [], histogram: [] };
  const macdLine = macdFull.slice(start);

  /* signal = EMA of macdLine values (skip nulls handled above) */
  const sigFull    = calcEMA(macdLine, sigP);
  const signalLine = sigFull;                      // same length as macdLine

  /* histogram = macd - signal (use 0 where signal not yet available) */
  const histogram = macdLine.map((v, i) =>
    sigFull[i] != null ? v - sigFull[i] : v
  );

  return { macdLine, signalLine, histogram };
}

function drawMsg(ctx, W, H, col, msg) {
  ctx.fillStyle  = col;
  ctx.font       = "11px 'SF Mono',monospace";
  ctx.textAlign  = "center";
  ctx.fillText(msg, W / 2, H / 2 - 6);
  ctx.font       = "9px 'SF Mono',monospace";
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

export default MACDChart;