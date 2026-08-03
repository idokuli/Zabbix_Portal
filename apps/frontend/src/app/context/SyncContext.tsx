"use client";
import type { PropsWithChildren } from "react";
import { createContext, useContext, useEffect, useState } from "react";
import { getToken } from "../../lib/auth";

type SyncContextValue = { lastSync: number };

const SyncContext = createContext<SyncContextValue>({ lastSync: 0 });

export const useSync = () => useContext(SyncContext);

const readSyncStream = async (
  reader: ReadableStreamDefaultReader<Uint8Array>,
  isCancelled: () => boolean,
  onSync: () => void,
) => {
  const decoder = new TextDecoder();
  while (!isCancelled()) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }
    if (decoder.decode(value).includes("data: sync")) {
      onSync();
    }
  }
};

export const SyncProvider = ({ children }: PropsWithChildren) => {
  const [lastSync, setLastSync] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let reader: ReadableStreamDefaultReader<Uint8Array> | null = null;

    const connect = async () => {
      const token = getToken();
      if (!token) {
        return;
      }
      try {
        const res = await fetch("/api/events", {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!(res.ok && res.body)) {
          return;
        }
        reader = res.body.getReader();
        await readSyncStream(
          reader,
          () => cancelled,
          () => setLastSync(Date.now()),
        );
      } catch {
        if (!cancelled) {
          setTimeout(() => void connect(), 3000);
        }
      }
    };

    void connect();

    return () => {
      cancelled = true;
      void reader?.cancel();
    };
  }, []);

  return <SyncContext.Provider value={{ lastSync }}>{children}</SyncContext.Provider>;
};
