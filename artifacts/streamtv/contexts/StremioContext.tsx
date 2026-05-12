import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  AddonStreamProgress,
  CatalogRow,
  LoginResult,
  StremioAddon,
  StremioMeta,
  StremioStream,
  StremioSubtitle,
  addonSupportsResource,
  fetchCatalog,
  fetchCatalogFromAddons,
  fetchCatalogRows,
  fetchMeta,
  fetchMetaFromAddons,
  fetchStreams,
  fetchStreamsProgressive,
  fetchSubtitlesFromAddons,
  getUserAddons,
  stremioLogin,
} from "@/services/stremio";

const STORAGE_AUTH_KEY = "stremio_auth";

interface StremioContextValue {
  authKey: string | null;
  user: LoginResult["user"] | null;
  addons: StremioAddon[];
  isLoggedIn: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  getMovies: (search?: string, skip?: number) => Promise<StremioMeta[]>;
  getSeries: (search?: string, skip?: number) => Promise<StremioMeta[]>;
  getCatalogRows: () => Promise<CatalogRow[]>;
  getDetail: (type: string, id: string) => Promise<StremioMeta | null>;
  getStreams: (type: string, id: string) => Promise<StremioStream[]>;
  getStreamsProgressive: (
    type: string,
    id: string,
    onAddon: (p: AddonStreamProgress) => void,
    imdbId?: string
  ) => Promise<void>;
  getSubtitles: (type: string, id: string) => Promise<StremioSubtitle[]>;
  streamAddonsCount: number;
  subtitleAddonsCount: number;
}

const StremioContext = createContext<StremioContextValue | null>(null);

export function StremioProvider({ children }: { children: React.ReactNode }) {
  const [authKey, setAuthKey] = useState<string | null>(null);
  const [user, setUser] = useState<LoginResult["user"] | null>(null);
  const [addons, setAddons] = useState<StremioAddon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_AUTH_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as { authKey: string; user: LoginResult["user"] };
          setAuthKey(parsed.authKey);
          setUser(parsed.user);
          try {
            const userAddons = await getUserAddons(parsed.authKey);
            setAddons(userAddons);
          } catch {}
        }
      } finally {
        setIsLoading(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const result = await stremioLogin(email, password);
    setAuthKey(result.authKey);
    setUser(result.user);
    await AsyncStorage.setItem(STORAGE_AUTH_KEY, JSON.stringify(result));
    const userAddons = await getUserAddons(result.authKey).catch(() => []);
    setAddons(userAddons);
  }, []);

  const logout = useCallback(async () => {
    setAuthKey(null);
    setUser(null);
    setAddons([]);
    await AsyncStorage.removeItem(STORAGE_AUTH_KEY);
  }, []);

  const getMovies = useCallback(async (search?: string, skip?: number): Promise<StremioMeta[]> => {
    const catalogAddons = addons.filter((a) =>
      (a.manifest?.catalogs ?? []).some((c) => c.type === "movie")
    );
    if (catalogAddons.length > 0) {
      const results = await fetchCatalogFromAddons("movie", catalogAddons, { search, skip });
      if (results.length > 0) return results;
    }
    return fetchCatalog("movie", { search, skip });
  }, [addons]);

  const getSeries = useCallback(async (search?: string, skip?: number): Promise<StremioMeta[]> => {
    const catalogAddons = addons.filter((a) =>
      (a.manifest?.catalogs ?? []).some((c) => c.type === "series")
    );
    if (catalogAddons.length > 0) {
      const results = await fetchCatalogFromAddons("series", catalogAddons, { search, skip });
      if (results.length > 0) return results;
    }
    return fetchCatalog("series", { search, skip });
  }, [addons]);

  const getCatalogRows = useCallback(async (): Promise<CatalogRow[]> => {
    if (addons.length === 0) return [];
    return fetchCatalogRows(addons);
  }, [addons]);

  const getDetail = useCallback(async (type: string, id: string): Promise<StremioMeta | null> => {
    // For IMDB ids (tt…), strip any episode suffix (tt12345:1:2 → tt12345).
    // For non-IMDB ids (tmdb:12345, kitsu:anime:42), keep the full id — it IS the meta id.
    const isImdb = id.startsWith("tt");
    const lookupId = isImdb ? id.split(":")[0] : id;

    const cinemetaPromise = isImdb
      ? fetchMeta(type, lookupId).catch(() => null)
      : Promise.resolve(null);
    const addonPromise = addons.length > 0
      ? fetchMetaFromAddons(type, lookupId, addons).catch(() => null)
      : Promise.resolve(null);

    const [cinemeta, addonMeta] = await Promise.all([cinemetaPromise, addonPromise]);
    if (!cinemeta && !addonMeta) return null;

    const base = cinemeta ?? addonMeta!;
    if (!addonMeta) return base;

    return {
      ...base,
      ...addonMeta,
      videos: addonMeta.videos?.length ? addonMeta.videos : base.videos,
      poster: addonMeta.poster ?? base.poster,
      background: addonMeta.background ?? base.background,
      description: addonMeta.description ?? base.description,
    };
  }, [addons]);

  const getStreams = useCallback((type: string, id: string) =>
    fetchStreams(type, id, addons), [addons]);

  const getStreamsProgressive = useCallback(
    (type: string, id: string, onAddon: (p: AddonStreamProgress) => void, imdbId?: string) =>
      fetchStreamsProgressive(type, id, addons, onAddon, 30000, imdbId),
    [addons]
  );

  const getSubtitles = useCallback((type: string, id: string) =>
    fetchSubtitlesFromAddons(type, id, addons), [addons]);

  return (
    <StremioContext.Provider
      value={{
        authKey, user, addons, isLoggedIn: !!authKey, isLoading,
        login, logout, getMovies, getSeries, getCatalogRows, getDetail,
        getStreams, getStreamsProgressive, getSubtitles,
        subtitleAddonsCount: addons.filter((a) => addonSupportsResource(a, "subtitles")).length,
        streamAddonsCount: addons.filter((a) => addonSupportsResource(a, "stream")).length,
      }}
    >
      {children}
    </StremioContext.Provider>
  );
}

export function useStremio() {
  const ctx = useContext(StremioContext);
  if (!ctx) throw new Error("useStremio must be used within StremioProvider");
  return ctx;
}
