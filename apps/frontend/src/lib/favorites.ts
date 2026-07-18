"use client";
import { useCallback, useEffect, useState } from "react";

const read = (key: string): Set<string> => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
};

const write = (key: string, set: Set<string>) => {
  try {
    localStorage.setItem(key, JSON.stringify([...set]));
  } catch {
    /* ignore */
  }
};

export const useFavorites = (storageKey: string) => {
  const [favs, setFavs] = useState<Set<string>>(() => read(storageKey));

  useEffect(() => {
    setFavs(read(storageKey));
  }, [storageKey]);

  const toggle = useCallback(
    (id: string) => {
      setFavs((prev) => {
        const next = new Set(prev);
        if (next.has(id)) {
          next.delete(id);
        } else {
          next.add(id);
        }
        write(storageKey, next);
        return next;
      });
    },
    [storageKey],
  );

  const isFav = useCallback((id: string) => favs.has(id), [favs]);

  return { favs, toggle, isFav };
};
