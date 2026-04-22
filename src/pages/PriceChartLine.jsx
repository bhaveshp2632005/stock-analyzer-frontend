import { useEffect, useRef, useCallback } from "react";
import { useTheme } from "../context/ThemeContext.jsx";

const PriceChartLine = ({ data = [] }) => {
  const { isDark }   = useTheme();
  const containerRef = useRef(null);
  const canvasRef    = useRef(null);
  const rafRef       = useRef(null);
  const mouseRef     = useRef(null);

  const draw = useCallback(() => {
    const el = containerRef.current, c = canvasRef.current;
    if (!c || !el || !data.length) return;
    const dpr = window.devicePixelRatio || 1;
    const W = el.clientWidth, H = 420;
    c.width = W*dpr; c.height = H*dpr;
    c.style.width=W+"px"; c.style.height=H+"px";
    const ctx = c.getContext("2d");
    ctx.save(); ctx.scale(dpr,dpr);

    const BG     = isDark ? "#050810" : "#f8faff";
    const GRID   = isDark ? "#1a2235" : "#e2e8f0";
    const AXIS   = isDark ? "#64748b" : "#94a3b8";
    const CROSS  = isDark ? "rgba(148,163,184,0.5)" : "rgba(71,85,105,0.4)";
    const TIP_BG = isDark ? "rgba(13,18,32,0.96)" : "rgba(255,255,255,0.97)";
    const TIP_BD = isDark ? "rgba(59,130,246,0.35)" : "rgba(59,130,246,0.3)";
    const TIP_TX = isDark ? "#f1f5f9" : "#0f172a";
    const TIP_MT = isDark ? "#64748b" : "#94a3b8";

    const PAD_L=12,PAD_R=72,PAD_T=18,PAD_B=42;
    const cW=W-PAD_L-PAD_R, cH=H-PAD_T-PAD_B;

    const closes = data.map(d=>Number(d.close));
    const maxC = Math.max(...closes), minC = Math.min(...closes);
    const pad4 = (maxC-minC)*0.06||maxC*0.02;
    const hi=maxC+pad4, lo=minC-pad4, range=hi-lo||1;

    const toX = i => PAD_L + (i/(data.length-1))*cW;
    const toY = v => PAD_T + cH - ((v-lo)/range)*cH;

    const isUp = closes[closes.length-1] >= closes[0];
    const LINE_COL = isUp ? "#22c55e" : "#ef4444";
    const AREA_TOP = isUp ? "rgba(34,197,94,0.28)" : "rgba(239,68,68,0.22)";
    const AREA_BOT = isUp ? "rgba(34,197,94,0)"    : "rgba(239,68,68,0)";

    ctx.fillStyle=BG; ctx.fillRect(0,0,W,H);

    /* grid */
    ctx.setLineDash([4,4]); ctx.lineWidth=0.8; ctx.strokeStyle=GRID;
    for(let i=0;i<=5;i++){
      const y=PAD_T+(cH/5)*i;
      ctx.beginPath(); ctx.moveTo(PAD_L,y); ctx.lineTo(W-PAD_R,y); ctx.stroke();
      const p=hi-(range/5)*i;
      ctx.fillStyle=AXIS; ctx.font="10px 'SF Mono',monospace"; ctx.textAlign="left";
      ctx.fillText(p>=1000?p.toFixed(1):p.toFixed(2), W-PAD_R+7, y+4);
    }
    ctx.setLineDash([]);

    /* area fill */
    const grad = ctx.createLinearGradient(0,PAD_T,0,H-PAD_B);
    grad.addColorStop(0, AREA_TOP); grad.addColorStop(1, AREA_BOT);
    ctx.fillStyle=grad;
    ctx.beginPath();
    ctx.moveTo(toX(0), toY(closes[0]));
    closes.forEach((_,i)=>{ if(i>0) ctx.lineTo(toX(i),toY(closes[i])); });
    ctx.lineTo(toX(data.length-1), H-PAD_B);
    ctx.lineTo(toX(0), H-PAD_B);
    ctx.closePath(); ctx.fill();

    /* line */
    ctx.strokeStyle=LINE_COL; ctx.lineWidth=2.2;
    ctx.beginPath();
    closes.forEach((v,i)=>{ i===0?ctx.moveTo(toX(i),toY(v)):ctx.lineTo(toX(i),toY(v)); });
    ctx.stroke();

    /* last price tag */
    const lastY=toY(closes[closes.length-1]);
    const tag=(closes[closes.length-1]>=1000?closes[closes.length-1].toFixed(1):closes[closes.length-1].toFixed(2));
    ctx.fillStyle=LINE_COL.replace("1)","0.85)").includes("#")?"rgba(34,197,94,0.85)":LINE_COL;
    ctx.fillStyle = isUp?"rgba(34,197,94,0.85)":"rgba(239,68,68,0.85)";
    const tw=tag.length*7+10;
    roundRect2(ctx,W-PAD_R+1,lastY-9,tw,18,4); ctx.fill();
    ctx.fillStyle="#fff"; ctx.font="bold 10px 'SF Mono',monospace"; ctx.textAlign="left";
    ctx.fillText(tag,W-PAD_R+7,lastY+4);

    /* x labels */
    ctx.fillStyle=AXIS; ctx.font="10px 'SF Mono',monospace"; ctx.textAlign="center";
    const step=Math.max(1,Math.floor(data.length/7));
    data.forEach((d,i)=>{ if(i%step===0) ctx.fillText(fmtDate(d.date),toX(i),H-PAD_B+16); });

    /* crosshair */
    const m=mouseRef.current;
    if(m&&m.x>=PAD_L&&m.x<=W-PAD_R&&m.y>=PAD_T&&m.y<=H-PAD_B){
      const idx=Math.max(0,Math.min(data.length-1,Math.round((m.x-PAD_L)/cW*(data.length-1))));
      const cx=toX(idx);
      ctx.strokeStyle=CROSS; ctx.lineWidth=1; ctx.setLineDash([4,4]);
      ctx.beginPath(); ctx.moveTo(cx,PAD_T); ctx.lineTo(cx,H-PAD_B); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(PAD_L,m.y); ctx.lineTo(W-PAD_R,m.y); ctx.stroke();
      ctx.setLineDash([]);

      const cd=data[idx];
      const lines=[{l:"Date",v:cd.date||""},{l:"Close",v:closes[idx]>=1000?closes[idx].toFixed(1):closes[idx].toFixed(2),bold:true},{l:"Volume",v:fmtVol(cd.volume)}];
      const TW=160,TH=lines.length*19+16,TR=9;
      let tx=cx+14; if(tx+TW>W-PAD_R-4) tx=cx-TW-14;
      let ty=Math.max(PAD_T+4,Math.min(m.y-20,H-PAD_B-TH-4));
      ctx.shadowColor="rgba(0,0,0,0.3)"; ctx.shadowBlur=14;
      ctx.fillStyle=TIP_BG; roundRect2(ctx,tx,ty,TW,TH,TR); ctx.fill();
      ctx.shadowBlur=0;
      ctx.strokeStyle=TIP_BD; ctx.lineWidth=1; roundRect2(ctx,tx,ty,TW,TH,TR); ctx.stroke();
      ctx.fillStyle=LINE_COL; roundRect2(ctx,tx,ty,3,TH,[TR,0,0,TR]); ctx.fill();
      lines.forEach((r,ri)=>{
        const ry=ty+13+ri*19;
        ctx.fillStyle=TIP_MT; ctx.font="10px 'SF Mono',monospace"; ctx.textAlign="left"; ctx.fillText(r.l,tx+11,ry);
        ctx.fillStyle=TIP_TX; ctx.font=(r.bold?"bold ":"")+"10px 'SF Mono',monospace"; ctx.textAlign="right"; ctx.fillText(r.v,tx+TW-9,ry);
      });
    }
    ctx.restore();
  },[data,isDark]);

  const schedule=useCallback(()=>{
    cancelAnimationFrame(rafRef.current);
    rafRef.current=requestAnimationFrame(draw);
  },[draw]);

  useEffect(()=>{schedule();},[data,isDark,schedule]);
  useEffect(()=>{
    const c=canvasRef.current; if(!c) return;
    const getPos=e=>{const r=c.getBoundingClientRect();return{x:e.clientX-r.left,y:e.clientY-r.top};};
    const onMove=e=>{mouseRef.current=getPos(e);schedule();};
    const onLeave=()=>{mouseRef.current=null;schedule();};
    c.style.cursor="crosshair";
    c.addEventListener("mousemove",onMove); c.addEventListener("mouseleave",onLeave);
    return()=>{c.removeEventListener("mousemove",onMove);c.removeEventListener("mouseleave",onLeave);};
  },[schedule]);
  useEffect(()=>{
    const ro=new ResizeObserver(schedule);
    if(containerRef.current) ro.observe(containerRef.current);
    return()=>ro.disconnect();
  },[schedule]);

  return(
    <div ref={containerRef} style={{width:"100%",height:420}}>
      <canvas ref={canvasRef} style={{display:"block"}}/>
      <div style={{position:"absolute",bottom:6,left:14,fontSize:10,color:isDark?"rgba(100,116,139,0.6)":"rgba(148,163,184,0.8)",pointerEvents:"none",userSelect:"none"}}>
        Hover for details
      </div>
    </div>
  );
};

function roundRect2(ctx,x,y,w,h,r){
  if(typeof r==="number")r=[r,r,r,r];
  const[tl,tr,br,bl]=r;
  ctx.beginPath();
  ctx.moveTo(x+tl,y); ctx.lineTo(x+w-tr,y); ctx.quadraticCurveTo(x+w,y,x+w,y+tr);
  ctx.lineTo(x+w,y+h-br); ctx.quadraticCurveTo(x+w,y+h,x+w-br,y+h);
  ctx.lineTo(x+bl,y+h); ctx.quadraticCurveTo(x,y+h,x,y+h-bl);
  ctx.lineTo(x,y+tl); ctx.quadraticCurveTo(x,y,x+tl,y); ctx.closePath();
}
function fmtDate(d){if(!d)return"";const dt=new Date(d);if(isNaN(dt))return d.slice(5)||d;return dt.toLocaleDateString("en-US",{month:"short",day:"numeric"});}
function fmtVol(v){if(!v)return"--";if(v>=1e9)return(v/1e9).toFixed(2)+"B";if(v>=1e6)return(v/1e6).toFixed(2)+"M";if(v>=1e3)return(v/1e3).toFixed(1)+"K";return String(v);}

export default PriceChartLine;