"use client";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";

type Mode = "dark" | "light";
type Direction = "ltr" | "rtl";

const ThemeContext = createContext<{
  mode: Mode;
  toggle: () => void;
  direction: Direction;
  toggleDirection: () => void;
  setDirection: (d: Direction) => void;
}>({
  mode: "dark",
  toggle: () => {},
  direction: "ltr",
  toggleDirection: () => {},
  setDirection: () => {},
});

export const ThemeModeProvider = ({ children }: PropsWithChildren) => {
  const [mode, setMode] = useState<Mode>("dark");
  const [direction, setDirectionState] = useState<Direction>("ltr");

  useEffect(() => {
    const savedMode = localStorage.getItem("theme-mode") as Mode | null;
    if (savedMode === "light" || savedMode === "dark") {
      setMode(savedMode);
    }

    const savedDir = localStorage.getItem("theme-direction") as Direction | null;
    if (savedDir === "ltr" || savedDir === "rtl") {
      setDirectionState(savedDir);
    }
  }, []);

  useEffect(() => {
    document.documentElement.dir = direction;
  }, [direction]);

  const toggle = () => {
    setMode((m) => {
      const next = m === "dark" ? "light" : "dark";
      localStorage.setItem("theme-mode", next);
      return next;
    });
  };

  const toggleDirection = () => {
    setDirectionState((d) => {
      const next = d === "ltr" ? "rtl" : "ltr";
      localStorage.setItem("theme-direction", next);
      return next;
    });
  };

  const setDirection = (d: Direction) => {
    localStorage.setItem("theme-direction", d);
    setDirectionState(d);
  };

  return (
    <ThemeContext.Provider value={{ mode, toggle, direction, toggleDirection, setDirection }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeMode = () => useContext(ThemeContext);
