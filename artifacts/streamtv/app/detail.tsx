import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSettings } from "@/contexts/SettingsContext";
import { useStremio } from "@/contexts/StremioContext";
import { useColors } from "@/hooks/useColors";
import { StremioMeta, StremioStream, StremioVideo } from "@/services/stremio";
import {
  TmdbEpisode,
  findTmdbIdFromImdb,
  getTmdbSeason,
  getTmdbShow,
  tmdbPoster,
} from "@/services/tmdb";

const STREAM_TIMEOUT_MS = 15000;

interface SeasonEpisode {
  id: string;
  season: number;
  episode: number;
  title: string;
  thumbnail?: string;
  overview?: string;
  runtime?: number | null;
  airDate?: string | null;
}

function groupVideosBySeasonFromMeta(videos: StremioVideo[]): Map<number, SeasonEpisode[]> {
  const map = new Map<number, SeasonEpisode[]>();
  for (const v of videos) {
    const s = v.season ?? 0;
    if (s <= 0) continue;
    if (!map.has(s)) map.set(s, []);
    map.get(s)!.push({
      id: v.id,
      season: s,
      episode: v.episode ?? 0,
      title: v.title ?? v.name ?? `Episode ${v.episode ?? "?"}`,
      thumbnail: v.thumbnail,
      overview: v.overview,
      runtime: null,
      airDate: v.released ?? null,
    });
  }
  for (const eps of map.values()) {
    eps.sort((a, b) => a.episode - b.episode);
  }
  return map;
}

function mergeTmdbIntoEpisodes(
  episodes: SeasonEpisode[],
  tmdbEps: TmdbEpisode[]
): SeasonEpisode[] {
  const tmdbMap = new Map(tmdbEps.map((e) => [e.episode_number, e]));
  return episodes.map((ep) => {
    const t = tmdbMap.get(ep.episode);
    if (!t) return ep;
    return {
      ...ep,
      title: t.name || ep.title,
      thumbnail: t.still_path ? tmdbPoster(t.still_path, "w185") : ep.thumbnail,
      overview: t.overview || ep.overview,
      runtime: t.runtime,
      airDate: t.air_date,
    };
  });
}

export default function DetailScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getDetail, getStreams } = useStremio();
  const { useTmdb } = useSettings();

  const [meta, setMeta] = useState<StremioMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [seasonMap, setSeasonMap] = useState<Map<number, SeasonEpisode[]>>(new Map());
  const [seasonNumbers, setSeasonNumbers] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [tmdbId, setTmdbId] = useState<number | null>(null);
  const [loadingTmdb, setLoadingTmdb] = useState(false);

  const [streams, setStreams] = useState<StremioStream[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [streamsLoaded, setStreamsLoaded] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [activeEpisode, setActiveEpisode] = useState<SeasonEpisode | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bgImage = meta?.background ?? meta?.poster;

  useEffect(() => {
    if (!type || !id) return;
    setLoadingMeta(true);
    setMetaError(null);
    const imdbId = id.split(":")[0];
    getDetail(type, imdbId)
      .then((m) => {
        setMeta(m);
        if (m && type === "series" && m.videos && m.videos.length > 0) {
          const grouped = groupVideosBySeasonFromMeta(m.videos);
          setSeasonMap(grouped);
          const nums = Array.from(grouped.keys()).sort((a, b) => a - b);
          setSeasonNumbers(nums);
          setSelectedSeason(nums[0] ?? 1);

          if (useTmdb) {
            setLoadingTmdb(true);
            findTmdbIdFromImdb(imdbId)
              .then((tid) => {
                if (tid) {
                  setTmdbId(tid);
                  return getTmdbShow(tid).then((show) => {
                    const filtered = show?.seasons?.filter((s) => s.season_number > 0) ?? [];
                    if (filtered.length > 0) {
                      const firstSeason = nums[0] ?? 1;
                      return getTmdbSeason(tid, firstSeason).then((season) => {
                        if (season?.episodes) {
                          setSeasonMap((prev) => {
                            const next = new Map(prev);
                            const existing = next.get(firstSeason) ?? [];
                            next.set(firstSeason, mergeTmdbIntoEpisodes(existing, season.episodes));
                            return next;
                          });
                        }
                      });
                    }
                  });
                }
              })
              .catch(() => {})
              .finally(() => setLoadingTmdb(false));
          }
        }
      })
      .catch(() => setMetaError("Failed to load details"))
      .finally(() => setLoadingMeta(false));
  }, [type, id, useTmdb]);

  useEffect(() => {
    if (!tmdbId || !useTmdb || selectedSeason === 0) return;
    getTmdbSeason(tmdbId, selectedSeason)
      .then((season) => {
        if (season?.episodes) {
          setSeasonMap((prev) => {
            const next = new Map(prev);
            const existing = next.get(selectedSeason) ?? [];
            next.set(selectedSeason, mergeTmdbIntoEpisodes(existing, season.episodes));
            return next;
          });
        }
      })
      .catch(() => {});
  }, [tmdbId, selectedSeason, useTmdb]);

  const loadStreams = async (streamId?: string) => {
    const sid = streamId ?? id;
    if (!type || !sid || loadingStreams) return;
    setLoadingStreams(true);
    setStreamError(null);
    setStreams([]);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    const timeout = new Promise<StremioStream[]>((res) =>
      setTimeout(() => res([]), STREAM_TIMEOUT_MS)
    );
    try {
      const result = await Promise.race([getStreams(type, sid), timeout]);
      setStreams(result);
      if (result.length === 0)
        setStreamError("No streams found. Install Torrentio from the Stremio addon catalog or sign in to your account.");
    } catch {
      setStreamError("Failed to fetch streams. Check your connection.");
    } finally {
      setLoadingStreams(false);
      setStreamsLoaded(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleEpisodePress = (ep: SeasonEpisode) => {
    if (activeEpisode?.id === ep.id) {
      setActiveEpisode(null);
      setStreams([]);
      setStreamsLoaded(false);
      return;
    }
    setActiveEpisode(ep);
    setStreams([]);
    setStreamsLoaded(false);
    const imdbId = (id ?? "").split(":")[0];
    loadStreams(`${imdbId}:${ep.season}:${ep.episode}`);
  };

  const handleStream = (stream: StremioStream) => {
    if (stream.url) {
      router.push({
        pathname: "/player",
        params: { url: stream.url, title: activeEpisode ? `${meta?.name} · S${activeEpisode.season}E${activeEpisode.episode}` : (meta?.name ?? "Stream") },
      });
    } else if (stream.infoHash) {
      const magnet = `magnet:?xt=urn:btih:${stream.infoHash}${stream.sources?.length ? "&tr=" + stream.sources.join("&tr=") : ""}`;
      Linking.openURL(magnet).catch(() => {});
    }
  };

  if (loadingMeta) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading…</Text>
      </View>
    );
  }

  if (metaError || !meta) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>{metaError ?? "Not found"}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.linkText, { color: colors.primary }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const currentEpisodes = seasonMap.get(selectedSeason) ?? [];
  const isSeries = type === "series";
  const hasEpisodes = isSeries && seasonNumbers.length > 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Image source={{ uri: bgImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={["rgba(0,0,0,0.15)", colors.background]} style={[StyleSheet.absoluteFill, { top: "25%" }]} />
        <Pressable style={[styles.backBtn, { top: insets.top + 8, backgroundColor: "rgba(0,0,0,0.55)" }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.posterRow}>
          {meta.poster && (
            <Image source={{ uri: meta.poster }} style={[styles.poster, { backgroundColor: colors.card }]} contentFit="cover" />
          )}
          <View style={styles.mainInfo}>
            <Text style={[styles.title, { color: colors.foreground }]}>{meta.name}</Text>
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
                  {isSeries ? "SERIES" : "MOVIE"}
                </Text>
              </View>
              {meta.imdbRating ? (
                <View style={[styles.badge, { backgroundColor: colors.surface }]}>
                  <Feather name="star" size={10} color="#f59e0b" />
                  <Text style={[styles.badgeText, { color: "#f59e0b" }]}>{meta.imdbRating}</Text>
                </View>
              ) : null}
              {useTmdb && (
                <View style={[styles.badge, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.badgeText, { color: colors.primary }]}>TMDB</Text>
                </View>
              )}
            </View>
            <View style={styles.metaRow}>
              {meta.releaseInfo ? <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{meta.releaseInfo}</Text> : null}
              {meta.runtime ? <Text style={[styles.metaText, { color: colors.mutedForeground }]}>· {meta.runtime}</Text> : null}
            </View>
            {meta.genres && meta.genres.length > 0 && (
              <Text style={[styles.genres, { color: colors.mutedForeground }]}>{meta.genres.slice(0, 3).join(" · ")}</Text>
            )}
          </View>
        </View>

        {meta.description ? (
          <Text style={[styles.description, { color: colors.foreground }]}>{meta.description}</Text>
        ) : null}

        {!isSeries && (
          <Pressable
            style={({ pressed }) => [styles.watchBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
            onPress={() => loadStreams()}
            disabled={loadingStreams}
          >
            {loadingStreams ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primaryForeground} />
                <Text style={[styles.watchBtnText, { color: colors.primaryForeground }]}>
                  Searching{elapsed > 0 ? ` (${elapsed}s)` : ""}…
                </Text>
              </View>
            ) : (
              <>
                <Feather name="search" size={18} color={colors.primaryForeground} />
                <Text style={[styles.watchBtnText, { color: colors.primaryForeground }]}>
                  {streamsLoaded ? "Search Again" : "Find Streams"}
                </Text>
              </>
            )}
          </Pressable>
        )}

        {!isSeries && streamsLoaded && (
          <StreamsList
            streams={streams}
            loadingStreams={loadingStreams}
            streamError={streamError}
            elapsed={elapsed}
            onPress={handleStream}
            colors={colors}
          />
        )}

        {hasEpisodes && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Episodes</Text>
              {loadingTmdb && (
                <View style={styles.tmdbBadge}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.tmdbBadgeText, { color: colors.mutedForeground }]}>Loading TMDB…</Text>
                </View>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonRow}>
              {seasonNumbers.map((s) => (
                <Pressable
                  key={s}
                  style={[
                    styles.seasonChip,
                    {
                      backgroundColor: selectedSeason === s ? colors.primary : colors.card,
                      borderColor: selectedSeason === s ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => { setSelectedSeason(s); setActiveEpisode(null); setStreams([]); setStreamsLoaded(false); }}
                >
                  <Text style={[styles.seasonChipText, { color: selectedSeason === s ? colors.primaryForeground : colors.foreground }]}>
                    S{s}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.episodeList}>
              {currentEpisodes.map((ep) => {
                const isActive = activeEpisode?.id === ep.id;
                return (
                  <View key={ep.id}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.episodeRow,
                        {
                          backgroundColor: isActive ? colors.surface : colors.card,
                          borderColor: isActive ? colors.primary : colors.border,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                      onPress={() => handleEpisodePress(ep)}
                    >
                      {ep.thumbnail ? (
                        <Image source={{ uri: ep.thumbnail }} style={styles.episodeThumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.episodeThumb, styles.episodeThumbPlaceholder, { backgroundColor: colors.surface }]}>
                          <Feather name="play" size={18} color={colors.mutedForeground} />
                        </View>
                      )}
                      <View style={styles.episodeInfo}>
                        <Text style={[styles.episodeNum, { color: colors.mutedForeground }]}>
                          E{ep.episode}{ep.runtime ? ` · ${ep.runtime}m` : ""}
                        </Text>
                        <Text style={[styles.episodeName, { color: colors.foreground }]} numberOfLines={2}>
                          {ep.title}
                        </Text>
                        {ep.overview ? (
                          <Text style={[styles.episodeDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                            {ep.overview}
                          </Text>
                        ) : null}
                      </View>
                      {isActive && loadingStreams ? (
                        <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                      ) : (
                        <Feather name={isActive ? "chevron-down" : "play"} size={16} color={isActive ? colors.primary : colors.mutedForeground} />
                      )}
                    </Pressable>

                    {isActive && streamsLoaded && (
                      <View style={[styles.inlineStreams, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <StreamsList
                          streams={streams}
                          loadingStreams={loadingStreams}
                          streamError={streamError}
                          elapsed={elapsed}
                          onPress={handleStream}
                          colors={colors}
                          compact
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {isSeries && !hasEpisodes && (
          <>
            <Pressable
              style={({ pressed }) => [styles.watchBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 }]}
              onPress={() => loadStreams()}
              disabled={loadingStreams}
            >
              {loadingStreams ? (
                <View style={styles.loadingRow}>
                  <ActivityIndicator color={colors.primaryForeground} />
                  <Text style={[styles.watchBtnText, { color: colors.primaryForeground }]}>Searching{elapsed > 0 ? ` (${elapsed}s)` : ""}…</Text>
                </View>
              ) : (
                <>
                  <Feather name="search" size={18} color={colors.primaryForeground} />
                  <Text style={[styles.watchBtnText, { color: colors.primaryForeground }]}>{streamsLoaded ? "Search Again" : "Find Streams"}</Text>
                </>
              )}
            </Pressable>
            {streamsLoaded && (
              <StreamsList streams={streams} loadingStreams={loadingStreams} streamError={streamError} elapsed={elapsed} onPress={handleStream} colors={colors} />
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function StreamsList({
  streams,
  streamError,
  elapsed,
  onPress,
  colors,
  compact = false,
}: {
  streams: StremioStream[];
  loadingStreams: boolean;
  streamError: string | null;
  elapsed: number;
  onPress: (s: StremioStream) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  compact?: boolean;
}) {
  return (
    <View style={compact ? styles.streamsSectionCompact : styles.streamsSection}>
      {!compact && (
        <Text style={[styles.streamsSubtitle, { color: colors.mutedForeground }]}>
          {streams.length} stream{streams.length !== 1 ? "s" : ""} found
        </Text>
      )}
      {streamError ? (
        <View style={[styles.noStreams, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="info" size={16} color={colors.mutedForeground} />
          <Text style={[styles.noStreamsText, { color: colors.mutedForeground }]}>{streamError}</Text>
        </View>
      ) : null}
      {streams.map((stream, i) => (
        <Pressable
          key={i}
          style={({ pressed }) => [styles.streamRow, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
          onPress={() => onPress(stream)}
        >
          <View style={[styles.streamIcon, { backgroundColor: colors.surface }]}>
            <Feather name={stream.url ? "play-circle" : "link"} size={18} color={colors.primary} />
          </View>
          <View style={styles.streamInfo}>
            <Text style={[styles.streamName, { color: colors.foreground }]} numberOfLines={2}>
              {stream.title ?? stream.name ?? "Stream"}
            </Text>
            {stream.infoHash && !stream.url ? (
              <Text style={[styles.streamMeta, { color: colors.mutedForeground }]}>Torrent — opens externally</Text>
            ) : null}
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 32 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorText: { fontSize: 16, fontFamily: "Inter_500Medium", textAlign: "center" },
  linkText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  hero: { height: 260, justifyContent: "flex-end" },
  backBtn: { position: "absolute", left: 16, width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  posterRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  poster: { width: 100, height: 150, borderRadius: 10, flexShrink: 0 },
  mainInfo: { flex: 1, gap: 7, paddingTop: 4 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 28 },
  badges: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  metaRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  metaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  genres: { fontSize: 13, fontFamily: "Inter_400Regular" },
  description: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, opacity: 0.85 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  tmdbBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  tmdbBadgeText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  seasonRow: { gap: 8, paddingVertical: 2 },
  seasonChip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  seasonChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  episodeList: { gap: 8 },
  episodeRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  episodeThumb: { width: 100, height: 64 },
  episodeThumbPlaceholder: { justifyContent: "center", alignItems: "center" },
  episodeInfo: { flex: 1, padding: 10, gap: 2 },
  episodeNum: { fontSize: 11, fontFamily: "Inter_400Regular" },
  episodeName: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 17 },
  episodeDesc: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
  inlineStreams: { borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, marginTop: -8, paddingTop: 8, paddingHorizontal: 8, paddingBottom: 8 },
  watchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  watchBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  streamsSection: { gap: 8 },
  streamsSectionCompact: { gap: 6, paddingTop: 4 },
  streamsSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  noStreams: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 10, borderWidth: 1, alignItems: "flex-start" },
  noStreamsText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  streamRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderWidth: 1 },
  streamIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  streamInfo: { flex: 1 },
  streamName: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },
  streamMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
