import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";

export interface ProgressEntry {
  key: string;
  type: string;
  id: string;
  name: string;
  poster?: string;
  background?: string;
  position: number;
  duration: number;
  updatedAt: number;
  episodeLabel?: string;
  // Last stream the user pressed for this title — used by the
  // Continue Watching row to resume playback directly.
  lastStreamUrl?: string;
  lastStreamTitle?: string;
  lastStreamSubtitleId?: string;
}

interface ProgressContextValue {
  entries: ProgressEntry[];
  recordProgress: (entry: Omit<ProgressEntry, "updatedAt">) => void;
  clearProgress: (key: string) => Promise<void>;
}

const ProgressContext = createContext<ProgressContextValue | null>(null);

const STORAGE_KEY = "watch_progress_v1";

export function ProgressProvider({ children }: { children: React.ReactNode }) {
  const [entries, setEntries] = useState<ProgressEntry[]>([]);
  const hydratedRef = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      hydratedRef.current = true;
      if (!raw) return;
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          setEntries(
            parsed.filter(
              (e): e is ProgressEntry =>
                e &&
                typeof e === "object" &&
                typeof e.key === "string" &&
                typeof e.position === "number" &&
                typeof e.duration === "number"
            )
          );
        }
      } catch {
        // ignore corrupt store
      }
    });
  }, []);

  const persist = useCallback((next: ProgressEntry[]) => {
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 50))).catch(() => {});
  }, []);

  const recordProgress = useCallback(
    (entry: Omit<ProgressEntry, "updatedAt">) => {
      if (!entry.key || !entry.duration || entry.duration < 30) return;
      setEntries((prev) => {
        const filtered = prev.filter((e) => e.key !== entry.key);
        const merged: ProgressEntry = { ...entry, updatedAt: Date.now() };
        const next = [merged, ...filtered].slice(0, 50);
        persist(next);
        return next;
      });
    },
    [persist]
  );

  const clearProgress = useCallback(
    async (key: string) => {
      let next: ProgressEntry[] = [];
      setEntries((prev) => {
        next = prev.filter((e) => e.key !== key);
        return next;
      });
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    },
    []
  );

  return (
    <ProgressContext.Provider value={{ entries, recordProgress, clearProgress }}>
      {children}
    </ProgressContext.Provider>
  );
}

export function useProgress() {
  const ctx = useContext(ProgressContext);
  if (!ctx) throw new Error("useProgress must be used within ProgressProvider");
  return ctx;
}
