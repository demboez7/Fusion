import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import {
  LoginResult,
  StremioAddon,
  StremioMeta,
  StremioStream,
  fetchCatalog,
  fetchMeta,
  fetchMetaFromAddons,
  fetchStreams,
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
  getDetail: (type: string, id: string) => Promise<StremioMeta | null>;
  getStreams: (type: string, id: string) => Promise<StremioStream[]>;
}

const StremioContext = createContext<StremioContextValue | null>(null);

export function StremioProvider({ children }: { children: React.ReactNode }) {
  const [authKey, setAuthKey] = useState<string | null>(null);
  const [user, setUser] = useState<LoginResult["user"] | null>(null);
  const [addons, setAddons] = useState<StremioAddon[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_AUTH_KEY).then((raw) => {
      if (raw) {
        const parsed = JSON.parse(raw) as { authKey: string; user: LoginResult["user"] };
        setAuthKey(parsed.authKey);
        setUser(parsed.user);
        getUserAddons(parsed.authKey)
          .then(setAddons)
          .catch(() => {});
      }
    }).finally(() => setIsLoading(false));
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

  const getMovies = useCallback((search?: string, skip?: number) =>
    fetchCatalog("movie", { search, skip }), []);

  const getSeries = useCallback((search?: string, skip?: number) =>
    fetchCatalog("series", { search, skip }), []);

  const getDetail = useCallback(async (type: string, id: string): Promise<StremioMeta | null> => {
    const imdbId = id.split(":")[0];
    const [cinemeta, addonMeta] = await Promise.all([
      fetchMeta(type, imdbId).catch(() => null),
      addons.length > 0 ? fetchMetaFromAddons(type, imdbId, addons).catch(() => null) : Promise.resolve(null),
    ]);

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

  return (
    <StremioContext.Provider
      value={{ authKey, user, addons, isLoggedIn: !!authKey, isLoading, login, logout, getMovies, getSeries, getDetail, getStreams }}
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
