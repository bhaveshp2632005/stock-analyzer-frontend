import React, { useState, useEffect } from "react";
import { BarChart3, Mail, Lock, User, Brain, Activity, Zap, Sun, Moon } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { validateToken } from "../utils/auth.js";
import { useTheme } from "../context/ThemeContext.jsx";
import { tokens }   from "../context/theme.js";
import { GlobalStyles, FloatingOrbs } from "./AppShell.jsx";

const Signup = () => {
  const navigate = useNavigate();
  const { isDark, toggle } = useTheme();
  const t = tokens(isDark);

  useEffect(() => { if(validateToken()) navigate("/dashboard",{replace:true}); }, [navigate]);

  const [form,    setForm]    = useState({name:"",email:"",password:""});
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault(); setError("");
    try {
      setLoading(true);
      const res = await axios.post("http://localhost:5000/api/auth/signup", form);
      localStorage.setItem("token", res.data.token);
      localStorage.setItem("user",  JSON.stringify(res.data.user));
      navigate("/dashboard",{replace:true});
    } catch(err) { setError(err.response?.data?.message||"Login failed. Try again."); }
    finally { setLoading(false); }
  };

  return (
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",padding:"0 16px",
      background:t.pageBg,
      backgroundImage:`linear-gradient(${t.gridColor} 1px,transparent 1px),linear-gradient(90deg,${t.gridColor} 1px,transparent 1px)`,
      backgroundSize:"44px 44px",
      transition:"background 0.35s",
      color:t.textPrimary,
    }}>
      <GlobalStyles/>
      <FloatingOrbs/>

      {/* Theme toggle top-right */}
      <button onClick={toggle} style={{position:"fixed",top:18,right:18,padding:"8px 14px",borderRadius:12,display:"flex",alignItems:"center",gap:7,fontSize:12,fontWeight:600,cursor:"pointer",zIndex:50,background:isDark?"rgba(99,102,241,0.18)":"rgba(251,191,36,0.18)",border:isDark?"1px solid rgba(99,102,241,0.3)":"1px solid rgba(251,191,36,0.35)",color:isDark?"#a5b4fc":"#d97706",transition:"all 0.25s"}}>
        {isDark?<Sun size={13}/>:<Moon size={13}/>} {isDark?"Light":"Dark"} Mode
      </button>

      <div style={{position:"relative",width:"100%",maxWidth:400,zIndex:10}}>
        {/* Logo */}
        <div style={{textAlign:"center",marginBottom:24}}>
          <div style={{display:"inline-flex",padding:14,borderRadius:18,background:"linear-gradient(135deg,rgba(59,130,246,0.28),rgba(99,102,241,0.22))",border:"1px solid rgba(59,130,246,0.38)",boxShadow:"0 0 20px rgba(59,130,246,0.22)",marginBottom:12}}>
            <BarChart3 size={26} style={{color:"#60a5fa"}}/>
          </div>
          <h1 style={{margin:0,fontSize:22,fontWeight:800,background:"linear-gradient(90deg,#60a5fa,#a78bfa)",WebkitBackgroundClip:"text",WebkitTextFillColor:"transparent"}}>StockAnalyzer</h1>
          <p style={{margin:"4px 0 0",fontSize:12,color:t.textMuted}}>AI-Powered Stock Market Intelligence</p>
        </div>

        {/* Form card */}
        <div style={{
          background:isDark?"linear-gradient(135deg,rgba(255,255,255,0.06) 0%,rgba(255,255,255,0.02) 100%)":"linear-gradient(135deg,rgba(255,255,255,0.92) 0%,rgba(255,255,255,0.75) 100%)",
          border:`1px solid ${t.border}`, borderRadius:22,
          backdropFilter:"blur(24px)", WebkitBackdropFilter:"blur(24px)",
          padding:28, boxShadow:t.shadow,
          transition:"background 0.35s, border-color 0.35s",
        }}>
          <h2 style={{margin:"0 0 4px",fontSize:19,fontWeight:800,textAlign:"center",color:t.textPrimary}}>Create Account</h2>
          <p style={{margin:"0 0 22px",fontSize:12,color:t.textMuted,textAlign:"center"}}>Sign in to continue to your dashboard</p>

          {error&&<div style={{padding:"9px 14px",borderRadius:10,background:"rgba(248,113,113,0.12)",border:"1px solid rgba(248,113,113,0.22)",color:"#fca5a5",fontSize:12,marginBottom:16,textAlign:"center"}}>{error}</div>}

          <form onSubmit={handleSubmit}>
            {[{type:"text",name:"name",label:"Full Name",icon:<Mail size={13}/>,ph:"Your name"},
              {type:"email",name:"email",label:"Email",icon:<Mail size={13}/>,ph:"you@example.com"},
              {type:"password",name:"password",label:"Password",icon:<Lock size={13}/>,ph:"Min 6 characters"}
            ].map(f=>(
              <div key={f.name} style={{marginBottom:14}}>
                <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,fontWeight:600,color:t.textSecondary,marginBottom:6}}>
                  {f.icon} {f.label}
                </label>
                <input type={f.type} name={f.name} value={form[f.name]} required placeholder={f.ph}
                  onChange={e=>setForm({...form,[e.target.name]:e.target.value})}
                  style={{width:"100%",background:t.inputBg,border:`1px solid ${t.inputBorder}`,borderRadius:11,padding:"10px 14px",fontSize:13,color:t.textPrimary,outline:"none",transition:"all 0.2s",boxSizing:"border-box"}}
                  onFocus={e=>{e.target.style.borderColor=t.inputFocus;e.target.style.background=isDark?"rgba(59,130,246,0.06)":"rgba(59,130,246,0.04)";}}
                  onBlur={e=>{e.target.style.borderColor=t.inputBorder;e.target.style.background=t.inputBg;}}
                />
              </div>
            ))}
            <button type="submit" disabled={loading} style={{width:"100%",marginTop:8,padding:"12px",borderRadius:12,fontSize:14,fontWeight:700,background:"linear-gradient(135deg,#10b981,#059669)",border:"none",color:"#fff",cursor:"pointer",opacity:loading?0.65:1,boxShadow:"0 4px 18px rgba(16,185,129,0.35)",transition:"all 0.2s"}}>
              {loading?"Creating Account...":"Create Account"}
            </button>
          </form>

          <p style={{textAlign:"center",fontSize:12,color:t.textMuted,marginTop:16}}>
            Already have an account?{" "}
            <Link to="/login" style={{color:"#34d399",fontWeight:600}}>Sign In</Link>
          </p>
        </div>

        {/* Feature pills */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:10,marginTop:16}}>
          {[{icon:<Brain size={14}/>,l:"AI Analysis"},{icon:<Activity size={14}/>,l:"Live Data"},{icon:<Zap size={14}/>,l:"Risk Alerts"}].map(f=>(
            <div key={f.l} style={{background:isDark?"rgba(255,255,255,0.04)":"rgba(255,255,255,0.7)",border:`1px solid ${t.border}`,borderRadius:12,padding:"10px 8px",textAlign:"center",fontSize:11,color:t.textSecondary,backdropFilter:"blur(12px)",transition:"all 0.35s"}}>
              <div style={{display:"flex",justifyContent:"center",color:"#60a5fa",marginBottom:5}}>{f.icon}</div>
              {f.l}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Signup;