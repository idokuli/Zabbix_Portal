"use client";
import { createContext, useContext, useEffect, useState } from "react";
import type { PropsWithChildren } from "react";

const RefreshContext = createContext(0);

export const useRefreshTick = () => useContext(RefreshContext);

export const RefreshProvider = ({ children }: PropsWithChildren) => {
  const [tick, setTick] = useState(0);
  const [intervalSec, setIntervalSec] = useState(0);

  useEffect(() => {
    fetch("/api/config")
      .then((r) => r.json())
      .then((cfg) => setIntervalSec(Number(cfg.refreshInterval ?? 0)))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (intervalSec <= 0) return;
    const id = setInterval(() => setTick((t) => t + 1), intervalSec * 1000);
    return () => clearInterval(id);
  }, [intervalSec]);

  return <RefreshContext.Provider value={tick}>{children}</RefreshContext.Provider>;
};
