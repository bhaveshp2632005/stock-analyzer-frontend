import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext();

const VALID_THEMES = ["midnight", "arctic", "aurora"];

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem("sa_theme");
    return VALID_THEMES.includes(saved) ? saved : "midnight";
  });

  useEffect(() => {
    localStorage.setItem("sa_theme", theme);
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // Legacy isDark support — Midnight + Aurora = dark, Arctic = light
  const isDark = theme !== "arctic";

  const setThemeByName = (name) => {
    if (VALID_THEMES.includes(name)) setTheme(name);
  };

  // Legacy toggle: dark ↔ light (midnight ↔ arctic)
  const toggle = () => setTheme(t =>
    t === "arctic" ? "midnight" : "arctic"
  );

  return (
    <ThemeContext.Provider value={{ theme, setTheme: setThemeByName, isDark, toggle }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);