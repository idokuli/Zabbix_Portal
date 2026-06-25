"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { PropsWithChildren } from "react";

type Mode = "dark" | "light";
type Direction = "ltr" | "rtl";

const ThemeContext = createContext<{
  mode: Mode;
  toggle: () => void;
  direction: Direction;
  toggleDirection: () => void;
}>({
  mode: "dark",
  toggle: () => {},
  direction: "ltr",
  toggleDirection: () => {},
});

export const ThemeModeProvider = ({ children }: PropsWithChildren) => {
  const [mode, setMode] = useState<Mode>("dark");
  const [direction, setDirection] = useState<Direction>("ltr");

  useEffect(() => {
    const savedMode = localStorage.getItem("theme-mode") as Mode | null;
    if (savedMode === "light" || savedMode === "dark") setMode(savedMode);

    const savedDir = localStorage.getItem("theme-direction") as Direction | null;
    if (savedDir === "ltr" || savedDir === "rtl") setDirection(savedDir);
  }, []);

  const toggle = () => {
    setMode((m) => {
      const next = m === "dark" ? "light" : "dark";
      localStorage.setItem("theme-mode", next);
      return next;
    });
  };

  const toggleDirection = () => {
    setDirection((d) => {
      const next = d === "ltr" ? "rtl" : "ltr";
      localStorage.setItem("theme-direction", next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ mode, toggle, direction, toggleDirection }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeMode = () => useContext(ThemeContext);
