import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import { tmdbEnabled } from "@/services/tmdb";

interface SettingsContextValue {
  useTmdb: boolean;
  setUseTmdb: (v: boolean) => Promise<void>;
  tmdbAvailable: boolean;
  isTvMode: boolean;
  setTvMode: (v: boolean) => Promise<void>;
  hiddenStreamAddons: string[];
  setHiddenStreamAddons: (v: string[]) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_USE_TMDB = "settings_use_tmdb";
const STORAGE_TV_MODE = "settings_tv_mode";
const STORAGE_HIDDEN_ADDONS = "settings_hidden_stream_addons_v1";

const DEFAULT_HIDDEN_STREAM_ADDONS: string[] = [
  "Local Files",
  "Stremio Status",
  "סטטוס תוספים",
  "מתי יגיע לרשת",
  "Real Debrid Israel",
];

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const available = tmdbEnabled();
  const [useTmdb, setUseTmdbState] = useState(available);
  const isNativeTV = Platform.isTV ?? false;
  const [manualTvMode, setManualTvModeState] = useState<boolean | null>(null);
  const [hiddenStreamAddons, setHiddenStreamAddonsState] =
    useState<string[]>(DEFAULT_HIDDEN_STREAM_ADDONS);
  // Track whether the user has issued any local writes for these settings
  // before async hydration completes. If so, skip applying the hydrated
  // values to avoid clobbering the just-saved state.
  const userWroteUseTmdbRef = useRef(false);
  const userWroteTvModeRef = useRef(false);
  const userWroteHiddenRef = useRef(false);

  const isTvMode = manualTvMode !== null ? manualTvMode : isNativeTV;

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_USE_TMDB),
      AsyncStorage.getItem(STORAGE_TV_MODE),
      AsyncStorage.getItem(STORAGE_HIDDEN_ADDONS),
    ]).then(([tmdb, tv, hidden]) => {
      if (!userWroteUseTmdbRef.current) {
        if (tmdb !== null) setUseTmdbState(tmdb === "true" && available);
        else setUseTmdbState(available);
      }
      if (!userWroteTvModeRef.current && tv !== null) setManualTvModeState(tv === "true");
      if (!userWroteHiddenRef.current && hidden !== null) {
        try {
          const parsed = JSON.parse(hidden);
          if (Array.isArray(parsed)) {
            setHiddenStreamAddonsState(
              parsed.filter((s) => typeof s === "string").map((s: string) => s.trim()).filter(Boolean)
            );
          }
        } catch {
          // ignore corrupt value, keep defaults
        }
      }
    });
  }, [available]);

  const setUseTmdb = useCallback(async (v: boolean) => {
    userWroteUseTmdbRef.current = true;
    setUseTmdbState(v && available);
    await AsyncStorage.setItem(STORAGE_USE_TMDB, String(v));
  }, [available]);

  const setTvMode = useCallback(async (v: boolean) => {
    userWroteTvModeRef.current = true;
    setManualTvModeState(v);
    await AsyncStorage.setItem(STORAGE_TV_MODE, String(v));
  }, []);

  const setHiddenStreamAddons = useCallback(async (v: string[]) => {
    userWroteHiddenRef.current = true;
    const cleaned = v.map((s) => s.trim()).filter(Boolean);
    setHiddenStreamAddonsState(cleaned);
    await AsyncStorage.setItem(STORAGE_HIDDEN_ADDONS, JSON.stringify(cleaned));
  }, []);

  return (
    <SettingsContext.Provider
      value={{
        useTmdb: useTmdb && available,
        setUseTmdb,
        tmdbAvailable: available,
        isTvMode,
        setTvMode,
        hiddenStreamAddons,
        setHiddenStreamAddons,
      }}
    >
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
