import React, { createContext, useEffect, useState } from "react";
import { ACCENTS } from "../lib/utils";

export const ThemeContext = createContext();

const save = (key, value) => {
  try {
    localStorage.setItem(key, value);
  } catch {
    // storage can be blocked, the choice still works for this visit
  }
};

// index.html already applied the saved choices before the first paint
const getInitialTheme = () => (document.documentElement.dataset.theme === "light" ? "light" : "dark");
const getInitialAccent = () => {
  const saved = document.documentElement.dataset.accent;
  return ACCENTS.some((accent) => accent.id === saved) ? saved : ACCENTS[0].id;
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);
  const [accent, setAccent] = useState(getInitialAccent);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "light" ? "#eceef8" : "#06060c");
    save("theme", theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.dataset.accent = accent;
    save("accent", accent);
  }, [accent]);

  const toggleTheme = () => setTheme((current) => (current === "dark" ? "light" : "dark"));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, accent, setAccent }}>
      {children}
    </ThemeContext.Provider>
  );
};
