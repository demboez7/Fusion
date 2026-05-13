import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryRow } from "@/components/CategoryRow";
import { ChannelCard } from "@/components/ChannelCard";
import { ContentCard } from "@/components/ContentCard";
import { ContinueWatchingCard } from "@/components/ContinueWatchingCard";
import { ShimmerRow } from "@/components/ShimmerCard";
import { TvContentCard } from "@/components/TvContentCard";
import { useIptv } from "@/contexts/IptvContext";
import { useProgress } from "@/contexts/ProgressContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useStremio } from "@/contexts/StremioContext";
import { useColors } from "@/hooks/useColors";
import { CatalogRow, StremioMeta } from "@/services/stremio";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { getMovies, getSeries, getCatalogRows, addons, isLoading: stremioLoading } = useStremio();
  const { channels } = useIptv();
  const { isTvMode } = useSettings();
  const { entries: progressEntries } = useProgress();
  // Continue-watching items: anything between 2% and 95% watched, most recent first.
  const continueWatching = progressEntries
    .filter((e) => {
      if (!e.duration || e.duration < 60) return false;
      const pct = e.position / e.duration;
      return pct > 0.02 && pct < 0.95;
    })
    .slice(0, 12);

  const [rows, setRows] = useState<CatalogRow[]>([]);
  const [fallbackMovies, setFallbackMovies] = useState<StremioMeta[]>([]);
  const [fallbackSeries, setFallbackSeries] = useState<StremioMeta[]>([]);
  const [hero, setHero] = useState<StremioMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const cardWidth = isTvMode ? 180 : 120;
  const tvHeroHeight = isTvMode ? Math.round(width * 0.42) : 420;

  const doLoad = async () => {
    setLoading(true);
    try {
      const catalogRows = await getCatalogRows();
      if (catalogRows.length > 0) {
        setRows(catalogRows);
        setFallbackMovies([]);
        setFallbackSeries([]);
        // Pick hero from the first row's first few items.
        const heroPool = catalogRows[0].items.slice(0, 5);
        if (heroPool.length > 0) {
          setHero(heroPool[Math.floor(Math.random() * heroPool.length)]);
        }
      } else {
        // No addon catalogs available — fall back to Cinemeta defaults.
        setRows([]);
        const [m, s] = await Promise.all([getMovies(), getSeries()]);
        setFallbackMovies(m);
        setFallbackSeries(s);
        if (m.length > 0) setHero(m[Math.floor(Math.random() * Math.min(5, m.length))]);
      }
    } catch {}
    setLoading(false);
  };

  // Re-run whenever stremio finishes its initial load OR addons change (login/logout)
  useEffect(() => {
    if (stremioLoading) return;
    doLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stremioLoading, addons]);

  const onRefresh = async () => {
    setRefreshing(true);
    await doLoad();
    setRefreshing(false);
  };

  const liveChannels = channels.slice(0, 12);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: isTvMode ? 32 : insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
    >
      {hero ? (
        <Pressable
          style={[styles.hero, { height: tvHeroHeight }]}
          onPress={() => router.push({ pathname: "/detail", params: { type: hero.type, id: hero.id } })}
        >
          <Image source={{ uri: hero.background ?? hero.poster }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["transparent", colors.background]} style={[StyleSheet.absoluteFill, { top: "40%" }]} />
          <View style={[styles.heroContent, { paddingBottom: 20, paddingTop: isTvMode ? 10 : insets.top + 10 }]}>
            <View style={styles.heroBadge}>
              <Text style={[styles.heroBadgeText, { color: colors.primary }]}>
                {hero.type === "movie" ? "MOVIE" : "SERIES"}
              </Text>
            </View>
            <Text style={[styles.heroTitle, { color: colors.foreground, fontSize: isTvMode ? 36 : 28 }]} numberOfLines={2}>
              {hero.name}
            </Text>
            {!!hero.imdbRating && (
              <View style={styles.heroMeta}>
                <Feather name="star" size={12} color="#f59e0b" />
                <Text style={[styles.heroMetaText, { color: colors.mutedForeground }]}>{hero.imdbRating}</Text>
                {hero.releaseInfo ? <Text style={[styles.heroMetaText, { color: colors.mutedForeground }]}>· {hero.releaseInfo}</Text> : null}
                {hero.runtime ? <Text style={[styles.heroMetaText, { color: colors.mutedForeground }]}>· {hero.runtime}</Text> : null}
              </View>
            )}
            <View style={styles.heroButtons}>
              <Pressable
                style={({ pressed }) => [styles.playBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]}
                onPress={() => router.push({ pathname: "/detail", params: { type: hero.type, id: hero.id } })}
              >
                <Feather name="play" size={isTvMode ? 20 : 16} color={colors.primaryForeground} />
                <Text style={[styles.playBtnText, { color: colors.primaryForeground, fontSize: isTvMode ? 17 : 14 }]}>Play</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [styles.infoBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 }]}
                onPress={() => router.push({ pathname: "/detail", params: { type: hero.type, id: hero.id } })}
              >
                <Feather name="info" size={isTvMode ? 20 : 16} color={colors.foreground} />
                <Text style={[styles.infoBtnText, { color: colors.foreground, fontSize: isTvMode ? 17 : 14 }]}>More Info</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      ) : (
        <View style={[styles.heroPlaceholder, { backgroundColor: colors.card, height: tvHeroHeight }]} />
      )}

      <View style={[styles.content, { paddingTop: isTvMode ? 28 : 20 }]}>
        {continueWatching.length > 0 && (
          <CategoryRow
            title="Continue Watching"
            data={continueWatching}
            keyExtractor={(e) => e.key}
            renderItem={({ item }) => <ContinueWatchingCard entry={item} width={isTvMode ? 220 : 160} />}
          />
        )}

        {liveChannels.length > 0 && (
          <CategoryRow
            title="Live TV"
            data={liveChannels}
            keyExtractor={(ch) => ch.id}
            renderItem={({ item }) => <ChannelCard channel={item} />}
            seeAllRoute="/(tabs)/iptv"
          />
        )}

        {loading ? (
          <>
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { color: colors.foreground, fontSize: isTvMode ? 20 : 16 }]}>Loading…</Text>
              <ShimmerRow />
            </View>
            <View style={styles.section}>
              <ShimmerRow />
            </View>
          </>
        ) : rows.length > 0 ? (
          rows.map((row) => (
            <CategoryRow
              key={row.key}
              title={`${row.addonName} · ${row.catalogName}${row.type === "movie" ? " · Movies" : row.type === "series" ? " · Series" : row.type === "anime" ? " · Anime" : ""}`}
              data={row.items.slice(0, 20)}
              keyExtractor={(m) => `${row.key}-${m.id}`}
              renderItem={({ item }) =>
                isTvMode
                  ? <TvContentCard item={item} width={cardWidth} />
                  : <ContentCard item={item} width={cardWidth} />
              }
              seeAllRoute={row.type === "series" ? "/(tabs)/series" : "/(tabs)/movies"}
            />
          ))
        ) : (
          <>
            <CategoryRow
              title="Top Movies"
              data={fallbackMovies.slice(0, 12)}
              keyExtractor={(m) => m.id}
              renderItem={({ item }) =>
                isTvMode
                  ? <TvContentCard item={item} width={cardWidth} />
                  : <ContentCard item={item} width={cardWidth} />
              }
              seeAllRoute="/(tabs)/movies"
            />
            <CategoryRow
              title="Top Series"
              data={fallbackSeries.slice(0, 12)}
              keyExtractor={(s) => s.id}
              renderItem={({ item }) =>
                isTvMode
                  ? <TvContentCard item={item} width={cardWidth} />
                  : <ContentCard item={item} width={cardWidth} />
              }
              seeAllRoute="/(tabs)/series"
            />
          </>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  hero: { width: "100%", justifyContent: "flex-end" },
  heroPlaceholder: {},
  heroContent: { paddingHorizontal: 20, gap: 8 },
  heroBadge: { alignSelf: "flex-start", marginBottom: 4 },
  heroBadgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 2 },
  heroTitle: { fontFamily: "Inter_700Bold", lineHeight: 38 },
  heroMeta: { flexDirection: "row", alignItems: "center", gap: 4 },
  heroMetaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  heroButtons: { flexDirection: "row", gap: 10, marginTop: 8 },
  playBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  playBtnText: { fontFamily: "Inter_600SemiBold" },
  infoBtn: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  infoBtnText: { fontFamily: "Inter_600SemiBold" },
  content: {},
  section: { marginBottom: 28, gap: 14 },
  sectionTitle: { fontFamily: "Inter_600SemiBold", paddingHorizontal: 16 },
});
