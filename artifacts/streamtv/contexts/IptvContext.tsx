import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { IptvChannel, fetchM3U, groupChannels } from "@/services/m3u-parser";
import { EpgProgram, fetchEpg, extractEpgUrlFromM3u } from "@/services/epg";

const STORAGE_URL_KEY = "iptv_playlist_url";
const STORAGE_CHANNELS_KEY = "iptv_channels_cache";
const STORAGE_EPG_URL_KEY = "iptv_epg_url";

interface IptvContextValue {
  playlistUrl: string;
  setPlaylistUrl: (url: string) => Promise<void>;
  channels: IptvChannel[];
  groups: Record<string, IptvChannel[]>;
  groupNames: string[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  epgUrl: string;
  setEpgUrl: (url: string) => Promise<void>;
  epgData: Map<string, EpgProgram[]>;
  epgLoading: boolean;
  epgError: string | null;
  refreshEpg: () => Promise<void>;
  getCurrentProgram: (tvgId: string) => EpgProgram | null;
}

const IptvContext = createContext<IptvContextValue | null>(null);

export function IptvProvider({ children }: { children: React.ReactNode }) {
  const [playlistUrl, setPlaylistUrlState] = useState("");
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [groups, setGroups] = useState<Record<string, IptvChannel[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [epgUrl, setEpgUrlState] = useState("");
  const [epgData, setEpgData] = useState<Map<string, EpgProgram[]>>(new Map());
  const [epgLoading, setEpgLoading] = useState(false);
  const [epgError, setEpgError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_URL_KEY),
      AsyncStorage.getItem(STORAGE_CHANNELS_KEY),
      AsyncStorage.getItem(STORAGE_EPG_URL_KEY),
    ]).then(([url, cached, epg]) => {
      if (url) setPlaylistUrlState(url);
      if (cached) {
        try {
          const chs = JSON.parse(cached) as IptvChannel[];
          setChannels(chs);
          setGroups(groupChannels(chs));
        } catch {}
      }
      if (epg) setEpgUrlState(epg);
    });
  }, []);

  const loadChannels = useCallback(async (url: string, rawContent?: string) => {
    if (!url) return;
    setIsLoading(true);
    setError(null);
    try {
      const chs = await fetchM3U(url);
      setChannels(chs);
      setGroups(groupChannels(chs));
      await AsyncStorage.setItem(STORAGE_CHANNELS_KEY, JSON.stringify(chs));

      if (rawContent) {
        const autoEpg = extractEpgUrlFromM3u(rawContent);
        if (autoEpg && !epgUrl) {
          setEpgUrlState(autoEpg);
          await AsyncStorage.setItem(STORAGE_EPG_URL_KEY, autoEpg);
        }
      }
    } catch (e) {
      setChannels([]);
      setGroups({});
      await AsyncStorage.removeItem(STORAGE_CHANNELS_KEY);
      setError(e instanceof Error ? e.message : "Failed to load playlist");
      throw e;
    } finally {
      setIsLoading(false);
    }
  }, [epgUrl]);

  const loadEpg = useCallback(async (url: string) => {
    if (!url) return;
    setEpgLoading(true);
    setEpgError(null);
    try {
      const data = await fetchEpg(url);
      setEpgData(data);
    } catch (e) {
      setEpgError(e instanceof Error ? e.message : "Failed to load EPG");
    } finally {
      setEpgLoading(false);
    }
  }, []);

  const setPlaylistUrl = useCallback(async (url: string) => {
    setPlaylistUrlState(url);
    await AsyncStorage.setItem(STORAGE_URL_KEY, url);
    await loadChannels(url);
  }, [loadChannels]);

  const setEpgUrl = useCallback(async (url: string) => {
    setEpgUrlState(url);
    await AsyncStorage.setItem(STORAGE_EPG_URL_KEY, url);
    await loadEpg(url);
  }, [loadEpg]);

  const refresh = useCallback(async () => {
    if (playlistUrl) await loadChannels(playlistUrl);
  }, [playlistUrl, loadChannels]);

  const refreshEpg = useCallback(async () => {
    if (epgUrl) await loadEpg(epgUrl);
  }, [epgUrl, loadEpg]);

  const getCurrentProgram = useCallback((tvgId: string): EpgProgram | null => {
    if (!tvgId || epgData.size === 0) return null;
    const programs = epgData.get(tvgId);
    if (!programs) return null;
    const now = Date.now();
    return programs.find((p) => p.start.getTime() <= now && p.stop.getTime() > now) ?? null;
  }, [epgData]);

  return (
    <IptvContext.Provider
      value={{
        playlistUrl, setPlaylistUrl,
        channels, groups, groupNames: Object.keys(groups).sort(),
        isLoading, error, refresh,
        epgUrl, setEpgUrl,
        epgData, epgLoading, epgError, refreshEpg,
        getCurrentProgram,
      }}
    >
      {children}
    </IptvContext.Provider>
  );
}

export function useIptv() {
  const ctx = useContext(IptvContext);
  if (!ctx) throw new Error("useIptv must be used within IptvProvider");
  return ctx;
}
