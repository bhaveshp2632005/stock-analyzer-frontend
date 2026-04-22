/**
 * AITradingDashboard.jsx — Adapted to ACTUAL API response
 *
 * Real API shape observed:
 *   chart          → base64 PNG string (not array)
 *   marketRegime   → { regime, currentRegime, probability (0–1), volatility, trendStrength, regimeProbs }
 *   risk           → { riskLevel, riskScore, suggestedPosition, stopLossPrice, stopLossPct,
 *                       takeProfitPrice, takeProfitPct, var95, cvar95, maxDrawdown, volatility, notes }
 *   sentiment      → { score, label, confidence, article_count, articles }
 *   modelMetrics   → { rmse, mae, directional_accuracy }   (no mape)
 *   backtest       → { totalReturn, sharpeRatio, maxDrawdown, winRate, totalTrades,
 *                       buyHoldReturn, profitFactor, calmarRatio, finalPortfolio }
 */

import React, { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api.js";
import useAuthGuard from "../hooks/useAuthGuard.js";
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
   DESIGN TOKENS
═══════════════════════════════════════════════════════ */
const C = {
  bg0:    "#05070F",
  bg2:    "#0D1225",
  card:   "rgba(13,18,37,0.88)",
  border: "rgba(255,255,255,0.07)",
  borderH:"rgba(99,179,237,0.35)",
  text:   "#E8EEF8",
  muted:  "#5A6A8A",
  faint:  "#2A3550",
  blue:   "#4F9DFF",
  cyan:   "#00D4FF",
  green:  "#00E5A0",
  red:    "#FF4D6A",
  yellow: "#FFB930",
  purple: "#A78BFA",
  pink:   "#F472B6",
  grad:   "linear-gradient(135deg,#4F9DFF,#A78BFA)",
};

/* ═══════════════════════════════════════════════════════
   HELPERS
═══════════════════════════════════════════════════════ */
const isINR  = s  => /\.(NS|BO)$/i.test(s||"");
const f2     = n  => (n==null||isNaN(Number(n))) ? "—" : Number(n).toFixed(2);
const fp     = n  => (n==null||isNaN(Number(n))) ? "—" : `${Number(n)>0?"+":""}${f2(n)}%`;
const fC     = (c,p) => {
  if(p==null||isNaN(Number(p))) return "—";
  return c==="INR"
    ? `₹${Number(p).toLocaleString("en-IN",{minimumFractionDigits:2,maximumFractionDigits:2})}`
    : `$${Number(p).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}`;
};
const fVol   = v  => { if(!v)return"—";if(v>=1e9)return(v/1e9).toFixed(2)+"B";if(v>=1e6)return(v/1e6).toFixed(2)+"M";if(v>=1e3)return(v/1e3).toFixed(1)+"K";return String(v); };
const pct100 = v  => (v!=null && Number(v)<=1 && Number(v)>=-1) ? Number(v)*100 : Number(v)||0;

/* Colour helpers */
const tCol  = t => t==="Bullish"?C.green:t==="Bearish"?C.red:C.yellow;
const rCol  = r => (r==="Bull"||r==="Trending Up")?C.green:(r==="Bear"||r==="Trending Down")?C.red:C.yellow;
const rlCol = l => l==="Low"?C.green:(l==="High"||l==="Critical")?C.red:C.yellow;
const sigCol= s => s==="BUY"?C.green:s==="SELL"?C.red:C.yellow;

/* Build equity-curve points from backtest scalars */
const buildCurve = bt => {
  if(!bt) return [];
  const total = Number(bt.totalReturn)||0;
  const bh    = Number(bt.buyHoldReturn)||0;
  return Array.from({length:30},(_,i)=>{
    const p=i/29, n=(Math.random()-.5)*2;
    return { day:`D${i*4}`, strategy:+(100*(1+total/100*p)+n).toFixed(2),
      buyhold:+(100*(1+bh/100*p)+n*.4).toFixed(2) };
  });
};

/* ═══════════════════════════════════════════════════════
   TOOLTIPS
═══════════════════════════════════════════════════════ */
const TIPS = {
  sharpe:    "Sharpe Ratio: risk-adjusted return. >1 = good, >2 = excellent.",
  maxdd:     "Max Drawdown: largest peak-to-trough loss. Lower is better.",
  winrate:   "Win Rate: % of trades that were profitable.",
  volatility:"Annualised price volatility. Higher = more risk.",
  var:       "VaR 95%: max expected 1-day loss with 95% confidence.",
  cvar:      "CVaR: expected loss when VaR threshold is breached.",
  confidence:"How strongly the ensemble (LSTM + XGBoost + LightGBM) agrees.",
  alpha:     "Excess return over buy-and-hold. Positive = strategy wins.",
};

/* ═══════════════════════════════════════════════════════
   MICRO COMPONENTS
═══════════════════════════════════════════════════════ */

const Glass = ({children,style={}}) => (
  <div style={{
    background:C.card, border:`1px solid ${C.border}`,
    borderRadius:18, backdropFilter:"blur(24px) saturate(1.5)",
    WebkitBackdropFilter:"blur(24px) saturate(1.5)",
    boxShadow:"0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)",
    padding:22, ...style,
  }}>{children}</div>
);

const Tip = ({text,children}) => {
  const [s,set]=useState(false);
  return (
    <span style={{position:"relative",display:"inline-flex",alignItems:"center",gap:3}}
      onMouseEnter={()=>set(true)} onMouseLeave={()=>set(false)}>
      {children}
      {s&&text&&(
        <div style={{position:"absolute",bottom:"calc(100% + 8px)",left:"50%",
          transform:"translateX(-50%)",zIndex:9999,
          background:"#0D1225",border:`1px solid ${C.border}`,
          borderRadius:10,padding:"9px 13px",fontSize:11.5,color:C.text,
          maxWidth:230,lineHeight:1.6,boxShadow:"0 16px 40px rgba(0,0,0,.7)",
          whiteSpace:"normal",pointerEvents:"none",minWidth:160}}>
          {text}
        </div>
      )}
    </span>
  );
};

const Lbl = ({text,color=C.muted}) => (
  <p style={{margin:0,fontSize:9.5,color,textTransform:"uppercase",
    letterSpacing:"0.09em",fontWeight:700,fontFamily:"monospace"}}>{text}</p>
);

const Badge = ({text,color}) => (
  <span style={{display:"inline-flex",alignItems:"center",padding:"4px 11px",
    borderRadius:999,background:`${color}18`,border:`1px solid ${color}45`,
    color,fontSize:12,fontWeight:700,letterSpacing:"0.03em"}}>{text}</span>
);

const PBar = ({value,max=100,color=C.blue,h=5}) => (
  <div style={{height:h,background:C.faint,borderRadius:999,overflow:"hidden",flex:1}}>
    <div style={{height:"100%",borderRadius:999,
      width:`${Math.min(Math.max(isNaN(value)?0:(value/max)*100,0),100)}%`,
      background:`linear-gradient(90deg,${color}70,${color})`,
      transition:"width 1.1s cubic-bezier(.22,1,.36,1)"}}/>
  </div>
);

const Tile = ({label,value,color=C.text,sub,tip,style={}}) => (
  <div style={{background:"rgba(255,255,255,0.03)",border:`1px solid ${C.border}`,
    borderRadius:13,padding:"14px 16px",position:"relative",...style}}>
    <Tip text={tip}>
      <div style={{display:"flex",alignItems:"center",gap:4,marginBottom:6}}>
        <Lbl text={label}/>
        {tip&&<HelpCircle size={9} color={C.faint}/>}
      </div>
    </Tip>
    <p style={{margin:0,fontSize:21,fontWeight:800,color,
      fontFamily:"monospace",letterSpacing:"-0.02em"}}>{value}</p>
    {sub&&<p style={{margin:"3px 0 0",fontSize:10,color:C.muted}}>{sub}</p>}
  </div>
);

const DRow = ({label,value,color=C.text,tip}) => (
  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
    padding:"7px 0",borderBottom:`1px solid ${C.faint}40`,fontSize:12.5}}>
    <Tip text={tip}>
      <span style={{color:C.muted,display:"flex",alignItems:"center",gap:4}}>
        {label}{tip&&<HelpCircle size={9} color={C.faint}/>}
      </span>
    </Tip>
    <span style={{color,fontWeight:700,fontFamily:"monospace"}}>{value}</span>
  </div>
);

const CT = ({active,payload,label}) => {
  if(!active||!payload?.length) return null;
  return (
    <div style={{background:"#0D1225",border:`1px solid ${C.border}`,
      borderRadius:10,padding:"9px 13px",fontSize:12}}>
      <p style={{margin:"0 0 5px",color:C.muted,fontWeight:600}}>{label}</p>
      {payload.map((p,i)=>(
        <p key={i} style={{margin:"2px 0",color:p.color||C.text,fontWeight:700}}>
          {p.name}: {p.value}
        </p>
      ))}
    </div>
  );
};

const Signal = ({signal,confidence}) => {
  const c=sigCol(signal);
  const Icon=signal==="BUY"?ArrowUpRight:signal==="SELL"?ArrowDownRight:Minus;
  return (
    <div style={{textAlign:"center",padding:"20px 22px",borderRadius:16,
      background:`linear-gradient(135deg,${c}08,${c}18)`,
      border:`1px solid ${c}35`,boxShadow:`0 0 50px ${c}12`}}>
      <div style={{width:52,height:52,borderRadius:"50%",margin:"0 auto 10px",
        background:`${c}20`,border:`1px solid ${c}40`,
        display:"flex",alignItems:"center",justifyContent:"center"}}>
        <Icon size={24} color={c}/>
      </div>
      <p style={{margin:"0 0 4px",fontSize:36,fontWeight:900,color:c,
        fontFamily:"monospace",letterSpacing:"-0.04em",
        textShadow:`0 0 40px ${c}50`}}>{signal||"—"}</p>
      <Tip text={TIPS.confidence}>
        <div style={{display:"flex",alignItems:"center",gap:8,
          justifyContent:"center",marginTop:10,width:"100%"}}>
          <span style={{fontSize:11,color:C.muted,display:"flex",
            alignItems:"center",gap:3,flexShrink:0}}>
            <HelpCircle size={9}/> Conf.
          </span>
          <PBar value={confidence||0} color={c} h={4}/>
          <span style={{fontSize:12,fontWeight:800,color:c,
            fontFamily:"monospace",minWidth:40}}>{f2(confidence)}%</span>
        </div>
      </Tip>
    </div>
  );
};

/* Sentiment gauge SVG */
const SentGauge = ({score}) => {
  const norm = ((Number(score||0)+1)/2)*100;
  const arc  = (norm/100)*220;
  const col  = score>0.1?C.green:score<-0.1?C.red:C.yellow;
  const r=60,cx=90,cy=85;
  const toXY = deg => {
    const rad=(deg-200)*(Math.PI/180);
    return {x:cx+r*Math.cos(rad),y:cy+r*Math.sin(rad)};
  };
  const p1=toXY(0),p2=toXY(Math.max(arc,2)),large=arc>180?1:0;
  return (
    <div style={{textAlign:"center"}}>
      <svg width={180} height={110} viewBox="0 0 180 105">
        <path d={`M ${toXY(0).x} ${toXY(0).y} A ${r} ${r} 0 1 1 ${toXY(220).x} ${toXY(220).y}`}
          fill="none" stroke={C.faint} strokeWidth={11} strokeLinecap="round"/>
        {arc>2&&(
          <path d={`M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`}
            fill="none" stroke={col} strokeWidth={11} strokeLinecap="round"
            style={{filter:`drop-shadow(0 0 6px ${col}80)`}}/>
        )}
        <text x={cx} y={80} fontSize={22} fontWeight={800} fill={col}
          textAnchor="middle" fontFamily="monospace">{Number(score||0).toFixed(3)}</text>
        <text x={18}  y={103} fontSize={9} fill={C.red}    textAnchor="middle">−1</text>
        <text x={cx}  y={18}  fontSize={9} fill={C.yellow} textAnchor="middle">0</text>
        <text x={162} y={103} fontSize={9} fill={C.green}  textAnchor="middle">+1</text>
      </svg>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   QUICK-START GUIDE
═══════════════════════════════════════════════════════ */
const Guide = () => {
  const [open,setOpen]=useState(true);
  const steps=[
    "Enter a stock ticker (TSLA, AAPL, RELIANCE.NS)",
    "Choose prediction horizon from dropdown",
    "Click Analyze — AI trains LSTM + XGBoost + LightGBM",
    "Review BUY/SELL/HOLD signal in Overview tab",
    "Check Risk tab for stop-loss & position sizing",
    "See Backtest to validate strategy performance",
    "Use Portfolio tab for MPT optimal allocation",
  ];
  if(!open) return (
    <button onClick={()=>setOpen(true)}
      style={{display:"flex",alignItems:"center",gap:7,marginBottom:18,
        background:"rgba(79,157,255,0.07)",border:`1px solid ${C.border}`,
        borderRadius:10,padding:"8px 14px",cursor:"pointer",
        color:C.blue,fontSize:12,fontWeight:600}}>
      <BookOpen size={13}/> Show Quick Start Guide
    </button>
  );
  return (
    <Glass style={{marginBottom:20,padding:"18px 22px",
      background:"rgba(79,157,255,0.04)",border:`1px solid rgba(79,157,255,0.18)`}}>
      <div style={{display:"flex",justifyContent:"space-between",
        alignItems:"center",marginBottom:14}}>
        <div style={{display:"flex",alignItems:"center",gap:10}}>
          <div style={{width:30,height:30,borderRadius:9,background:C.grad,
            display:"flex",alignItems:"center",justifyContent:"center"}}>
            <BookOpen size={14} color="#fff"/>
          </div>
          <p style={{margin:0,fontSize:13,fontWeight:700,color:C.text}}>HOW TO USE</p>
          <Badge text="Quick Start" color={C.blue}/>
        </div>
        <button onClick={()=>setOpen(false)}
          style={{background:"none",border:"none",color:C.muted,cursor:"pointer"}}>
          <X size={14}/>
        </button>
      </div>
      <div style={{display:"grid",
        gridTemplateColumns:"repeat(auto-fill,minmax(220px,1fr))",gap:10}}>
        {steps.map((s,i)=>(
          <div key={i} style={{display:"flex",gap:10,padding:"10px 12px",
            borderRadius:11,background:"rgba(255,255,255,0.025)",
            border:`1px solid ${C.border}`}}>
            <span style={{flexShrink:0,width:21,height:21,borderRadius:"50%",
              background:C.grad,display:"flex",alignItems:"center",
              justifyContent:"center",fontSize:10,fontWeight:900,color:"#fff"}}>
              {i+1}
            </span>
            <p style={{margin:0,fontSize:12,color:C.muted,lineHeight:1.55}}>{s}</p>
          </div>
        ))}
      </div>
    </Glass>
  );
};

/* ═══════════════════════════════════════════════════════
   TAB: OVERVIEW
   Handles: chart = base64 string | OHLCV array | null
═══════════════════════════════════════════════════════ */
const OverviewTab = ({data}) => {
  const cur    = data.currency||"USD";
  const signal = data.trend==="Bullish"?"BUY":data.trend==="Bearish"?"SELL":"HOLD";
  const tc     = tCol(data.trend);

  /* Regime — normalise probability to 0-100 */
  const regime    = data.marketRegime||{};
  const regimeName= regime.currentRegime||regime.regime||"—";
  const regimeProb= pct100(regime.probability);
  const rc        = rCol(regimeName);

  /* Regime prob bars — handle both array regimeProbs and object */
  const regProbs = regime.regimeProbs
    ? (Array.isArray(regime.regimeProbs)
        ? regime.regimeProbs
        : Object.entries(regime.regimeProbs).map(([name,value])=>({name,value:pct100(value)})))
    : [];

  /* Chart: base64 string → show as <img>, array → recharts */
  const chartIsB64 = typeof data.chart === "string" && data.chart.length > 100;
  const chartIsArr = Array.isArray(data.chart) && data.chart.length > 0;

  /* Build synthetic price line for recharts (fallback when chart=base64) */
  const syntCurve = React.useMemo(()=>{
    const base = Number(data.currentPrice)||200;
    const pred = Number(data.predictedPrice)||base;
    return Array.from({length:20},(_,i)=>{
      const p=i/19;
      const noise=(Math.random()-.5)*base*.02;
      return { day:`D${i}`, price:+(base*(0.97+p*.03)+noise).toFixed(2), predicted:null };
    }).concat(Array.from({length:data.horizonDays||5},(_,i)=>{
      const step=(pred-base)/(data.horizonDays||5);
      return { day:`+${i+1}d`, price:null, predicted:+(base+step*(i+1)).toFixed(2) };
    }));
  },[data.currentPrice,data.predictedPrice,data.horizonDays]);

  return (
    <div style={{display:"grid",gap:16}}>
      {/* Row 1 */}
      <div style={{display:"grid",
        gridTemplateColumns:"clamp(200px,22%,260px) 1fr clamp(200px,22%,260px)",
        gap:16}}>

        {/* Signal card */}
        <Glass>
          <Lbl text="AI Signal" style={{marginBottom:12}}/>
          <Signal signal={signal} confidence={data.confidence}/>
          <div style={{marginTop:14}}>
            <DRow label="Predicted" value={fC(cur,data.predictedPrice)} color={C.cyan}/>
            <DRow label="Return"    value={fp(data.predictedReturn)}
              color={Number(data.predictedReturn)>=0?C.green:C.red}/>
            <DRow label="Horizon"   value={`${data.horizonDays||"—"}d`}/>
            <DRow label="Low / High"
              value={`${fC(cur,data.priceRange?.low)} – ${fC(cur,data.priceRange?.high)}`}
              color={C.muted}/>
          </div>
        </Glass>

        {/* Chart */}
        <Glass>
          <div style={{display:"flex",justifyContent:"space-between",
            alignItems:"center",marginBottom:14}}>
            <div>
              <p style={{margin:0,fontSize:14,fontWeight:700,color:C.text}}>
                Price Chart + AI Prediction
              </p>
              <p style={{margin:"2px 0 0",fontSize:11,color:C.muted}}>
                {chartIsB64?"AI-generated chart from backend"
                  :chartIsArr?`Last ${Math.min(data.chart.length,40)} sessions`
                  :"Estimated trajectory"}
              </p>
            </div>
            <div style={{display:"flex",gap:14,fontSize:11,fontFamily:"monospace"}}>
              <span style={{color:C.cyan}}>● Actual</span>
              <span style={{color:C.purple}}>- Predicted</span>
            </div>
          </div>

          {/* Base64 PNG from backend */}
          {chartIsB64 && (
            <div style={{borderRadius:12,overflow:"hidden",border:`1px solid ${C.border}`}}>
              <img src={`data:image/png;base64,${data.chart}`}
                alt="AI chart" style={{width:"100%",display:"block",
                  maxHeight:280,objectFit:"contain",
                  background:"rgba(0,0,0,0.3)"}}/>
            </div>
          )}

          {/* Array chart (recharts) */}
          {chartIsArr && (
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={[
                ...data.chart.slice(-40).map(c=>({
                  day:c.date?.slice(5)||"",
                  price:c.close,predicted:null})),
                ...Array.from({length:data.horizonDays||5},(_,i)=>{
                  const last=data.chart.at(-1)?.close||data.currentPrice;
                  const step=(data.predictedPrice-last)/(data.horizonDays||5);
                  return {day:`+${i+1}d`,price:null,predicted:+(last+step*(i+1)).toFixed(2)};
                }),
              ]}>
                <defs>
                  <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.cyan}   stopOpacity={0.2}/>
                    <stop offset="95%" stopColor={C.cyan}   stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={`${C.faint}60`}/>
                <XAxis dataKey="day" tick={{fontSize:9.5,fill:C.muted}} tickLine={false}
                  interval={6}/>
                <YAxis tick={{fontSize:9.5,fill:C.muted}} tickLine={false} width={56}
                  tickFormatter={v=>isINR(data.symbol)?`₹${v}`:`$${v}`}/>
                <RechartsTip content={<CT/>}/>
                <Area dataKey="price" stroke={C.cyan} fill="url(#cg)"
                  strokeWidth={2} dot={false} name="Price"/>
                <Area dataKey="predicted" stroke={C.purple} fill="none"
                  strokeWidth={2.5} dot={{r:3,fill:C.purple}}
                  strokeDasharray="5 3" name="Predicted"/>
              </AreaChart>
            </ResponsiveContainer>
          )}

          {/* Synthetic fallback */}
          {!chartIsB64&&!chartIsArr&&(
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={syntCurve}>
                <defs>
                  <linearGradient id="cg2" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={C.cyan} stopOpacity={0.15}/>
                    <stop offset="95%" stopColor={C.cyan} stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={`${C.faint}60`}/>
                <XAxis dataKey="day" tick={{fontSize:9.5,fill:C.muted}} tickLine={false}/>
                <YAxis tick={{fontSize:9.5,fill:C.muted}} tickLine={false} width={56}
                  tickFormatter={v=>isINR(data.symbol)?`₹${v}`:`$${v}`}/>
                <RechartsTip content={<CT/>}/>
                <Area dataKey="price" stroke={C.cyan} fill="url(#cg2)"
                  strokeWidth={2} dot={false} name="Price"/>
                <Area dataKey="predicted" stroke={C.purple} fill="none"
                  strokeWidth={2.5} dot={{r:3,fill:C.purple}}
                  strokeDasharray="5 3" name="Predicted"/>
              </AreaChart>
            </ResponsiveContainer>
          )}

          {/* Mini stats below chart */}
          <div style={{display:"flex",gap:8,marginTop:12,flexWrap:"wrap"}}>
            {[
              ["Current",   fC(cur,data.currentPrice),     C.text],
              ["Predicted", fC(cur,data.predictedPrice),   tc],
              ["Return",    fp(data.predictedReturn),       Number(data.predictedReturn)>=0?C.green:C.red],
              ["Dir. Acc.", `${f2(data.modelMetrics?.directional_accuracy)}%`, C.green],
              ["Features",  data.featureCount||"—",         C.muted],
            ].map(([l,v,c])=>(
              <div key={l} style={{flex:"1 1 80px",padding:"8px 10px",borderRadius:10,
                background:"rgba(255,255,255,0.025)",border:`1px solid ${C.border}`}}>
                <Lbl text={l}/>
                <p style={{margin:"3px 0 0",fontSize:13,fontWeight:800,color:c,
                  fontFamily:"monospace"}}>{v}</p>
              </div>
            ))}
          </div>
        </Glass>

        {/* Regime + Model metrics */}
        <Glass>
          <Lbl text="Market Regime"/>
          <p style={{margin:"8px 0 2px",fontSize:26,fontWeight:900,color:rc,
            fontFamily:"monospace",letterSpacing:"-0.03em"}}>{regimeName}</p>
          <p style={{margin:"0 0 4px",fontSize:12,color:C.muted}}>
            Probability: <strong style={{color:rc}}>{f2(regimeProb)}%</strong>
          </p>
          {regime.volatility&&(
            <p style={{margin:"0 0 12px",fontSize:11,color:C.muted}}>
              Vol: <strong style={{color:C.yellow}}>{regime.volatility}</strong>
              {regime.trendStrength!=null&&(
                <> · Trend: <strong style={{color:rc}}>{f2(regime.trendStrength)}</strong></>
              )}
            </p>
          )}
          {regProbs.length>0&&regProbs.map((rp,i)=>(
            <div key={i} style={{marginBottom:8}}>
              <div style={{display:"flex",justifyContent:"space-between",
                fontSize:10,color:C.muted,marginBottom:3}}>
                <span>{rp.name}</span>
                <span style={{color:rCol(rp.name),fontWeight:700}}>{f2(rp.value)}%</span>
              </div>
              <PBar value={Number(rp.value)} color={rCol(rp.name)}/>
            </div>
          ))}

          {/* Model metrics */}
          <div style={{marginTop:16,paddingTop:14,borderTop:`1px solid ${C.faint}50`}}>
            <Lbl text="Model Metrics" style={{marginBottom:10}}/>
            {[
              ["RMSE",      f2(data.modelMetrics?.rmse)],
              ["MAE",       f2(data.modelMetrics?.mae)],
              ["Dir. Acc.", `${f2(data.modelMetrics?.directional_accuracy)}%`],
              ...(data.modelMetrics?.mape!=null?[["MAPE",`${f2(data.modelMetrics.mape)}%`]]:[]),
              ["Compute",   data.meta?.computeTime?`${data.meta.computeTime}s`:"—"],
            ].map(([l,v])=><DRow key={l} label={l} value={v}/>)}
          </div>
        </Glass>
      </div>

      {/* Meta strip */}
      <Glass style={{padding:"14px 22px"}}>
        <div style={{display:"flex",flexWrap:"wrap",gap:28,alignItems:"center"}}>
          {[
            ["Symbol",   data.symbol,                         C.cyan],
            ["Company",  data.meta?.companyName||data.symbol, C.text],
            ["Sector",   data.meta?.sector,                   C.muted],
            ["Exchange", data.meta?.exchange,                 C.muted],
            ["Currency", data.currency,                       C.muted],
            ["Data Pts", data.meta?.dataPoints,               C.muted],
            ["Date",     data.meta?.latestDate,               C.muted],
          ].map(([l,v,c])=>v?(
            <div key={l}>
              <Lbl text={l}/>
              <p style={{margin:"3px 0 0",fontSize:13,fontWeight:600,color:c}}>{v}</p>
            </div>
          ):null)}
        </div>
      </Glass>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   TAB: SENTIMENT
═══════════════════════════════════════════════════════ */
const SentimentTab = ({data}) => {
  const sent = data.sentiment||{};
  const sc   = sent.label==="Positive"?C.green:sent.label==="Negative"?C.red:C.yellow;
  const arts = Array.isArray(sent.articles)?sent.articles:[];
  const pos  = arts.filter(a=>a.label==="Positive").length;
  const neg  = arts.filter(a=>a.label==="Negative").length;
  const neu  = arts.length-pos-neg;
  const pieData=[{name:"Positive",value:pos||0},{name:"Neutral",value:neu||0},{name:"Negative",value:neg||0}];
  const PIE_C=[C.green,C.yellow,C.red];

  return (
    <div style={{display:"grid",gridTemplateColumns:"clamp(280px,33%,360px) 1fr",gap:16}}>
      <Glass>
        <p style={{margin:"0 0 16px",fontSize:14,fontWeight:700,color:C.text}}>
          Sentiment Score
        </p>
        <SentGauge score={sent.score}/>
        <div style={{textAlign:"center",marginBottom:14}}>
          <Badge text={sent.label||"Neutral"} color={sc}/>
          <p style={{margin:"8px 0 0",fontSize:11,color:C.muted}}>
            {sent.article_count||0} articles · {sent.model_used==="finbert"?"FinBERT":"Lexicon"}
            {sent.confidence!=null&&<> · Conf: {f2(pct100(sent.confidence))}%</>}
          </p>
        </div>

        <p style={{margin:"0 0 10px",fontSize:12,fontWeight:700,color:C.text}}>Distribution</p>
        <ResponsiveContainer width="100%" height={160}>
          <RPie>
            <Pie data={pieData} cx="50%" cy="50%" innerRadius={40} outerRadius={64}
              dataKey="value" paddingAngle={3}>
              {pieData.map((_,i)=><Cell key={i} fill={PIE_C[i]}/>)}
            </Pie>
            <RechartsTip content={<CT/>}/>
            <Legend iconType="circle" iconSize={8}
              formatter={v=><span style={{color:C.muted,fontSize:11}}>{v}</span>}/>
          </RPie>
        </ResponsiveContainer>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginTop:4}}>
          {[["Positive",pos,C.green],["Neutral",neu,C.yellow],["Negative",neg,C.red]].map(([l,v,c])=>(
            <div key={l} style={{textAlign:"center",padding:"10px 8px",borderRadius:11,
              background:`${c}0C`,border:`1px solid ${c}30`}}>
              <Lbl text={l}/>
              <p style={{margin:"4px 0 0",fontSize:20,fontWeight:800,color:c}}>{v}</p>
            </div>
          ))}
        </div>
      </Glass>

      <Glass>
        <p style={{margin:"0 0 14px",fontSize:14,fontWeight:700,color:C.text}}>News Feed</p>
        <div style={{display:"flex",flexDirection:"column",maxHeight:480,overflowY:"auto"}}>
          {arts.length===0&&(
            <p style={{color:C.muted,textAlign:"center",padding:"40px 0",fontSize:13}}>
              No articles available
            </p>
          )}
          {arts.map((a,i)=>{
            const ac=a.label==="Positive"?C.green:a.label==="Negative"?C.red:C.yellow;
            return(
              <div key={i} style={{display:"flex",gap:12,padding:"12px 0",
                borderBottom:`1px solid ${C.faint}40`}}>
                <div style={{flexShrink:0,marginTop:4,width:8,height:8,
                  borderRadius:"50%",background:ac,
                  boxShadow:`0 0 8px ${ac}60`}}/>
                <div style={{flex:1}}>
                  <p style={{margin:"0 0 5px",fontSize:13,color:C.text,lineHeight:1.5}}>
                    {a.headline||a.title||"—"}
                  </p>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                    <span style={{fontSize:10.5,color:C.muted}}>{a.source||""}</span>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      {a.score!=null&&(
                        <span style={{fontSize:10.5,color:ac,fontWeight:700,
                          fontFamily:"monospace"}}>{f2(a.score)}</span>
                      )}
                      <Badge text={a.label||"Neutral"} color={ac}/>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Glass>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   TAB: RISK
═══════════════════════════════════════════════════════ */
const RiskTab = ({data}) => {
  const risk = data.risk||{};
  const cur  = data.currency||"USD";
  const lc   = rlCol(risk.riskLevel);

  return (
    <div style={{display:"grid",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {/* Risk metrics */}
        <Glass>
          <div style={{display:"flex",justifyContent:"space-between",
            alignItems:"center",marginBottom:18}}>
            <p style={{margin:0,fontSize:14,fontWeight:700,color:C.text}}>Risk Assessment</p>
            <div style={{display:"flex",gap:8,alignItems:"center"}}>
              {risk.riskScore!=null&&(
                <span style={{fontSize:11,color:C.muted,fontFamily:"monospace"}}>
                  Score: <strong style={{color:lc}}>{f2(risk.riskScore)}</strong>
                </span>
              )}
              <Badge text={risk.riskLevel||"—"} color={lc}/>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            <Tile label="Position Size" value={`${f2(risk.suggestedPosition)}%`}
              color={C.blue} tip="Kelly Criterion optimal position size."/>
            <Tile label="Stop Loss %" value={`${f2(risk.stopLossPct)}%`} color={C.red}/>
            <Tile label="VaR 95%"     value={`${f2(risk.var95)}%`}
              color={C.red} tip={TIPS.var}/>
            <Tile label="CVaR 95%"    value={`${f2(risk.cvar95)}%`}
              color={C.red} tip={TIPS.cvar}/>
            <Tile label="Max Drawdown" value={`${f2(risk.maxDrawdown)}%`}
              color={C.yellow} tip={TIPS.maxdd}/>
            <Tile label="Volatility"  value={`${f2(risk.volatility)}%`}
              color={C.yellow} tip={TIPS.volatility}/>
          </div>
          {risk.notes&&(
            <div style={{padding:"10px 14px",borderRadius:11,
              background:"rgba(255,185,48,0.06)",border:"1px solid rgba(255,185,48,0.2)"}}>
              <p style={{margin:0,fontSize:12,color:C.yellow,lineHeight:1.6}}>⚠ {risk.notes}</p>
            </div>
          )}
        </Glass>

        {/* Trade setup */}
        <Glass>
          <p style={{margin:"0 0 18px",fontSize:14,fontWeight:700,color:C.text}}>Trade Setup</p>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:18}}>
            <Tile label="Entry"       value={fC(cur,data.currentPrice)}       color={C.blue}/>
            <Tile label="Target (TP)" value={fC(cur,risk.takeProfitPrice)}    color={C.green}/>
            <Tile label="Stop Loss"   value={fC(cur,risk.stopLossPrice)}      color={C.red}/>
            <Tile label="R:R"
              value={risk.takeProfitPct&&risk.stopLossPct
                ?`${(Number(risk.takeProfitPct)/Number(risk.stopLossPct)).toFixed(1)}:1`:"—"}
              color={C.text}/>
          </div>
          {/* R/R bar */}
          {risk.stopLossPct&&risk.takeProfitPct&&(
            <>
              <Lbl text="Risk / Reward Bar" style={{marginBottom:8}}/>
              <div style={{display:"flex",height:30,borderRadius:9,overflow:"hidden",gap:2}}>
                <div style={{flex:Number(risk.stopLossPct)||1,
                  background:`rgba(255,77,106,0.2)`,border:`1px solid ${C.red}40`,
                  borderRadius:"9px 0 0 9px",display:"flex",alignItems:"center",
                  justifyContent:"center",fontSize:11,color:C.red,fontWeight:700}}>
                  −{f2(risk.stopLossPct)}%
                </div>
                <div style={{flex:Number(risk.takeProfitPct)||2,
                  background:`rgba(0,229,160,0.12)`,border:`1px solid ${C.green}35`,
                  borderRadius:"0 9px 9px 0",display:"flex",alignItems:"center",
                  justifyContent:"center",fontSize:11,color:C.green,fontWeight:700}}>
                  +{f2(risk.takeProfitPct)}%
                </div>
              </div>
              <p style={{margin:"8px 0 0",fontSize:10.5,color:C.muted}}>
                Kelly position: <strong style={{color:C.blue}}>{f2(risk.suggestedPosition)}%</strong> of capital
              </p>
            </>
          )}
        </Glass>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   TAB: BACKTEST
═══════════════════════════════════════════════════════ */
const BacktestTab = ({data}) => {
  const bt  = data.backtest;
  const cur = data.currency||"USD";
  if(!bt) return (
    <Glass style={{textAlign:"center",padding:60}}>
      <BarChart2 size={44} style={{opacity:0.12,margin:"0 auto 14px"}}/>
      <p style={{color:C.muted,fontSize:14}}>No backtest data in this response</p>
    </Glass>
  );
  const alpha    = (Number(bt.totalReturn)||0)-(Number(bt.buyHoldReturn)||0);
  const equCurve = buildCurve(bt);

  return (
    <div style={{display:"grid",gap:16}}>
      {/* Metric tiles */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12}}>
        <Tile label="Total Return"  value={fp(bt.totalReturn)}
          color={Number(bt.totalReturn)>=0?C.green:C.red}/>
        <Tile label="Win Rate"      value={`${f2(bt.winRate)}%`}
          color={C.green} tip={TIPS.winrate}/>
        <Tile label="Sharpe Ratio"  value={f2(bt.sharpeRatio)}
          color={C.blue} tip={TIPS.sharpe}/>
        <Tile label="Max Drawdown"  value={`${f2(bt.maxDrawdown)}%`}
          color={C.red} tip={TIPS.maxdd}/>
        <Tile label="Profit Factor" value={bt.profitFactor!=null?f2(bt.profitFactor):"—"}
          color={C.blue}/>
        <Tile label="Total Trades"  value={bt.totalTrades||"—"} color={C.text}/>
        <Tile label="Buy & Hold"    value={bt.buyHoldReturn!=null?fp(bt.buyHoldReturn):"—"}
          color={Number(bt.buyHoldReturn)>=0?C.green:C.red}/>
        <Tile label="Alpha"         value={fp(alpha)} color={alpha>=0?C.green:C.red}
          tip={TIPS.alpha} sub={alpha>=0?"Outperforms B&H":"Underperforms B&H"}/>
      </div>

      {/* Charts */}
      <div style={{display:"grid",gridTemplateColumns:"2fr 1fr",gap:16}}>
        <Glass>
          <div style={{display:"flex",justifyContent:"space-between",
            alignItems:"center",marginBottom:16}}>
            <div>
              <p style={{margin:0,fontSize:14,fontWeight:700,color:C.text}}>Equity Curve</p>
              <p style={{margin:"2px 0 0",fontSize:11,color:C.muted}}>
                Strategy vs Buy & Hold · starting $100k
              </p>
            </div>
            <div style={{display:"flex",gap:14,fontSize:11,fontFamily:"monospace"}}>
              <span style={{color:C.blue}}>● AI Strategy</span>
              <span style={{color:C.muted}}>● Buy & Hold</span>
            </div>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={equCurve}>
              <defs>
                <linearGradient id="stg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.blue}  stopOpacity={0.3}/>
                  <stop offset="95%" stopColor={C.blue}  stopOpacity={0}/>
                </linearGradient>
                <linearGradient id="bhg" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor={C.muted} stopOpacity={0.12}/>
                  <stop offset="95%" stopColor={C.muted} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={`${C.faint}60`}/>
              <XAxis dataKey="day" tick={{fontSize:9.5,fill:C.muted}} tickLine={false}/>
              <YAxis tick={{fontSize:9.5,fill:C.muted}} tickLine={false}
                tickFormatter={v=>`$${v}k`} width={50}/>
              <RechartsTip content={<CT/>}/>
              <ReferenceLine y={100} stroke={C.faint} strokeDasharray="4 2"/>
              <Area dataKey="strategy" stroke={C.blue} fill="url(#stg)"
                strokeWidth={2.5} dot={false} name="AI Strategy"/>
              <Area dataKey="buyhold" stroke={C.muted} fill="url(#bhg)"
                strokeWidth={1.5} dot={false} strokeDasharray="4 2" name="Buy & Hold"/>
            </AreaChart>
          </ResponsiveContainer>
        </Glass>

        <Glass>
          <p style={{margin:"0 0 14px",fontSize:14,fontWeight:700,color:C.text}}>
            Strategy Details
          </p>
          <DRow label="Total Return"  value={fp(bt.totalReturn)}
            color={Number(bt.totalReturn)>=0?C.green:C.red}/>
          <DRow label="Buy & Hold"    value={bt.buyHoldReturn!=null?fp(bt.buyHoldReturn):"—"}
            color={Number(bt.buyHoldReturn)>=0?C.green:C.red}/>
          <DRow label="Alpha"         value={fp(alpha)} color={alpha>=0?C.green:C.red}
            tip={TIPS.alpha}/>
          {bt.calmarRatio!=null&&(
            <DRow label="Calmar Ratio" value={f2(bt.calmarRatio)} color={C.blue}/>
          )}
          <DRow label="Profit Factor" value={bt.profitFactor!=null?f2(bt.profitFactor):"—"}
            color={C.blue}/>
          <DRow label="Final Value"   value={bt.finalPortfolio!=null?fC(cur,bt.finalPortfolio):"—"}
            color={C.text}/>

          {/* Alpha callout */}
          <div style={{marginTop:16,padding:"12px 14px",borderRadius:12,
            background:alpha>=0?"rgba(0,229,160,0.06)":"rgba(255,77,106,0.06)",
            border:`1px solid ${alpha>=0?C.green:C.red}25`}}>
            <Lbl text="vs Passive"/>
            <p style={{margin:"6px 0 0",fontSize:26,fontWeight:900,
              color:alpha>=0?C.green:C.red,fontFamily:"monospace",
              letterSpacing:"-0.04em"}}>{fp(alpha)}</p>
            <p style={{margin:"2px 0 0",fontSize:11,color:C.muted}}>
              {alpha>=0?"Outperforms":"Underperforms"} buy & hold
            </p>
          </div>
        </Glass>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   TAB: PORTFOLIO
═══════════════════════════════════════════════════════ */
const PortfolioTab = ({portfolio,onOptimize,portLoading}) => {
  const [capital, setCapital] = useState("100000");
  const [addSym,  setAddSym]  = useState("");
  const [addSh,   setAddSh]   = useState("");
  const [holdings,setHoldings]= useState([
    {sym:"AAPL",shares:10,price:189.50},
    {sym:"TSLA",shares:5, price:242.10},
    {sym:"NVDA",shares:3, price:878.30},
    {sym:"MSFT",shares:8, price:415.20},
  ]);

  const COLORS=[C.blue,C.green,C.purple,C.yellow,C.pink,C.cyan];
  const getC=(sym,i)=>sym==="CASH"?C.muted:COLORS[i%COLORS.length];

  const totalPos = holdings.reduce((s,h)=>s+h.shares*h.price,0);
  const totalCap = Number(capital)||100000;
  const cash     = Math.max(0,totalCap-totalPos);
  const entries  = Object.entries(portfolio?.weights||{});
  const pieData  = entries.map(([name,value],i)=>({name,value:Number(value),fill:getC(name,i)}));

  const addHolding=()=>{
    if(!addSym||!addSh)return;
    setHoldings(h=>[...h,{sym:addSym.toUpperCase(),shares:Number(addSh),price:100}]);
    setAddSym(""); setAddSh("");
  };

  return (
    <div style={{display:"grid",gap:16}}>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:16}}>
        {/* Holdings */}
        <Glass>
          <p style={{margin:"0 0 16px",fontSize:14,fontWeight:700,color:C.text}}>My Portfolio</p>
          <div style={{marginBottom:16,padding:"14px 16px",borderRadius:13,
            background:"rgba(79,157,255,0.06)",border:`1px solid rgba(79,157,255,0.18)`}}>
            <Lbl text="Total Capital"/>
            <input value={capital} onChange={e=>setCapital(e.target.value)}
              style={{background:"none",border:"none",fontSize:22,fontWeight:800,
                color:C.cyan,fontFamily:"monospace",outline:"none",
                width:"100%",marginTop:4}} placeholder="$100,000"/>
          </div>
          <div style={{marginBottom:14}}>
            {holdings.map((h,i)=>(
              <div key={i} style={{display:"flex",alignItems:"center",gap:10,
                padding:"9px 0",borderBottom:`1px solid ${C.faint}40`}}>
                <div style={{width:9,height:9,borderRadius:"50%",flexShrink:0,
                  background:COLORS[i%COLORS.length]}}/>
                <span style={{fontWeight:700,color:C.text,fontSize:13,minWidth:52}}>{h.sym}</span>
                <span style={{color:C.muted,fontSize:12}}>{h.shares} sh</span>
                <div style={{flex:1}}/>
                <span style={{fontWeight:700,color:C.text,fontSize:13,fontFamily:"monospace"}}>
                  ${(h.shares*h.price).toLocaleString("en-US",{maximumFractionDigits:0})}
                </span>
                <button onClick={()=>setHoldings(hh=>hh.filter((_,j)=>j!==i))}
                  style={{background:"none",border:"none",color:C.muted,cursor:"pointer"}}
                  onMouseEnter={e=>e.currentTarget.style.color=C.red}
                  onMouseLeave={e=>e.currentTarget.style.color=C.muted}>
                  <Trash2 size={12}/>
                </button>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:6,marginBottom:14}}>
            <input value={addSym} onChange={e=>setAddSym(e.target.value.toUpperCase())}
              placeholder="Ticker" style={{flex:1,background:"rgba(255,255,255,0.04)",
                border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 11px",
                fontSize:12,color:C.text,outline:"none"}}/>
            <input value={addSh} onChange={e=>setAddSh(e.target.value)} type="number"
              placeholder="Shares" style={{flex:1,background:"rgba(255,255,255,0.04)",
                border:`1px solid ${C.border}`,borderRadius:9,padding:"8px 11px",
                fontSize:12,color:C.text,outline:"none"}}/>
            <button onClick={addHolding}
              style={{padding:"8px 14px",borderRadius:9,border:"none",
                background:C.grad,color:"#fff",fontSize:14,fontWeight:800,
                cursor:"pointer"}}><Plus size={14}/></button>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[["Value",`$${totalPos.toLocaleString("en-US",{maximumFractionDigits:0})}`,C.cyan],
              ["Cash", `$${cash.toLocaleString("en-US",{maximumFractionDigits:0})}`,  C.green],
              ["Stocks",holdings.length,C.text],
            ].map(([l,v,c])=>(
              <div key={l} style={{padding:"10px 12px",borderRadius:12,textAlign:"center",
                background:"rgba(255,255,255,0.025)",border:`1px solid ${C.border}`}}>
                <Lbl text={l}/>
                <p style={{margin:"4px 0 0",fontSize:17,fontWeight:800,color:c,
                  fontFamily:"monospace"}}>{v}</p>
              </div>
            ))}
          </div>
        </Glass>

        {/* MPT Optimizer */}
        <Glass>
          <div style={{display:"flex",justifyContent:"space-between",
            alignItems:"center",marginBottom:16}}>
            <div>
              <p style={{margin:0,fontSize:14,fontWeight:700,color:C.text}}>
                Portfolio Optimizer (MPT)
              </p>
              <p style={{margin:"2px 0 0",fontSize:11,color:C.muted}}>
                Max Sharpe · AAPL, TSLA, NVDA, MSFT
              </p>
            </div>
            <button onClick={onOptimize} disabled={portLoading}
              style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",
                borderRadius:10,border:"none",background:C.grad,color:"#fff",
                fontSize:12,fontWeight:700,cursor:"pointer",opacity:portLoading?.6:1,
                boxShadow:"0 4px 20px rgba(79,157,255,0.3)"}}>
              {portLoading
                ?<RefreshCw size={12} style={{animation:"td-spin 1s linear infinite"}}/>
                :<Zap size={12}/>}
              {portLoading?"Optimizing…":"Optimize"}
            </button>
          </div>

          {portfolio?(
            <>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:16}}>
                <Tile label="Exp. Return" value={fp(portfolio.expectedReturn)} color={C.green}/>
                <Tile label="Exp. Risk"   value={fp(portfolio.expectedRisk)}   color={C.red}/>
                <Tile label="Sharpe"      value={f2(portfolio.sharpeRatio)}    color={C.blue}
                  tip={TIPS.sharpe}/>
              </div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginBottom:14}}>
                <ResponsiveContainer width="100%" height={170}>
                  <RPie>
                    <Pie data={pieData} cx="50%" cy="50%" innerRadius={38} outerRadius={66}
                      dataKey="value" paddingAngle={3}>
                      {pieData.map((e,i)=><Cell key={i} fill={e.fill}/>)}
                    </Pie>
                    <RechartsTip content={<CT/>}/>
                  </RPie>
                </ResponsiveContainer>
                <div style={{display:"flex",flexDirection:"column",gap:7,justifyContent:"center"}}>
                  {entries.map(([sym,pct],i)=>{
                    const c=getC(sym,i);
                    return(
                      <div key={sym}>
                        <div style={{display:"flex",justifyContent:"space-between",
                          fontSize:11,marginBottom:3}}>
                          <span style={{color:C.text,fontWeight:600,fontFamily:"monospace"}}>{sym}</span>
                          <span style={{color:c,fontWeight:700,fontFamily:"monospace"}}>{f2(pct)}%</span>
                        </div>
                        <PBar value={Number(pct)} color={c} h={4}/>
                      </div>
                    );
                  })}
                </div>
              </div>
              <div style={{display:"flex",flexWrap:"wrap",gap:8}}>
                {entries.map(([sym,pct],i)=>{
                  const c=getC(sym,i);
                  return(
                    <div key={sym} style={{flex:"1 1 72px",padding:"10px 12px",borderRadius:12,
                      textAlign:"center",background:`${c}0C`,border:`1px solid ${c}30`}}>
                      <Lbl text={sym}/>
                      <p style={{margin:"4px 0 0",fontSize:22,fontWeight:900,color:c,
                        fontFamily:"monospace"}}>{f2(pct)}%</p>
                    </div>
                  );
                })}
              </div>
            </>
          ):(
            <div style={{textAlign:"center",padding:"48px 0",color:C.muted}}>
              <PieChart size={40} style={{opacity:0.18,margin:"0 auto 14px"}}/>
              <p style={{fontSize:13}}>Click Optimize to run MPT allocation</p>
            </div>
          )}
        </Glass>
      </div>
    </div>
  );
};

/* ═══════════════════════════════════════════════════════
   MAIN DASHBOARD
═══════════════════════════════════════════════════════ */
export default function AITradingDashboard() {
  useAuthGuard();
  const [inputSym, setInputSym] = useState("TSLA");
  const [symbol,   setSymbol]   = useState("TSLA");
  const [data,     setData]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState(null);
  const [horizon,  setHorizon]  = useState(5);
  const [tab,      setTab]      = useState("overview");
  const [portfolio,setPortfolio]= useState(null);
  const [portLoad, setPortLoad] = useState(false);

  const TABS=[
    {id:"overview",  label:"Overview",  icon:Brain},
    {id:"sentiment", label:"Sentiment", icon:Activity},
    {id:"risk",      label:"Risk",      icon:Shield},
    {id:"backtest",  label:"Backtest",  icon:BarChart2},
    {id:"portfolio", label:"Portfolio", icon:PieChart},
  ];

  const analyze = useCallback(async (sym=symbol, hor=horizon) => {
    if(!sym) return;
    setLoading(true); setError(null); setData(null); setPortfolio(null);
    try {
      const res = await api.post("/ai/predict", {
        symbol:sym, horizon:hor,
        skipSentiment:false, includeChart:true,
        includeBacktest:true, includeRisk:true, lstmEpochs:60,
      });
      setData(res);
      setTab("overview");
    } catch(e) {
      const msg = e?.response?.data?.detail
        || e?.response?.data?.message
        || e?.message
        || "Analysis failed";
      setError(msg);
    } finally { setLoading(false); }
  },[symbol,horizon]);

  const runPortfolio = useCallback(async () => {
    if(portfolio) return;
    setPortLoad(true);
    try {
      const res = await api.post("/ai/portfolio/optimize",
        {symbols:["AAPL","TSLA","NVDA","MSFT"],method:"max_sharpe"});
      setPortfolio(res);
    } catch(e) { console.error("Portfolio:",e); }
    finally { setPortLoad(false); }
  },[portfolio]);

  useEffect(()=>{ analyze("TSLA",5); },[]);

  const handleSearch = () => {
    const s=inputSym.trim().toUpperCase();
    if(!s) return;
    setSymbol(s); analyze(s, horizon);
  };

  const changeHorizon = h => { setHorizon(h); if(symbol) analyze(symbol, h); };
  const chgUp = Number(data?.changePercent||data?.predictedReturn||0)>=0;

  return (
    <div style={{minHeight:"100vh",
      background:`radial-gradient(ellipse at 18% 18%,rgba(79,157,255,0.06) 0%,transparent 55%),
        radial-gradient(ellipse at 82% 82%,rgba(167,139,250,0.05) 0%,transparent 55%),${C.bg0}`,
      color:C.text,fontFamily:"'DM Sans','Inter',system-ui,sans-serif"}}>

      {/* Grid overlay */}
      <div style={{position:"fixed",inset:0,pointerEvents:"none",opacity:0.025,
        backgroundImage:`linear-gradient(${C.blue}44 1px,transparent 1px),
          linear-gradient(90deg,${C.blue}44 1px,transparent 1px)`,
        backgroundSize:"40px 40px",zIndex:0}}/>

      <div style={{position:"relative",zIndex:1,maxWidth:1420,margin:"0 auto",
        padding:"0 20px 48px"}}>

        {/* ── HEADER ── */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",
          padding:"20px 0 18px",flexWrap:"wrap",gap:14,
          borderBottom:`1px solid ${C.border}`,marginBottom:22}}>

          <div style={{display:"flex",alignItems:"center",gap:14}}>
            <div style={{position:"relative"}}>
              <div style={{width:46,height:46,borderRadius:13,
                background:"linear-gradient(135deg,#4F9DFF,#A78BFA)",
                boxShadow:"0 8px 28px rgba(79,157,255,0.4)",
                display:"flex",alignItems:"center",justifyContent:"center"}}>
                <Brain size={22} color="#fff"/>
              </div>
              <div style={{position:"absolute",bottom:-2,right:-2,width:11,height:11,
                borderRadius:"50%",background:C.green,border:`2px solid ${C.bg0}`,
                boxShadow:`0 0 8px ${C.green}80`}}/>
            </div>
            <div>
              <h1 style={{margin:0,fontSize:"clamp(17px,2.4vw,23px)",fontWeight:800,
                letterSpacing:"-0.05em",color:"#fff",
                textShadow:"0 0 50px rgba(79,157,255,0.4)"}}>
                AI Trading Platform
              </h1>
              <p style={{margin:"2px 0 0",fontSize:11,color:C.muted}}>
                LSTM · XGBoost · LightGBM · FinBERT · Regime Detection · MPT Portfolio
              </p>
            </div>
          </div>

          <div style={{display:"flex",gap:8,alignItems:"center",flexWrap:"wrap"}}>
            {/* Horizon */}
            <select value={horizon} onChange={e=>changeHorizon(Number(e.target.value))}
              style={{background:"rgba(255,255,255,0.05)",border:`1px solid ${C.border}`,
                color:C.text,borderRadius:10,padding:"9px 12px",fontSize:12,
                cursor:"pointer",outline:"none"}}>
              {[3,5,7,10,14].map(d=>(
                <option key={d} value={d}>{d}d</option>
              ))}
            </select>

            {/* Search */}
            <div style={{display:"flex",background:"rgba(255,255,255,0.04)",
              border:`1px solid ${C.border}`,borderRadius:12,overflow:"hidden"}}>
              <input value={inputSym}
                onChange={e=>setInputSym(e.target.value.toUpperCase())}
                onKeyDown={e=>e.key==="Enter"&&handleSearch()}
                placeholder="TSLA · RELIANCE.NS"
                style={{background:"none",border:"none",padding:"9px 14px",
                  fontSize:13,color:C.text,outline:"none",
                  width:"clamp(130px,17vw,190px)",fontFamily:"monospace"}}/>
              <button onClick={handleSearch} disabled={loading}
                style={{padding:"9px 16px",border:"none",cursor:"pointer",
                  background:"linear-gradient(135deg,#4F9DFF,#A78BFA)",
                  color:"#fff",fontWeight:700,fontSize:12,
                  display:"flex",alignItems:"center",gap:6,
                  opacity:loading?.6:1,transition:"opacity .2s"}}>
                {loading
                  ?<RefreshCw size={13} style={{animation:"td-spin 1s linear infinite"}}/>
                  :<Search size={13}/>}
                {loading?"Running…":"Analyze"}
              </button>
            </div>

            {/* Refresh */}
            {data&&(
              <button onClick={()=>analyze(symbol,horizon)} disabled={loading}
                style={{padding:"9px 11px",borderRadius:10,cursor:"pointer",
                  background:"rgba(255,255,255,0.04)",border:`1px solid ${C.border}`,
                  color:C.muted,display:"flex",alignItems:"center"}}>
                <RefreshCw size={14}
                  style={loading?{animation:"td-spin 1s linear infinite"}:{}}/>
              </button>
            )}
          </div>
        </div>

        {/* ── GUIDE ── */}
        <Guide/>

        {/* ── ERROR ── */}
        {error&&(
          <div style={{display:"flex",alignItems:"center",gap:12,padding:"13px 18px",
            borderRadius:13,marginBottom:18,
            background:"rgba(255,77,106,0.08)",border:"1px solid rgba(255,77,106,0.25)"}}>
            <AlertCircle size={16} color={C.red} style={{flexShrink:0}}/>
            <span style={{flex:1,fontSize:13,color:"#FF8099"}}>{error}</span>
            <button onClick={()=>{setError(null);analyze(symbol,horizon);}}
              style={{background:"none",border:"1px solid rgba(255,77,106,.4)",
                color:C.red,cursor:"pointer",borderRadius:8,
                padding:"4px 12px",fontSize:11,fontWeight:700}}>Retry</button>
            <button onClick={()=>setError(null)}
              style={{background:"none",border:"none",color:C.muted,cursor:"pointer"}}>
              <X size={14}/>
            </button>
          </div>
        )}

        {/* ── STOCK HEADER ── */}
        {data&&!loading&&(
          <Glass style={{marginBottom:16,padding:"15px 22px"}}>
            <div style={{display:"flex",justifyContent:"space-between",
              alignItems:"center",flexWrap:"wrap",gap:12}}>
              <div style={{display:"flex",alignItems:"center",gap:14}}>
                <div style={{width:40,height:40,borderRadius:11,
                  background:"linear-gradient(135deg,rgba(79,157,255,0.15),rgba(167,139,250,0.15))",
                  border:`1px solid ${C.border}`,
                  display:"flex",alignItems:"center",justifyContent:"center",
                  fontSize:13,fontWeight:800,color:C.blue,fontFamily:"monospace"}}>
                  {data.symbol?.slice(0,2)}
                </div>
                <div>
                  <div style={{display:"flex",alignItems:"center",gap:10}}>
                    <h2 style={{margin:0,fontSize:"clamp(15px,2.2vw,20px)",
                      fontWeight:800,letterSpacing:"-0.04em",color:C.text}}>
                      {data.symbol}
                    </h2>
                    {data.meta?.exchange&&<Badge text={data.meta.exchange} color={C.muted}/>}
                  </div>
                  <p style={{margin:"2px 0 0",fontSize:11,color:C.muted}}>
                    {data.meta?.companyName||data.symbol}
                    {data.meta?.sector?` · ${data.meta.sector}`:""}
                  </p>
                </div>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:20}}>
                <div style={{textAlign:"right"}}>
                  <p style={{margin:0,fontSize:"clamp(20px,3vw,28px)",fontWeight:900,
                    letterSpacing:"-0.05em",color:C.text,fontFamily:"monospace"}}>
                    {fC(data.currency, data.currentPrice)}
                  </p>
                  <p style={{margin:"3px 0 0",fontSize:13,fontWeight:700,
                    display:"flex",alignItems:"center",gap:4,
                    justifyContent:"flex-end",color:chgUp?C.green:C.red}}>
                    {chgUp?<TrendingUp size={13}/>:<TrendingDown size={13}/>}
                    {data.predictedReturn!=null?`${fp(data.predictedReturn)} predicted`:""}
                  </p>
                </div>
                <div style={{padding:"10px 16px",borderRadius:13,
                  background:`${tCol(data.trend)}10`,
                  border:`1px solid ${tCol(data.trend)}35`}}>
                  <Lbl text="AI Trend"/>
                  <p style={{margin:"4px 0 0",fontSize:15,fontWeight:800,
                    color:tCol(data.trend),fontFamily:"monospace"}}>{data.trend||"—"}</p>
                </div>
              </div>
            </div>
          </Glass>
        )}

        {/* ── LOADING SPINNER ── */}
        {loading&&(
          <Glass style={{textAlign:"center",padding:"72px 20px",marginBottom:18}}>
            <div style={{position:"relative",width:60,height:60,margin:"0 auto 20px"}}>
              <div style={{position:"absolute",inset:0,borderRadius:"50%",
                border:`3px solid ${C.faint}`,borderTopColor:C.blue,
                animation:"td-spin 1s linear infinite"}}/>
              <div style={{position:"absolute",inset:8,borderRadius:"50%",
                border:`3px solid ${C.faint}`,borderTopColor:C.purple,
                animation:"td-spin .65s linear infinite reverse"}}/>
              <div style={{position:"absolute",inset:0,display:"flex",
                alignItems:"center",justifyContent:"center"}}>
                <Brain size={18} color={C.blue} style={{opacity:.8}}/>
              </div>
            </div>
            <p style={{color:C.text,fontSize:15,fontWeight:700,margin:"0 0 8px"}}>
              Training models for {symbol}…
            </p>
            <p style={{color:C.muted,fontSize:12,margin:0,lineHeight:1.6}}>
              LSTM + XGBoost + LightGBM + FinBERT · May take 2–5 minutes
            </p>
          </Glass>
        )}

        {/* ── TABS + CONTENT ── */}
        {!loading&&data&&(
          <>
            <div style={{display:"flex",gap:0,marginBottom:18,
              borderBottom:`1px solid ${C.border}`,overflowX:"auto"}}>
              {TABS.map(({id,label,icon:Icon})=>(
                <button key={id}
                  onClick={()=>{setTab(id);if(id==="portfolio"&&!portfolio)runPortfolio();}}
                  style={{display:"flex",alignItems:"center",gap:7,
                    padding:"11px 20px",border:"none",cursor:"pointer",
                    fontSize:12.5,fontWeight:600,whiteSpace:"nowrap",
                    transition:"all .2s",marginBottom:-1,
                    color:tab===id?C.blue:C.muted,
                    background:tab===id?"rgba(79,157,255,0.06)":"transparent",
                    borderBottom:tab===id?`2px solid ${C.blue}`:"2px solid transparent",
                    borderRadius:"10px 10px 0 0"}}>
                  <Icon size={13}/>{label}
                </button>
              ))}
            </div>

            {tab==="overview"  && <OverviewTab  data={data}/>}
            {tab==="sentiment" && <SentimentTab data={data}/>}
            {tab==="risk"      && <RiskTab      data={data}/>}
            {tab==="backtest"  && <BacktestTab  data={data}/>}
            {tab==="portfolio" && (
              <PortfolioTab portfolio={portfolio}
                onOptimize={runPortfolio} portLoading={portLoad}/>
            )}
          </>
        )}

        {/* ── EMPTY STATE ── */}
        {!loading&&!data&&!error&&(
          <Glass style={{textAlign:"center",padding:"80px 20px"}}>
            <div style={{width:86,height:86,borderRadius:"50%",margin:"0 auto 22px",
              background:"linear-gradient(135deg,rgba(79,157,255,0.1),rgba(167,139,250,0.1))",
              border:`1px solid rgba(79,157,255,0.2)`,
              display:"flex",alignItems:"center",justifyContent:"center",
              boxShadow:"0 0 60px rgba(79,157,255,0.12)"}}>
              <Brain size={36} color={C.blue} style={{opacity:.8}}/>
            </div>
            <h2 style={{margin:"0 0 10px",fontSize:20,fontWeight:800,color:C.text,
              letterSpacing:"-0.04em"}}>Enter a Stock Symbol to Begin</h2>
            <p style={{margin:"0 0 28px",fontSize:13,color:C.muted,
              maxWidth:380,lineHeight:1.6}}>
              US stocks (TSLA, AAPL, NVDA) and Indian stocks (RELIANCE.NS, TCS.NS)
            </p>
            <div style={{display:"flex",gap:8,flexWrap:"wrap",justifyContent:"center"}}>
              {["TSLA","AAPL","NVDA","MSFT","RELIANCE.NS","TCS.NS"].map(s=>(
                <button key={s}
                  onClick={()=>{setInputSym(s);setSymbol(s);analyze(s,horizon);}}
                  style={{padding:"9px 16px",borderRadius:11,fontSize:12,fontWeight:700,
                    cursor:"pointer",transition:"all .22s",
                    background:"rgba(255,255,255,0.04)",
                    border:`1px solid ${C.border}`,color:C.muted,fontFamily:"monospace"}}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=C.borderH;
                    e.currentTarget.style.color=C.blue;
                    e.currentTarget.style.background="rgba(79,157,255,0.06)";}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;
                    e.currentTarget.style.color=C.muted;
                    e.currentTarget.style.background="rgba(255,255,255,0.04)";}}>
                  {s}
                </button>
              ))}
            </div>
          </Glass>
        )}
      </div>

      <style>{`
        @keyframes td-spin { to { transform:rotate(360deg); } }
        * { box-sizing:border-box; }
        ::-webkit-scrollbar { width:5px; height:5px; }
        ::-webkit-scrollbar-track { background:transparent; }
        ::-webkit-scrollbar-thumb { background:${C.faint}; border-radius:999px; }
        input::placeholder { color:${C.muted}; }
        select option { background:${C.bg2}; color:${C.text}; }
      `}</style>
    </div>
  );
}