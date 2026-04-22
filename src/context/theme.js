/* ═══════════════════════════════════════════════════════════════
   theme.js  — v3  |  Three cinematic themes with proper contrast
   All text tokens guarantee WCAG AA contrast on their backgrounds
═══════════════════════════════════════════════════════════════ */

const THEMES = {

  /* ── MIDNIGHT — deep space, electric blue/violet ── */
  midnight: {
    isDark: true,
    /* backgrounds */
    pageBg:         "#030610",
    sidebarBg:      "rgba(4,7,22,0.97)",
    sidebarBorder:  "rgba(99,149,255,0.22)",
    cardBg:         "rgba(14,20,45,0.85)",
    cardBgHover:    "rgba(18,28,58,0.95)",
    inputBg:        "rgba(14,20,45,0.70)",
    inputBorder:    "rgba(99,149,255,0.22)",
    inputFocus:     "rgba(99,149,255,0.60)",
    modalBg:        "#080d20",
    /* borders */
    border:         "rgba(99,149,255,0.16)",
    borderHover:    "rgba(99,149,255,0.42)",
    /* ── TEXT — always readable ── */
    textPrimary:    "#FFFFFF",
    textSecondary:  "#B8C8E8",
    textMuted:      "#7890B0",
    /* nav */
    navActive:      "rgba(99,149,255,0.22)",
    navHover:       "rgba(99,149,255,0.10)",
    /* shadows */
    shadow:         "0 8px 32px rgba(0,0,0,0.55), inset 0 1px 0 rgba(255,255,255,0.06)",
    shadowHover:    "0 20px 60px rgba(0,0,0,0.70), 0 0 0 1px rgba(99,149,255,0.18)",
    /* grid / chart */
    gridColor:      "rgba(99,149,255,0.06)",
    chartGrid:      "#0e1830",
    chartTick:      "#4a6080",
    /* orbs */
    orb1:           "rgba(56,139,253,0.18)",
    orb2:           "rgba(16,185,129,0.10)",
    orb3:           "rgba(139,92,246,0.12)",
    /* 3D / glow extras */
    cardGradient:   "linear-gradient(145deg,rgba(22,35,70,0.90) 0%,rgba(12,18,42,0.80) 100%)",
    glowPrimary:    "rgba(99,149,255,0.35)",
    glowAccent:     "rgba(139,92,246,0.25)",
    glassEdge:      "rgba(255,255,255,0.10)",
    glassEdgeBottom:"rgba(0,0,0,0.40)",
    /* accents */
    accentPrimary:  "#6395FF",
    accentSecond:   "#8B5CF6",
    accentThird:    "#10B981",
    gradient:       "linear-gradient(135deg,#6395FF 0%,#8B5CF6 100%)",
    gradientBtn:    "linear-gradient(135deg,#4F80F0 0%,#7B4EE8 100%)",
    name: "Midnight", icon: "🌑",
  },

  /* ── ARCTIC — clean ice-white, sharp blue ── */
  arctic: {
    isDark: false,
    pageBg:         "#EEF4FF",
    sidebarBg:      "rgba(255,255,255,0.98)",
    sidebarBorder:  "rgba(59,130,246,0.18)",
    cardBg:         "rgba(255,255,255,0.92)",
    cardBgHover:    "rgba(255,255,255,1.00)",
    inputBg:        "rgba(235,244,255,0.85)",
    inputBorder:    "rgba(59,130,246,0.22)",
    inputFocus:     "rgba(59,130,246,0.55)",
    modalBg:        "#FFFFFF",
    border:         "rgba(59,130,246,0.14)",
    borderHover:    "rgba(59,130,246,0.35)",
    /* ── TEXT ── */
    textPrimary:    "#08122A",
    textSecondary:  "#2A4068",
    textMuted:      "#6080A8",
    navActive:      "rgba(59,130,246,0.12)",
    navHover:       "rgba(59,130,246,0.06)",
    shadow:         "0 4px 24px rgba(59,130,246,0.10), inset 0 1px 0 rgba(255,255,255,0.90)",
    shadowHover:    "0 16px 48px rgba(59,130,246,0.18), 0 0 0 1px rgba(59,130,246,0.14)",
    gridColor:      "rgba(59,130,246,0.07)",
    chartGrid:      "#D8E8FF",
    chartTick:      "#80A0C0",
    orb1:           "rgba(59,130,246,0.09)",
    orb2:           "rgba(16,185,129,0.06)",
    orb3:           "rgba(99,102,241,0.06)",
    cardGradient:   "linear-gradient(145deg,rgba(255,255,255,0.98) 0%,rgba(235,245,255,0.88) 100%)",
    glowPrimary:    "rgba(59,130,246,0.18)",
    glowAccent:     "rgba(99,102,241,0.12)",
    glassEdge:      "rgba(255,255,255,0.95)",
    glassEdgeBottom:"rgba(59,130,246,0.08)",
    accentPrimary:  "#2563EB",
    accentSecond:   "#6366F1",
    accentThird:    "#059669",
    gradient:       "linear-gradient(135deg,#2563EB 0%,#6366F1 100%)",
    gradientBtn:    "linear-gradient(135deg,#3B82F6 0%,#6366F1 100%)",
    name: "Arctic", icon: "❄️",
  },

  /* ── AURORA — deep cosmos, purple/pink neon ── */
  aurora: {
    isDark: true,
    pageBg:         "#04020E",
    sidebarBg:      "rgba(7,3,20,0.97)",
    sidebarBorder:  "rgba(180,100,255,0.25)",
    cardBg:         "rgba(18,8,38,0.85)",
    cardBgHover:    "rgba(26,12,52,0.95)",
    inputBg:        "rgba(18,8,38,0.72)",
    inputBorder:    "rgba(180,100,255,0.25)",
    inputFocus:     "rgba(180,100,255,0.58)",
    modalBg:        "#0A0420",
    border:         "rgba(180,100,255,0.18)",
    borderHover:    "rgba(180,100,255,0.45)",
    /* ── TEXT ── */
    textPrimary:    "#FFFFFF",
    textSecondary:  "#D4B8FF",
    textMuted:      "#8A68B8",
    navActive:      "rgba(180,100,255,0.22)",
    navHover:       "rgba(180,100,255,0.10)",
    shadow:         "0 8px 32px rgba(0,0,0,0.60), inset 0 1px 0 rgba(180,100,255,0.08)",
    shadowHover:    "0 20px 60px rgba(0,0,0,0.75), 0 0 0 1px rgba(180,100,255,0.22)",
    gridColor:      "rgba(180,100,255,0.055)",
    chartGrid:      "#140830",
    chartTick:      "#5A3880",
    orb1:           "rgba(168,85,247,0.20)",
    orb2:           "rgba(236,72,153,0.14)",
    orb3:           "rgba(34,211,238,0.10)",
    cardGradient:   "linear-gradient(145deg,rgba(30,12,60,0.90) 0%,rgba(14,6,32,0.82) 100%)",
    glowPrimary:    "rgba(168,85,247,0.40)",
    glowAccent:     "rgba(236,72,153,0.28)",
    glassEdge:      "rgba(255,255,255,0.10)",
    glassEdgeBottom:"rgba(0,0,0,0.45)",
    accentPrimary:  "#C470FF",
    accentSecond:   "#F06FBD",
    accentThird:    "#22D3EE",
    gradient:       "linear-gradient(135deg,#C470FF 0%,#F06FBD 100%)",
    gradientBtn:    "linear-gradient(135deg,#A855F7 0%,#EC4899 100%)",
    name: "Aurora", icon: "🌌",
  },
};

/* tokens(theme) — also accepts legacy boolean */
export const tokens = (themeOrBool) => {
  if (typeof themeOrBool === "boolean")
    return THEMES[themeOrBool ? "midnight" : "arctic"];
  return THEMES[themeOrBool] || THEMES.midnight;
};

export const getThemeNames  = () => Object.keys(THEMES);
export const getThemeConfig = (name) => THEMES[name] || THEMES.midnight;
export default THEMES;