import React, { useState, useCallback } from "react";
import { ArrowLeft, Lightbulb, Brain, RefreshCw, X, BarChart3, TrendingUp, TrendingDown } from "lucide-react";
import { Link } from "react-router-dom";
import { ResponsiveContainer, AreaChart, Area, BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
import AppShell from "./AppShell.jsx";
import { useTheme } from "../context/ThemeContext.jsx";
import { tokens }   from "../context/theme.js";
import { api }      from "../utils/api.js";
import useAuthGuard from "../hooks/useAuthGuard.js";

const isIndian = s => s?.endsWith(".NS")||s?.endsWith(".BO");
const fmtPrice = (v,sym="") => v==null?"--":`${isIndian(sym)?"₹":"$"}${Number(v).toFixed(2)}`;
const fmtVol   = v => v?`${(Number(v)/1e6).toFixed(2)}M`:"--";
const RANGES   = ["1W","1M","3M","6M","1Y"];
const PALETTE  = {
  A:{line:"#3b82f6",accent:"#3b82f6"},
  B:{line:"#10b981",accent:"#10b981"},
};
const calcTrend = chart => {
  if(!chart||chart.length<2) return null;
  const first=Number(chart[0].close), last=Number(chart[chart.length-1].close);
  const pct=(((last-first)/first)*100).toFixed(2);
  return {pct,up:Number(pct)>=0};
};

const Compare = () => {
  useAuthGuard();
  const { isDark } = useTheme();
  const t          = tokens(isDark);
  const [stockA, setStockA] = useState(null);
  const [stockB, setStockB] = useState(null);
  const [aiA,    setAiA]    = useState(null);
  const [aiB,    setAiB]    = useState(null);
  const [loadingAI, setLoadingAI] = useState(false);

  const combined = (() => {
    if(!stockA?.chart||!stockB?.chart) return [];
    const mapA={};
    stockA.chart.forEach(d=>{mapA[d.date]=d.close;});
    return stockB.chart.filter(d=>mapA[d.date]!=null).map(d=>({date:d.date,closeA:mapA[d.date],closeB:d.close}));
  })();
  const bothLoaded = stockA&&!stockA.error&&stockB&&!stockB.error;

  const runBothAI = async () => {
    if(!bothLoaded) return;
    setLoadingAI(true);
    try {
      const [rA,rB] = await Promise.all([api.post("/ai/analyze",stockA),api.post("/ai/analyze",stockB)]);
      if(rA) setAiA(rA); if(rB) setAiB(rB);
    } catch(e){console.error(e);} finally{setLoadingAI(false);}
  };

  const panel = (accent) => ({
    background: isDark?`linear-gradient(135deg,rgba(255,255,255,0.05) 0%,rgba(255,255,255,0.02) 100%)`:`linear-gradient(135deg,rgba(255,255,255,0.90) 0%,rgba(255,255,255,0.70) 100%)`,
    border:`1px solid ${accent?accent+"28":t.border}`, borderRadius:20,
    backdropFilter:"blur(20px)", WebkitBackdropFilter:"blur(20px)",
    boxShadow:t.shadow, transition:"background 0.35s, border-color 0.35s",
  });

  return (
    <AppShell activePage="/compare">
      <Link to="/dashboard" style={{display:"inline-flex",alignItems:"center",gap:6,fontSize:13,color:t.textSecondary,marginBottom:22,transition:"color 0.2s"}}
        onMouseEnter={e=>e.currentTarget.style.color=t.textPrimary}
        onMouseLeave={e=>e.currentTarget.style.color=t.textSecondary}
      >
        <ArrowLeft size={14}/> Back to Dashboard
      </Link>

      <div style={{marginBottom:24,animation:"slideUp 0.5s ease both"}}>
        <h1 style={{margin:0,fontSize:24,fontWeight:800,letterSpacing:"-0.04em",color:t.textPrimary}}>Compare Stocks</h1>
        <p style={{margin:"4px 0 0",fontSize:13,color:t.textMuted}}>Analyze two stocks side by side with AI predictions</p>
      </div>

      {/* TWO STOCK CARDS */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:18,marginBottom:20,animation:"slideUp 0.5s 0.08s ease both"}}>
        <StockCard title="Stock A" side="A" onLoad={setStockA} t={t} isDark={isDark} panel={panel}/>
        <StockCard title="Stock B" side="B" onLoad={setStockB} t={t} isDark={isDark} panel={panel}/>
      </div>

      {/* COMBINED CHART */}
      {bothLoaded&&combined.length>0&&(
        <div style={{...panel(),padding:22,marginBottom:18,animation:"slideUp 0.5s 0.14s ease both"}}>
          <h3 style={{margin:"0 0 4px",fontWeight:700,color:t.textPrimary}}>Price Comparison</h3>
          <p style={{margin:"0 0 16px",fontSize:12,color:t.textMuted}}>
            <span style={{color:"#60a5fa",fontWeight:600}}>{stockA.symbol}</span> vs <span style={{color:"#34d399",fontWeight:600}}>{stockB.symbol}</span>
          </p>
          <div style={{height:260}}>
            <ResponsiveContainer>
              <LineChart data={combined}>
                <CartesianGrid stroke={t.chartGrid} strokeDasharray="4 4" vertical={false}/>
                <XAxis dataKey="date" hide/>
                <YAxis yAxisId="A" orientation="left" tick={{fill:t.chartTick,fontSize:10}} tickLine={false} axisLine={false}
                  tickFormatter={v=>`${isIndian(stockA.symbol)?"₹":"$"}${Number(v).toFixed(0)}`} width={58}/>
                <YAxis yAxisId="B" orientation="right" tick={{fill:t.chartTick,fontSize:10}} tickLine={false} axisLine={false}
                  tickFormatter={v=>`${isIndian(stockB.symbol)?"₹":"$"}${Number(v).toFixed(0)}`} width={58}/>
                <Tooltip contentStyle={{background:t.modalBg,border:`1px solid ${t.border}`,borderRadius:10,fontSize:12,color:t.textPrimary}}/>
                <Line yAxisId="A" type="monotone" dataKey="closeA" stroke="#3b82f6" strokeWidth={2.5} dot={false} activeDot={{r:4,fill:"#3b82f6"}}/>
                <Line yAxisId="B" type="monotone" dataKey="closeB" stroke="#10b981" strokeWidth={2.5} dot={false} activeDot={{r:4,fill:"#10b981"}}/>
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* METRICS TABLE */}
      {bothLoaded&&(
        <div style={{...panel(),padding:22,marginBottom:18,animation:"slideUp 0.5s 0.18s ease both"}}>
          <h3 style={{margin:"0 0 16px",fontWeight:700,color:t.textPrimary}}>Metrics Comparison</h3>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",fontSize:13,borderCollapse:"collapse"}}>
              <thead>
                <tr style={{borderBottom:`1px solid ${t.border}`}}>
                  <th style={{textAlign:"left",padding:"8px 12px 8px 0",color:t.textMuted,fontWeight:600}}>Metric</th>
                  <th style={{textAlign:"right",padding:"8px",color:"#60a5fa",fontWeight:700}}>{stockA.symbol}</th>
                  <th style={{textAlign:"right",padding:"8px",color:"#34d399",fontWeight:700}}>{stockB.symbol}</th>
                  <th style={{textAlign:"right",padding:"8px 0 8px 8px",color:t.textMuted,fontWeight:600}}>Winner</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {label:"Price",      a:fmtPrice(stockA.price,stockA.symbol),  b:fmtPrice(stockB.price,stockB.symbol),  noWinner:true},
                  {label:"Change %",   a:`${stockA.changePercent}%`,            b:`${stockB.changePercent}%`,            aNum:Number(stockA.changePercent),bNum:Number(stockB.changePercent),higherIsBetter:true},
                  {label:"Day High",   a:fmtPrice(stockA.high,stockA.symbol),   b:fmtPrice(stockB.high,stockB.symbol),   noWinner:true},
                  {label:"Day Low",    a:fmtPrice(stockA.low,stockA.symbol),    b:fmtPrice(stockB.low,stockB.symbol),    noWinner:true},
                  {label:"Prev Close", a:fmtPrice(stockA.prevClose,stockA.symbol),b:fmtPrice(stockB.prevClose,stockB.symbol),noWinner:true},
                  {label:"RSI (14)",   a:stockA.indicators?.rsi?.toFixed(1)??"--",b:stockB.indicators?.rsi?.toFixed(1)??"--",aNum:stockA.indicators?.rsi,bNum:stockB.indicators?.rsi,rsi:true},
                  {label:"Signal",     a:stockA.indicators?.signal??"--",       b:stockB.indicators?.signal??"--",       signal:true},
                ].map((row,i)=>{
                  let winner=null;
                  if(!row.noWinner&&!row.signal&&row.aNum!=null&&row.bNum!=null){
                    winner=row.rsi?Math.abs(row.aNum-50)<Math.abs(row.bNum-50)?"A":"B":row.higherIsBetter?row.aNum>=row.bNum?"A":"B":null;
                  }
                  return (
                    <tr key={i} style={{borderBottom:`1px solid ${t.border}22`}}>
                      <td style={{padding:"10px 12px 10px 0",color:t.textMuted}}>{row.label}</td>
                      <td style={{padding:"10px 8px",textAlign:"right",fontWeight:600,color:winner==="A"?"#60a5fa":t.textPrimary}}>{row.a}</td>
                      <td style={{padding:"10px 8px",textAlign:"right",fontWeight:600,color:winner==="B"?"#34d399":t.textPrimary}}>{row.b}</td>
                      <td style={{padding:"10px 0 10px 8px",textAlign:"right"}}>
                        {winner==="A"&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(59,130,246,0.14)",color:"#60a5fa",border:"1px solid rgba(59,130,246,0.22)"}}>A ✓</span>}
                        {winner==="B"&&<span style={{fontSize:10,padding:"2px 8px",borderRadius:20,background:"rgba(16,185,129,0.14)",color:"#34d399",border:"1px solid rgba(16,185,129,0.22)"}}>B ✓</span>}
                        {row.signal&&<div style={{display:"flex",gap:4,justifyContent:"flex-end"}}><SigBadge v={row.a}/><SigBadge v={row.b}/></div>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI VERDICT */}
      {bothLoaded&&(
        <div style={{...panel(),padding:22,marginBottom:18,animation:"slideUp 0.5s 0.22s ease both"}}>
          <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:16}}>
            <h3 style={{margin:0,fontWeight:700,display:"flex",alignItems:"center",gap:8,color:t.textPrimary}}>
              <Brain size={16} style={{color:"#60a5fa"}}/> AI Verdict
            </h3>
            {!aiA&&!aiB&&(
              <button onClick={runBothAI} disabled={loadingAI} style={{display:"flex",alignItems:"center",gap:6,padding:"8px 16px",borderRadius:11,fontSize:12,fontWeight:600,background:"linear-gradient(135deg,#3b82f6,#6366f1)",border:"none",color:"#fff",cursor:"pointer",opacity:loadingAI?0.6:1,boxShadow:"0 4px 14px rgba(59,130,246,0.3)",transition:"all 0.2s"}}>
                {loadingAI?<><RefreshCw size={13} style={{animation:"spin 1s linear infinite"}}/> Analyzing...</>:<><Brain size={13}/> Analyze Both</>}
              </button>
            )}
          </div>
          {!aiA&&!aiB&&!loadingAI&&<p style={{textAlign:"center",padding:"20px 0",fontSize:13,color:t.textMuted}}>Click "Analyze Both" to get AI predictions</p>}
          {(aiA||aiB)&&(
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:14}}>
              {aiA&&<AICard ai={aiA} symbol={stockA?.symbol} color="#3b82f6" t={t}/>}
              {aiB&&<AICard ai={aiB} symbol={stockB?.symbol} color="#10b981" t={t}/>}
            </div>
          )}
        </div>
      )}

      {/* TIPS */}
      <div style={{...panel(),padding:18,animation:"slideUp 0.5s 0.26s ease both"}}>
        <h3 style={{margin:"0 0 12px",fontSize:13,fontWeight:700,display:"flex",alignItems:"center",gap:7,color:t.textPrimary}}>
          <Lightbulb size={14} style={{color:"#fbbf24"}}/> Comparison Tips
        </h3>
        <ul style={{margin:0,padding:"0 0 0 16px",fontSize:12,color:t.textMuted,lineHeight:1.8}}>
          <li>Compare stocks from the same sector for better insights</li>
          <li>Higher confidence % = stronger AI prediction</li>
          <li>Indian stocks (NSE) show prices in ₹ — US stocks in $</li>
          <li>Use the combined chart to see price divergence over time</li>
        </ul>
      </div>
    </AppShell>
  );
};

/* STOCK CARD */
const StockCard = ({title,side,onLoad,t,isDark,panel}) => {
  const pal = PALETTE[side];
  const [symbol,  setSymbol]  = useState("");
  const [stock,   setStock]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [range,   setRange]   = useState("1M");
  const [cType,   setCType]   = useState("area");
  const [ai,      setAi]      = useState(null);
  const [aiLoad,  setAiLoad]  = useState(false);
  const [error,   setError]   = useState("");

  const fetch = useCallback(async(sym,r)=>{
    const s=(sym||symbol).toUpperCase(), q=r||range;
    if(!s) return;
    setError(""); setLoading(true); setAi(null);
    try {
      const d=await api.get(`/stock/${s}?range=${q}`);
      if(!d) return; if(d.error) throw new Error(d.error);
      setStock(d); onLoad?.(d);
    } catch(err){setError(err.message||"Symbol not found");setStock(null);onLoad?.(null);}
    finally{setLoading(false);}
  },[symbol,range,onLoad]);

  const handleRange=r=>{setRange(r);if(stock)fetch(stock.symbol,r);};
  const handleClear=()=>{setStock(null);setSymbol("");setAi(null);setError("");onLoad?.(null);};
  const runAI=async()=>{
    if(!stock) return; setAiLoad(true);
    try{const d=await api.post("/ai/analyze",stock);if(d)setAi(d);}
    catch(e){console.error(e);}finally{setAiLoad(false);}
  };

  const trend=calcTrend(stock?.chart);
  const curr=isIndian(stock?.symbol)?"₹":"$";
  const tickFmt=d=>{const dt=new Date(d);return `${dt.toLocaleString("default",{month:"short"})} ${dt.getDate()}`;};
  const tickInt=stock?.chart?Math.max(1,Math.floor(stock.chart.length/5)):1;

  return (
    <div style={{...panel(pal.accent)}}>
      {/* Card header */}
      <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"16px 18px 10px"}}>
        <span style={{fontWeight:700,fontSize:14,display:"flex",alignItems:"center",gap:8,color:pal.accent}}>
          <span style={{width:24,height:24,borderRadius:"50%",background:`${pal.accent}20`,border:`1px solid ${pal.accent}35`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:11,fontWeight:800,color:pal.accent}}>{side}</span>
          {title}
        </span>
        {stock&&<button onClick={handleClear} style={{padding:5,borderRadius:7,background:t.inputBg,border:`1px solid ${t.border}`,color:t.textMuted,cursor:"pointer"}}><X size={13}/></button>}
      </div>

      {/* Search */}
      <div style={{padding:"0 16px 14px"}}>
        <div style={{display:"flex",gap:8}}>
          <input value={symbol} onChange={e=>setSymbol(e.target.value.toUpperCase())} onKeyDown={e=>e.key==="Enter"&&fetch()}
            placeholder="AAPL, TCS.NS, RELIANCE.NS"
            style={{flex:1,background:t.inputBg,border:`1px solid ${t.inputBorder}`,borderRadius:10,padding:"8px 13px",fontSize:12,color:t.textPrimary,outline:"none",transition:"all 0.2s"}}
            onFocus={e=>{e.target.style.borderColor=pal.accent+"80";}}
            onBlur={e=>{e.target.style.borderColor=t.inputBorder;}}
          />
          <button onClick={()=>fetch()} disabled={loading||!symbol} style={{padding:"8px 14px",borderRadius:10,fontSize:12,fontWeight:600,background:`linear-gradient(135deg,${pal.accent},${pal.accent}cc)`,border:"none",color:"#fff",cursor:"pointer",opacity:loading||!symbol?0.5:1,transition:"all 0.2s"}}>
            {loading?<RefreshCw size={12} style={{animation:"spin 1s linear infinite"}}/>:"Search"}
          </button>
        </div>
        {error&&<p style={{fontSize:11,color:"#f87171",margin:"6px 0 0"}}>{error}</p>}
      </div>

      {!stock&&!loading&&(
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"50px 20px",color:t.textMuted}}>
          <BarChart3 size={32} style={{marginBottom:10,opacity:0.25}}/>
          <p style={{fontSize:12,margin:0}}>Search a stock to compare</p>
        </div>
      )}
      {loading&&<div style={{display:"flex",justifyContent:"center",padding:"50px 0",color:t.textMuted}}><RefreshCw size={18} style={{animation:"spin 1s linear infinite",marginRight:8}}/>Loading...</div>}

      {stock&&!loading&&(
        <>
          {/* Price header */}
          <div style={{margin:"0 16px 14px",padding:14,background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:13,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:10}}>
              <div style={{width:36,height:36,borderRadius:10,background:`${pal.accent}18`,border:`1px solid ${pal.accent}28`,display:"flex",alignItems:"center",justifyContent:"center"}}>
                <BarChart3 size={16} style={{color:pal.accent}}/>
              </div>
              <div>
                <div style={{display:"flex",alignItems:"center",gap:6}}>
                  <p style={{fontWeight:700,color:t.textPrimary,margin:0,fontSize:13}}>{stock.symbol}</p>
                  {isIndian(stock.symbol)&&<span style={{fontSize:9,padding:"1px 5px",borderRadius:5,background:"rgba(251,146,60,0.14)",color:"#fb923c",border:"1px solid rgba(251,146,60,0.22)",fontWeight:600}}>NSE</span>}
                </div>
                <p style={{fontSize:10,color:t.textMuted,margin:"2px 0 0"}}>{stock.name||stock.symbol}</p>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <p style={{fontSize:20,fontWeight:800,color:t.textPrimary,margin:0}}>{curr}{stock.price}</p>
              <p style={{fontSize:11,fontWeight:600,margin:0,color:Number(stock.changePercent)>=0?"#34d399":"#f87171",display:"flex",alignItems:"center",justifyContent:"flex-end",gap:3}}>
                {Number(stock.changePercent)>=0?<TrendingUp size={11}/>:<TrendingDown size={11}/>}
                {Number(stock.changePercent)>=0?"+":""}{stock.changePercent}%
              </p>
            </div>
          </div>

          {/* Range + Chart */}
          <div style={{padding:"0 16px 14px"}}>
            <div style={{display:"flex",gap:4,marginBottom:10}}>
              {RANGES.map(r=>(
                <button key={r} onClick={()=>handleRange(r)} style={{padding:"4px 10px",borderRadius:7,fontSize:11,fontWeight:600,cursor:"pointer",border:"none",background:range===r?`${pal.accent}22`:"transparent",color:range===r?pal.accent:t.textMuted,transition:"all 0.2s"}}>
                  {r}
                </button>
              ))}
              <div style={{marginLeft:"auto",display:"flex",gap:3}}>
                {[["area",<TrendingUp size={11}/>],["bar",<BarChart3 size={11}/>]].map(([ct,ic])=>(
                  <button key={ct} onClick={()=>setCType(ct)} style={{padding:"4px 8px",borderRadius:7,background:cType===ct?`${pal.accent}22`:"transparent",border:"none",color:cType===ct?pal.accent:t.textMuted,cursor:"pointer",transition:"all 0.2s"}}>{ic}</button>
                ))}
              </div>
            </div>
            {stock.chart?.length>0?(
              <div style={{height:200}}>
                <ResponsiveContainer width="100%" height="100%">
                  {cType==="area"?(
                    <AreaChart data={stock.chart} margin={{top:4,right:2,left:0,bottom:0}}>
                      <defs>
                        <linearGradient id={`ag${side}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%"  stopColor={pal.line} stopOpacity={0.28}/>
                          <stop offset="95%" stopColor={pal.line} stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke={t.chartGrid} strokeDasharray="4 4" vertical={false}/>
                      <XAxis dataKey="date" tick={{fill:t.chartTick,fontSize:10}} tickLine={false} axisLine={false} tickFormatter={tickFmt} interval={tickInt}/>
                      <YAxis tick={{fill:t.chartTick,fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>`${curr}${Number(v).toFixed(0)}`} domain={["auto","auto"]} width={52}/>
                      <Tooltip contentStyle={{background:t.modalBg,border:`1px solid ${t.border}`,borderRadius:9,fontSize:11,color:t.textPrimary}}/>
                      <Area type="monotone" dataKey="close" stroke={pal.line} strokeWidth={2.5} fill={`url(#ag${side})`} dot={false} activeDot={{r:4,fill:pal.line}}/>
                    </AreaChart>
                  ):(
                    <BarChart data={stock.chart} margin={{top:4,right:2,left:0,bottom:0}}>
                      <CartesianGrid stroke={t.chartGrid} strokeDasharray="4 4" vertical={false}/>
                      <XAxis dataKey="date" tick={{fill:t.chartTick,fontSize:10}} tickLine={false} axisLine={false} tickFormatter={tickFmt} interval={tickInt}/>
                      <YAxis tick={{fill:t.chartTick,fontSize:10}} tickLine={false} axisLine={false} tickFormatter={v=>`${curr}${Number(v).toFixed(0)}`} domain={["auto","auto"]} width={52}/>
                      <Tooltip contentStyle={{background:t.modalBg,border:`1px solid ${t.border}`,borderRadius:9,fontSize:11,color:t.textPrimary}}/>
                      <Bar dataKey="close" fill={pal.line} radius={[3,3,0,0]} opacity={0.85}/>
                    </BarChart>
                  )}
                </ResponsiveContainer>
              </div>
            ):(
              <div style={{height:200,display:"flex",alignItems:"center",justifyContent:"center",color:t.textMuted,fontSize:12}}>No chart data</div>
            )}
            {trend&&(
              <div style={{display:"flex",justifyContent:"space-between",marginTop:10,padding:"8px 12px",background:t.inputBg,borderRadius:9,fontSize:12}}>
                <span style={{color:t.textMuted}}>Trend ({range})</span>
                <span style={{fontWeight:700,color:trend.up?"#34d399":"#f87171",display:"flex",alignItems:"center",gap:4}}>
                  {trend.up?<TrendingUp size={12}/>:<TrendingDown size={12}/>}
                  {trend.up?"Uptrend":"Downtrend"} ({trend.up?"+":""}{trend.pct}%)
                </span>
              </div>
            )}
          </div>

          {/* Metrics */}
          <div style={{padding:"0 16px 14px",display:"grid",gridTemplateColumns:"1fr 1fr",gap:7}}>
            {[
              ["Open",      fmtPrice(stock.open,      stock.symbol)],
              ["Prev Close",fmtPrice(stock.prevClose, stock.symbol)],
              ["High",      fmtPrice(stock.high,      stock.symbol)],
              ["Low",       fmtPrice(stock.low,       stock.symbol)],
              ["Volume",    fmtVol(stock.chart?.at(-1)?.volume)],
              ["RSI (14)",  stock.indicators?.rsi?.toFixed(1)??"--"],
            ].map(([l,v])=>(
              <div key={l} style={{background:t.inputBg,border:`1px solid ${t.border}`,borderRadius:9,padding:"8px 11px"}}>
                <p style={{fontSize:10,color:t.textMuted,margin:0}}>{l}</p>
                <p style={{fontSize:13,fontWeight:600,color:t.textPrimary,margin:"2px 0 0"}}>{v}</p>
              </div>
            ))}
          </div>

          {/* AI result */}
          {ai&&(
            <div style={{margin:"0 16px 12px",padding:13,borderRadius:12,background:ai.action==="BUY"?"rgba(16,185,129,0.10)":ai.action==="SELL"?"rgba(248,113,113,0.10)":"rgba(234,179,8,0.10)",border:`1px solid ${ai.action==="BUY"?"rgba(16,185,129,0.22)":ai.action==="SELL"?"rgba(248,113,113,0.22)":"rgba(234,179,8,0.22)"}`}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
                <span style={{fontSize:18,fontWeight:800,color:ai.action==="BUY"?"#34d399":ai.action==="SELL"?"#f87171":"#fbbf24"}}>{ai.action}</span>
                <span style={{fontSize:11,color:t.textMuted,background:"rgba(0,0,0,0.2)",padding:"2px 8px",borderRadius:20}}>{ai.confidence}% confidence</span>
              </div>
              <p style={{fontSize:11,color:t.textMuted,margin:0,lineHeight:1.5}}>{ai.summary}</p>
            </div>
          )}

          {/* Run AI button */}
          <div style={{padding:"0 16px 16px"}}>
            <button onClick={runAI} disabled={aiLoad} style={{width:"100%",padding:"10px",borderRadius:11,fontSize:13,fontWeight:600,background:"linear-gradient(135deg,#3b82f6,#6366f1)",border:"none",color:"#fff",cursor:"pointer",opacity:aiLoad?0.6:1,display:"flex",alignItems:"center",justifyContent:"center",gap:7,boxShadow:"0 4px 14px rgba(59,130,246,0.28)",transition:"all 0.2s"}}>
              {aiLoad?<><RefreshCw size={13} style={{animation:"spin 1s linear infinite"}}/> Analyzing...</>:<><Brain size={13}/> Run AI Analysis</>}
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const AICard = ({ai,symbol,color,t}) => (
  <div style={{borderRadius:14,padding:16,background:`${color}12`,border:`1px solid ${color}28`}}>
    <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
      <span style={{fontWeight:700,color:color,fontSize:13}}>{symbol}</span>
      <span style={{fontSize:10,color:t.textMuted,background:"rgba(0,0,0,0.2)",padding:"2px 8px",borderRadius:20}}>{ai.confidence}% conf.</span>
    </div>
    <p style={{fontSize:20,fontWeight:800,margin:"0 0 6px",color:ai.action==="BUY"?"#34d399":ai.action==="SELL"?"#f87171":"#fbbf24"}}>{ai.action}</p>
    <p style={{fontSize:11,color:t.textMuted,margin:0,lineHeight:1.5}}>{ai.summary}</p>
  </div>
);

const SigBadge = ({v}) => (
  <span style={{fontSize:10,padding:"2px 7px",borderRadius:20,fontWeight:700,background:v==="BUY"?"rgba(16,185,129,0.14)":v==="SELL"?"rgba(248,113,113,0.14)":"rgba(234,179,8,0.14)",color:v==="BUY"?"#34d399":v==="SELL"?"#f87171":"#fbbf24",border:`1px solid ${v==="BUY"?"rgba(16,185,129,0.22)":v==="SELL"?"rgba(248,113,113,0.22)":"rgba(234,179,8,0.22)"}`}}>{v}</span>
);

export default Compare;