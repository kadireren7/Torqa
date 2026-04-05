import { useCallback, useEffect, useState } from "react";

const THEME_KEY = "torqa-website-theme";

export function useTheme() {
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const s = localStorage.getItem(THEME_KEY);
    if (s === "light" || s === "dark") {
      setTheme(s);
      document.documentElement.setAttribute("data-theme", s);
      return;
    }
    const prefers =
      typeof window !== "undefined" &&
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: light)").matches;
    const t = prefers ? "light" : "dark";
    setTheme(t);
    document.documentElement.setAttribute("data-theme", t);
  }, []);

  const toggle = useCallback(() => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem(THEME_KEY, next);
  }, [theme]);

  return { theme, toggle };
}
