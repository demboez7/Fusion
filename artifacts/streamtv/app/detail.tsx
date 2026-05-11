import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
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
import { useStremio } from "@/contexts/StremioContext";
import { useColors } from "@/hooks/useColors";
import { StremioMeta, StremioStream } from "@/services/stremio";

export default function DetailScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getDetail, getStreams } = useStremio();

  const [meta, setMeta] = useState<StremioMeta | null>(null);
  const [streams, setStreams] = useState<StremioStream[]>([]);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [streamsLoaded, setStreamsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!type || !id) return;
    setLoadingMeta(true);
    getDetail(type, id)
      .then((m) => { setMeta(m); setError(null); })
      .catch(() => setError("Failed to load details"))
      .finally(() => setLoadingMeta(false));
  }, [type, id]);

  const loadStreams = async () => {
    if (!type || !id || loadingStreams) return;
    setLoadingStreams(true);
    try {
      const s = await getStreams(type, id);
      setStreams(s);
    } catch {}
    setLoadingStreams(false);
    setStreamsLoaded(true);
  };

  const handleStream = (stream: StremioStream) => {
    if (stream.url) {
      router.push({
        pathname: "/player",
        params: { url: stream.url, title: meta?.name ?? "Stream" },
      });
    } else if (stream.infoHash) {
      Linking.openURL(`magnet:?xt=urn:btih:${stream.infoHash}`).catch(() => {});
    }
  };

  if (loadingMeta) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (error || !meta) {
    return (
      <View style={[styles.loadingScreen, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>{error ?? "Not found"}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const streamName = (s: StremioStream) => s.title ?? s.name ?? "Stream";

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Image
          source={{ uri: meta.background ?? meta.poster }}
          style={StyleSheet.absoluteFill}
          contentFit="cover"
        />
        <LinearGradient
          colors={["rgba(0,0,0,0.3)", colors.background]}
          style={[StyleSheet.absoluteFill, { top: "30%" }]}
        />
        <Pressable
          style={[styles.backBtn, { top: insets.top + 8, backgroundColor: "rgba(0,0,0,0.5)" }]}
          onPress={() => router.back()}
        >
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.posterRow}>
          {meta.poster && (
            <Image
              source={{ uri: meta.poster }}
              style={[styles.poster, { backgroundColor: colors.card }]}
              contentFit="cover"
            />
          )}
          <View style={styles.mainInfo}>
            <Text style={[styles.title, { color: colors.foreground }]}>{meta.name}</Text>

            <View style={styles.badges}>
              {meta.type && (
                <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                  <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
                    {meta.type === "movie" ? "MOVIE" : "SERIES"}
                  </Text>
                </View>
              )}
              {meta.imdbRating && (
                <View style={[styles.badge, { backgroundColor: colors.surface }]}>
                  <Feather name="star" size={10} color="#f59e0b" />
                  <Text style={[styles.badgeText, { color: "#f59e0b" }]}>{meta.imdbRating}</Text>
                </View>
              )}
            </View>

            <View style={styles.metaRow}>
              {meta.releaseInfo && (
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{meta.releaseInfo}</Text>
              )}
              {meta.runtime && (
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>· {meta.runtime}</Text>
              )}
            </View>

            {meta.genres && meta.genres.length > 0 && (
              <Text style={[styles.genres, { color: colors.mutedForeground }]}>
                {meta.genres.slice(0, 3).join(" · ")}
              </Text>
            )}
          </View>
        </View>

        {meta.description && (
          <Text style={[styles.description, { color: colors.foreground }]}>{meta.description}</Text>
        )}

        <Pressable
          style={({ pressed }) => [
            styles.watchBtn,
            { backgroundColor: colors.primary, opacity: pressed ? 0.85 : 1 },
          ]}
          onPress={() => { loadStreams(); }}
        >
          {loadingStreams ? (
            <ActivityIndicator color={colors.primaryForeground} />
          ) : (
            <>
              <Feather name="play" size={18} color={colors.primaryForeground} />
              <Text style={[styles.watchBtnText, { color: colors.primaryForeground }]}>
                {streamsLoaded ? "Reload Streams" : "Find Streams"}
              </Text>
            </>
          )}
        </Pressable>

        {streamsLoaded && (
          <View style={styles.streamsSection}>
            <Text style={[styles.streamsTitle, { color: colors.foreground }]}>
              Available Streams ({streams.length})
            </Text>
            {streams.length === 0 ? (
              <View style={[styles.noStreams, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Feather name="alert-circle" size={20} color={colors.mutedForeground} />
                <Text style={[styles.noStreamsText, { color: colors.mutedForeground }]}>
                  No streams found. Install more Stremio addons or sign in to your account.
                </Text>
              </View>
            ) : (
              streams.map((stream, i) => (
                <Pressable
                  key={i}
                  style={({ pressed }) => [
                    styles.streamRow,
                    {
                      backgroundColor: colors.card,
                      borderColor: colors.border,
                      opacity: pressed ? 0.75 : 1,
                    },
                  ]}
                  onPress={() => handleStream(stream)}
                >
                  <View style={[styles.streamIcon, { backgroundColor: colors.surface }]}>
                    <Feather
                      name={stream.url ? "play-circle" : "link"}
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.streamInfo}>
                    <Text style={[styles.streamName, { color: colors.foreground }]} numberOfLines={1}>
                      {streamName(stream)}
                    </Text>
                    {stream.infoHash && !stream.url && (
                      <Text style={[styles.streamMeta, { color: colors.mutedForeground }]}>
                        Torrent (open in external app)
                      </Text>
                    )}
                    {stream.url && (
                      <Text style={[styles.streamMeta, { color: colors.mutedForeground }]} numberOfLines={1}>
                        {stream.url.startsWith("http") ? "Direct stream" : stream.url}
                      </Text>
                    )}
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
                </Pressable>
              ))
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingScreen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 16 },
  errorText: { fontSize: 16, fontFamily: "Inter_500Medium" },
  backText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  hero: { height: 260, justifyContent: "flex-end" },
  backBtn: {
    position: "absolute",
    left: 16,
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
  },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 16 },
  posterRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  poster: { width: 100, height: 150, borderRadius: 10, flexShrink: 0 },
  mainInfo: { flex: 1, gap: 8, paddingTop: 4 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 28 },
  badges: { flexDirection: "row", gap: 8 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  metaRow: { flexDirection: "row", gap: 4 },
  metaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  genres: { fontSize: 13, fontFamily: "Inter_400Regular" },
  description: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, opacity: 0.85 },
  watchBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
  },
  watchBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  streamsSection: { gap: 12 },
  streamsTitle: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  noStreams: {
    flexDirection: "row",
    gap: 10,
    padding: 14,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: "flex-start",
  },
  noStreamsText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  streamRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
  },
  streamIcon: { width: 44, height: 44, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  streamInfo: { flex: 1 },
  streamName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  streamMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
