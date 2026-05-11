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
import { StremioMeta, StremioStream } from "@/services/stremio";
import {
  TmdbEpisode,
  TmdbSeason,
  TmdbSeasonMeta,
  findTmdbIdFromImdb,
  getTmdbSeason,
  getTmdbShow,
  tmdbPoster,
  tmdbBackdrop,
} from "@/services/tmdb";

const STREAM_TIMEOUT_MS = 12000;

export default function DetailScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getDetail, getStreams } = useStremio();
  const { useTmdb } = useSettings();

  const [meta, setMeta] = useState<StremioMeta | null>(null);
  const [streams, setStreams] = useState<StremioStream[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [streamsLoaded, setStreamsLoaded] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [metaError, setMetaError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [tmdbId, setTmdbId] = useState<number | null>(null);
  const [seasons, setSeasons] = useState<TmdbSeasonMeta[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [currentSeason, setCurrentSeason] = useState<TmdbSeason | null>(null);
  const [loadingSeason, setLoadingSeason] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<TmdbEpisode | null>(null);

  const bgImage = meta?.background ?? meta?.poster;

  useEffect(() => {
    if (!type || !id) return;
    setLoadingMeta(true);
    getDetail(type, id)
      .then(async (m) => {
        setMeta(m);
        setMetaError(null);
        if (m && type === "series" && useTmdb) {
          const imdbId = id.split(":")[0];
          const tid = await findTmdbIdFromImdb(imdbId);
          if (tid) {
            setTmdbId(tid);
            const show = await getTmdbShow(tid);
            if (show?.seasons) {
              const filtered = show.seasons.filter((s) => s.season_number > 0);
              setSeasons(filtered);
              const firstSeason = filtered[0]?.season_number ?? 1;
              setSelectedSeason(firstSeason);
            }
          }
        }
      })
      .catch(() => setMetaError("Failed to load details"))
      .finally(() => setLoadingMeta(false));
  }, [type, id, useTmdb]);

  useEffect(() => {
    if (!tmdbId || type !== "series" || !useTmdb) return;
    setLoadingSeason(true);
    getTmdbSeason(tmdbId, selectedSeason)
      .then((s) => { setCurrentSeason(s); setSelectedEpisode(null); })
      .finally(() => setLoadingSeason(false));
  }, [tmdbId, selectedSeason, useTmdb]);

  const loadStreams = async (episodeId?: string) => {
    const streamId = episodeId ?? id;
    if (!type || !streamId || loadingStreams) return;
    setLoadingStreams(true);
    setStreamError(null);
    setStreams([]);
    setElapsed(0);

    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    const timeout = new Promise<StremioStream[]>((resolve) =>
      setTimeout(() => resolve([]), STREAM_TIMEOUT_MS)
    );
    try {
      const result = await Promise.race([getStreams(type, streamId), timeout]);
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

  useEffect(() => {
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  const handleStream = (stream: StremioStream) => {
    if (stream.url) {
      router.push({ pathname: "/player", params: { url: stream.url, title: meta?.name ?? "Stream" } });
    } else if (stream.infoHash) {
      const magnet = `magnet:?xt=urn:btih:${stream.infoHash}${stream.sources?.length ? "&tr=" + stream.sources.join("&tr=") : ""}`;
      Linking.openURL(magnet).catch(() => {});
    }
  };

  const handleEpisodePress = (ep: TmdbEpisode) => {
    setSelectedEpisode(ep);
    setStreamsLoaded(false);
    setStreams([]);
    const imdbId = (id ?? "").split(":")[0];
    const episodeStremioId = `${imdbId}:${ep.season_number}:${ep.episode_number}`;
    loadStreams(episodeStremioId);
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

  const streamLabel = (s: StremioStream) => s.title ?? s.name ?? "Stream";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Image source={{ uri: bgImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={["rgba(0,0,0,0.3)", colors.background]} style={[StyleSheet.absoluteFill, { top: "30%" }]} />
        <Pressable style={[styles.backBtn, { top: insets.top + 8, backgroundColor: "rgba(0,0,0,0.5)" }]} onPress={() => router.back()}>
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
                  {meta.type === "movie" ? "MOVIE" : "SERIES"}
                </Text>
              </View>
              {meta.imdbRating ? (
                <View style={[styles.badge, { backgroundColor: colors.surface }]}>
                  <Feather name="star" size={10} color="#f59e0b" />
                  <Text style={[styles.badgeText, { color: "#f59e0b" }]}>{meta.imdbRating}</Text>
                </View>
              ) : null}
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

        {type === "movie" && (
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

        {type === "series" && seasons.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Seasons</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonRow}>
              {seasons.map((s) => (
                <Pressable
                  key={s.season_number}
                  style={[
                    styles.seasonChip,
                    {
                      backgroundColor: selectedSeason === s.season_number ? colors.primary : colors.card,
                      borderColor: selectedSeason === s.season_number ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => setSelectedSeason(s.season_number)}
                >
                  <Text
                    style={[
                      styles.seasonChipText,
                      { color: selectedSeason === s.season_number ? colors.primaryForeground : colors.foreground },
                    ]}
                  >
                    {s.name ?? `Season ${s.season_number}`}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {loadingSeason ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 16 }} />
            ) : currentSeason?.episodes && currentSeason.episodes.length > 0 ? (
              <View style={styles.episodeList}>
                {currentSeason.episodes.map((ep) => {
                  const isSelected = selectedEpisode?.episode_number === ep.episode_number && selectedEpisode?.season_number === ep.season_number;
                  return (
                    <Pressable
                      key={ep.id}
                      style={({ pressed }) => [
                        styles.episodeRow,
                        {
                          backgroundColor: isSelected ? colors.surface : colors.card,
                          borderColor: isSelected ? colors.primary : colors.border,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                      onPress={() => handleEpisodePress(ep)}
                    >
                      {ep.still_path ? (
                        <Image
                          source={{ uri: tmdbPoster(ep.still_path, "w185") }}
                          style={styles.episodeThumb}
                          contentFit="cover"
                        />
                      ) : (
                        <View style={[styles.episodeThumb, styles.episodeThumbPlaceholder, { backgroundColor: colors.surface }]}>
                          <Feather name="play" size={18} color={colors.mutedForeground} />
                        </View>
                      )}
                      <View style={styles.episodeInfo}>
                        <Text style={[styles.episodeNum, { color: colors.mutedForeground }]}>
                          E{ep.episode_number}
                          {ep.runtime ? ` · ${ep.runtime}m` : ""}
                        </Text>
                        <Text style={[styles.episodeName, { color: colors.foreground }]} numberOfLines={2}>
                          {ep.name}
                        </Text>
                        {ep.overview ? (
                          <Text style={[styles.episodeDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                            {ep.overview}
                          </Text>
                        ) : null}
                      </View>
                      <Feather name={isSelected ? "chevron-down" : "chevron-right"} size={16} color={colors.mutedForeground} />
                    </Pressable>
                  );
                })}
              </View>
            ) : (
              <Text style={[styles.metaText, { color: colors.mutedForeground }]}>No episodes found for this season.</Text>
            )}
          </>
        )}

        {type === "series" && seasons.length === 0 && (
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
        )}

        {(streamsLoaded || (loadingStreams && selectedEpisode)) && (
          <View style={styles.streamsSection}>
            {selectedEpisode && (
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>
                Streams for S{selectedEpisode.season_number}E{selectedEpisode.episode_number} – {selectedEpisode.name}
              </Text>
            )}
            <Text style={[styles.streamsSubtitle, { color: colors.mutedForeground }]}>
              {loadingStreams ? "Searching…" : `${streams.length} stream${streams.length !== 1 ? "s" : ""} found`}
            </Text>

            {streamError ? (
              <View style={[styles.noStreams, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="info" size={18} color={colors.mutedForeground} />
                <Text style={[styles.noStreamsText, { color: colors.mutedForeground }]}>{streamError}</Text>
              </View>
            ) : null}

            {streams.map((stream, i) => (
              <Pressable
                key={i}
                style={({ pressed }) => [styles.streamRow, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
                onPress={() => handleStream(stream)}
              >
                <View style={[styles.streamIcon, { backgroundColor: colors.surface }]}>
                  <Feather name={stream.url ? "play-circle" : "link"} size={20} color={colors.primary} />
                </View>
                <View style={styles.streamInfo}>
                  <Text style={[styles.streamName, { color: colors.foreground }]} numberOfLines={2}>{streamLabel(stream)}</Text>
                  {stream.infoHash && !stream.url ? (
                    <Text style={[styles.streamMeta, { color: colors.mutedForeground }]}>Torrent — opens externally</Text>
                  ) : null}
                </View>
                <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 32 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorText: { fontSize: 16, fontFamily: "Inter_500Medium", textAlign: "center" },
  linkText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  hero: { height: 260, justifyContent: "flex-end" },
  backBtn: { position: "absolute", left: 16, width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  posterRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  poster: { width: 100, height: 150, borderRadius: 10, flexShrink: 0 },
  mainInfo: { flex: 1, gap: 8, paddingTop: 4 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 28 },
  badges: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  metaRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  metaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  genres: { fontSize: 13, fontFamily: "Inter_400Regular" },
  description: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, opacity: 0.85 },
  sectionTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold", marginTop: 4 },
  seasonRow: { gap: 8, paddingVertical: 4 },
  seasonChip: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  seasonChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  episodeList: { gap: 10 },
  episodeRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, overflow: "hidden", gap: 0 },
  episodeThumb: { width: 100, height: 65 },
  episodeThumbPlaceholder: { justifyContent: "center", alignItems: "center" },
  episodeInfo: { flex: 1, padding: 10, gap: 3 },
  episodeNum: { fontSize: 11, fontFamily: "Inter_400Regular" },
  episodeName: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 17 },
  episodeDesc: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
  watchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  watchBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  streamsSection: { gap: 10 },
  streamsSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  noStreams: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 10, borderWidth: 1, alignItems: "flex-start" },
  noStreamsText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  streamRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderWidth: 1 },
  streamIcon: { width: 44, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  streamInfo: { flex: 1 },
  streamName: { fontSize: 14, fontFamily: "Inter_500Medium", lineHeight: 19 },
  streamMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
