import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { Dimensions, Platform } from "react-native";
import { tmdbEnabled } from "@/services/tmdb";

/**
 * Best-effort TV detection. `Platform.isTV` is unreliable on sideloaded
 * APKs (many Android TV / Google TV boxes report false). As a fallback we
 * treat any large Android display (>= 960dp on shortest side) as a TV.
 */
function detectTv(): boolean {
  if (Platform.isTV) return true;
  if (Platform.OS === "android") {
    const { width, height } = Dimensions.get("screen");
    const longest = Math.max(width, height);
    if (longest >= 960) return true;
  }
  return false;
}

interface SettingsContextValue {
  useTmdb: boolean;
  setUseTmdb: (v: boolean) => Promise<void>;
  tmdbAvailable: boolean;
  isTvMode: boolean;
  setTvMode: (v: boolean) => Promise<void>;
  hiddenStreamAddons: string[];
  setHiddenStreamAddons: (v: string[]) => Promise<void>;
  preferredSubtitleLanguage: string | null;
  setPreferredSubtitleLanguage: (v: string | null) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

const STORAGE_USE_TMDB = "settings_use_tmdb";
const STORAGE_TV_MODE = "settings_tv_mode";
const STORAGE_HIDDEN_ADDONS = "settings_hidden_stream_addons_v1";
const STORAGE_PREF_SUB_LANG = "settings_pref_subtitle_lang_v1";

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
  const isNativeTV = detectTv();
  const [manualTvMode, setManualTvModeState] = useState<boolean | null>(null);
  const [hiddenStreamAddons, setHiddenStreamAddonsState] =
    useState<string[]>(DEFAULT_HIDDEN_STREAM_ADDONS);
  const [preferredSubtitleLanguage, setPreferredSubtitleLanguageState] =
    useState<string | null>(null);
  // Track whether the user has issued any local writes for these settings
  // before async hydration completes. If so, skip applying the hydrated
  // values to avoid clobbering the just-saved state.
  const userWroteUseTmdbRef = useRef(false);
  const userWroteTvModeRef = useRef(false);
  const userWroteHiddenRef = useRef(false);
  const userWrotePrefLangRef = useRef(false);

  const isTvMode = manualTvMode !== null ? manualTvMode : isNativeTV;

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_USE_TMDB),
      AsyncStorage.getItem(STORAGE_TV_MODE),
      AsyncStorage.getItem(STORAGE_HIDDEN_ADDONS),
      AsyncStorage.getItem(STORAGE_PREF_SUB_LANG),
    ]).then(([tmdb, tv, hidden, prefLang]) => {
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
      if (!userWrotePrefLangRef.current && prefLang !== null) {
        setPreferredSubtitleLanguageState(prefLang.length > 0 ? prefLang : null);
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

  const setPreferredSubtitleLanguage = useCallback(async (v: string | null) => {
    userWrotePrefLangRef.current = true;
    setPreferredSubtitleLanguageState(v);
    await AsyncStorage.setItem(STORAGE_PREF_SUB_LANG, v ?? "");
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
        preferredSubtitleLanguage,
        setPreferredSubtitleLanguage,
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
