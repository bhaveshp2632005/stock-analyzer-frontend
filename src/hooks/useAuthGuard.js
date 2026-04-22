/* ══════════════════════════════════════════════════════════════
   useAuthGuard.js — Auto Logout Hook
   
   Har protected page pe use karo.
   Kaam karta hai:
   1. Mount pe token validate karta hai
   2. Token ki exact expiry time calculate karta hai
   3. Expiry pe automatically logout + /login redirect karta hai
   4. Browser tab focus pe bhi re-check karta hai
   
   Usage:
     import useAuthGuard from "../hooks/useAuthGuard";
     const useAuthGuard = () => { ... }  ← page ke top pe
══════════════════════════════════════════════════════════════ */

import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getToken, logout, validateToken } from "../utils/auth.js";

const useAuthGuard = () => {
  const navigate = useNavigate();

  useEffect(() => {
    /* ── Step 1: Immediate check on mount ── */
    if (!validateToken()) {
      logout(false);
      navigate("/login", { replace: true });
      return;
    }

    /* ── Step 2: Calculate exact ms until token expires ── */
    const scheduleAutoLogout = () => {
      try {
        const token   = getToken();
        if (!token) return;

        const parts   = token.split(".");
        const base64  = parts[1].replace(/-/g, "+").replace(/_/g, "/");
        const padded  = base64.padEnd(base64.length + (4 - (base64.length % 4)) % 4, "=");
        const payload = JSON.parse(atob(padded));

        if (!payload.exp) return;

        const nowMs    = Date.now();
        const expMs    = payload.exp * 1000;
        const msLeft   = expMs - nowMs;

        if (msLeft <= 0) {
          // Already expired
          logout(false);
          navigate("/login", { replace: true });
          return;
        }

        console.log(`🔐 Token expires in ${Math.round(msLeft / 1000 / 60)} minutes`);

        /* ── Step 3: Set timer to auto logout at exact expiry ── */
        const timerId = setTimeout(() => {
          console.warn("🔐 Token expired — auto logging out");
          logout(false);
          navigate("/login", { replace: true });
        }, msLeft);

        return timerId;
      } catch {
        logout(false);
        navigate("/login", { replace: true });
      }
    };

    const timerId = scheduleAutoLogout();

    /* ── Step 4: Re-check when user switches back to tab ── */
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (!validateToken()) {
          logout(false);
          navigate("/login", { replace: true });
        }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);

    /* ── Step 5: Re-check on window focus ── */
    const handleFocus = () => {
      if (!validateToken()) {
        logout(false);
        navigate("/login", { replace: true });
      }
    };
    window.addEventListener("focus", handleFocus);

    /* ── Cleanup ── */
    return () => {
      if (timerId) clearTimeout(timerId);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, [navigate]);
};

export default useAuthGuard;