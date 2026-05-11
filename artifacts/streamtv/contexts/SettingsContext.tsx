import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { Platform } from "react-native";
import { tmdbEnabled } from "@/services/tmdb";

interface SettingsContextValue {
  useTmdb: boolean;
  setUseTmdb: (v: boolean) => Promise<void>;
  tmdbAvailable: boolean;
  isTvMode: boolean;
  setTvMode: (v: boolean) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_USE_TMDB = "settings_use_tmdb";
const STORAGE_TV_MODE = "settings_tv_mode";

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const available = tmdbEnabled();
  const [useTmdb, setUseTmdbState] = useState(available);
  const isNativeTV = Platform.isTV ?? false;
  const [manualTvMode, setManualTvModeState] = useState<boolean | null>(null);

  const isTvMode = manualTvMode !== null ? manualTvMode : isNativeTV;

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_USE_TMDB),
      AsyncStorage.getItem(STORAGE_TV_MODE),
    ]).then(([tmdb, tv]) => {
      if (tmdb !== null) setUseTmdbState(tmdb === "true" && available);
      else setUseTmdbState(available);
      if (tv !== null) setManualTvModeState(tv === "true");
    });
  }, [available]);

  const setUseTmdb = useCallback(async (v: boolean) => {
    setUseTmdbState(v && available);
    await AsyncStorage.setItem(STORAGE_USE_TMDB, String(v));
  }, [available]);

  const setTvMode = useCallback(async (v: boolean) => {
    setManualTvModeState(v);
    await AsyncStorage.setItem(STORAGE_TV_MODE, String(v));
  }, []);

  return (
    <SettingsContext.Provider value={{ useTmdb: useTmdb && available, setUseTmdb, tmdbAvailable: available, isTvMode, setTvMode }}>
      {children}
    </SettingsContext.Provider>
  );
}

export function useSettings() {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}
