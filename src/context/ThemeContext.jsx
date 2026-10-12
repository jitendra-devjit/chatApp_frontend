import React, { createContext, useEffect, useState } from "react";

export const ThemeContext = createContext();

const getInitialTheme = () => {
  const saved = document.documentElement.dataset.theme;
  return saved === "light" ? "light" : "dark";
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#f3f2ee" : "#0c0c0d");
    try {
      localStorage.setItem("theme", theme);
    } catch {
      // storage can be blocked, the theme still works for this visit
    }
  }, [theme]);

  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>;
};
