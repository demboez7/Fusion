import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { IptvChannel, fetchM3U, groupChannels } from "@/services/m3u-parser";

const STORAGE_URL_KEY = "iptv_playlist_url";
const STORAGE_CHANNELS_KEY = "iptv_channels_cache";

interface IptvContextValue {
  playlistUrl: string;
  setPlaylistUrl: (url: string) => Promise<void>;
  channels: IptvChannel[];
  groups: Record<string, IptvChannel[]>;
  groupNames: string[];
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

const IptvContext = createContext<IptvContextValue | null>(null);

export function IptvProvider({ children }: { children: React.ReactNode }) {
  const [playlistUrl, setPlaylistUrlState] = useState("");
  const [channels, setChannels] = useState<IptvChannel[]>([]);
  const [groups, setGroups] = useState<Record<string, IptvChannel[]>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      AsyncStorage.getItem(STORAGE_URL_KEY),
      AsyncStorage.getItem(STORAGE_CHANNELS_KEY),
    ]).then(([url, cached]) => {
      if (url) setPlaylistUrlState(url);
      if (cached) {
        const chs = JSON.parse(cached) as IptvChannel[];
        setChannels(chs);
        setGroups(groupChannels(chs));
      }
    });
  }, []);

  const loadChannels = useCallback(async (url: string) => {
    if (!url) return;
    setIsLoading(true);
    setError(null);
    try {
      const chs = await fetchM3U(url);
      setChannels(chs);
      setGroups(groupChannels(chs));
      await AsyncStorage.setItem(STORAGE_CHANNELS_KEY, JSON.stringify(chs));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load playlist");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const setPlaylistUrl = useCallback(async (url: string) => {
    setPlaylistUrlState(url);
    await AsyncStorage.setItem(STORAGE_URL_KEY, url);
    await loadChannels(url);
  }, [loadChannels]);

  const refresh = useCallback(async () => {
    if (playlistUrl) await loadChannels(playlistUrl);
  }, [playlistUrl, loadChannels]);

  return (
    <IptvContext.Provider
      value={{
        playlistUrl,
        setPlaylistUrl,
        channels,
        groups,
        groupNames: Object.keys(groups).sort(),
        isLoading,
        error,
        refresh,
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
