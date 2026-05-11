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
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { CategoryRow } from "@/components/CategoryRow";
import { ChannelCard } from "@/components/ChannelCard";
import { ContentCard } from "@/components/ContentCard";
import { ShimmerRow } from "@/components/ShimmerCard";
import { useIptv } from "@/contexts/IptvContext";
import { useStremio } from "@/contexts/StremioContext";
import { useColors } from "@/hooks/useColors";
import { StremioMeta } from "@/services/stremio";

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getMovies, getSeries } = useStremio();
  const { channels } = useIptv();

  const [movies, setMovies] = useState<StremioMeta[]>([]);
  const [series, setSeries] = useState<StremioMeta[]>([]);
  const [hero, setHero] = useState<StremioMeta | null>(null);
  const [loadingMovies, setLoadingMovies] = useState(true);
  const [loadingSeries, setLoadingSeries] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadContent = async () => {
    setLoadingMovies(true);
    setLoadingSeries(true);
    try {
      const [m, s] = await Promise.all([getMovies(), getSeries()]);
      setMovies(m);
      setSeries(s);
      if (m.length > 0) setHero(m[Math.floor(Math.random() * Math.min(5, m.length))]);
    } catch {}
    setLoadingMovies(false);
    setLoadingSeries(false);
  };

  useEffect(() => { loadContent(); }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadContent();
    setRefreshing(false);
  };

  const liveChannels = channels.slice(0, 10);

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
      }
    >
      {hero ? (
        <Pressable
          style={styles.hero}
          onPress={() => router.push({ pathname: "/detail", params: { type: hero.type, id: hero.id } })}
        >
          <Image
            source={{ uri: hero.background ?? hero.poster }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
          <LinearGradient
            colors={["transparent", colors.background]}
            style={[StyleSheet.absoluteFill, { top: "40%" }]}
          />
          <View style={[styles.heroContent, { paddingBottom: 20, paddingTop: insets.top + 10 }]}>
            <View style={styles.heroBadge}>
              <Text style={[styles.heroBadgeText, { color: colors.primary }]}>
                {hero.type === "movie" ? "MOVIE" : "SERIES"}
              </Text>
            </View>
            <Text style={[styles.heroTitle, { color: colors.foreground }]} numberOfLines={2}>
              {hero.name}
            </Text>
            {hero.imdbRating && (
              <View style={styles.heroMeta}>
                <Feather name="star" size={12} color="#f59e0b" />
                <Text style={[styles.heroMetaText, { color: colors.mutedForeground }]}>
                  {hero.imdbRating}
                </Text>
                {hero.releaseInfo && (
                  <Text style={[styles.heroMetaText, { color: colors.mutedForeground }]}>
                    · {hero.releaseInfo}
                  </Text>
                )}
                {hero.runtime && (
                  <Text style={[styles.heroMetaText, { color: colors.mutedForeground }]}>
                    · {hero.runtime}
                  </Text>
                )}
              </View>
            )}
            <View style={styles.heroButtons}>
              <Pressable
                style={({ pressed }) => [
                  styles.playBtn,
                  { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => router.push({ pathname: "/detail", params: { type: hero.type, id: hero.id } })}
              >
                <Feather name="play" size={16} color={colors.primaryForeground} />
                <Text style={[styles.playBtnText, { color: colors.primaryForeground }]}>Play</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  styles.infoBtn,
                  { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
                ]}
                onPress={() => router.push({ pathname: "/detail", params: { type: hero.type, id: hero.id } })}
              >
                <Feather name="info" size={16} color={colors.foreground} />
                <Text style={[styles.infoBtnText, { color: colors.foreground }]}>More Info</Text>
              </Pressable>
            </View>
          </View>
        </Pressable>
      ) : (
        <View style={[styles.heroPlaceholder, { backgroundColor: colors.card, paddingTop: insets.top }]} />
      )}

      <View style={styles.content}>
        {liveChannels.length > 0 && (
          <CategoryRow
            title="Live TV"
            data={liveChannels}
            keyExtractor={(ch) => ch.id}
            renderItem={({ item }) => <ChannelCard channel={item} />}
            seeAllRoute="/(tabs)/iptv"
          />
        )}

        {loadingMovies ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Top Movies</Text>
            <ShimmerRow />
          </View>
        ) : (
          <CategoryRow
            title="Top Movies"
            data={movies.slice(0, 10)}
            keyExtractor={(m) => m.id}
            renderItem={({ item }) => <ContentCard item={item} />}
            seeAllRoute="/(tabs)/movies"
          />
        )}

        {loadingSeries ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Top Series</Text>
            <ShimmerRow />
          </View>
        ) : (
          <CategoryRow
            title="Top Series"
            data={series.slice(0, 10)}
            keyExtractor={(s) => s.id}
            renderItem={({ item }) => <ContentCard item={item} />}
            seeAllRoute="/(tabs)/series"
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  hero: {
    width: "100%",
    height: 420,
    justifyContent: "flex-end",
  },
  heroPlaceholder: {
    height: 320,
  },
  heroContent: {
    paddingHorizontal: 16,
    gap: 8,
  },
  heroBadge: {
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  heroBadgeText: {
    fontSize: 10,
    fontFamily: "Inter_700Bold",
    letterSpacing: 2,
  },
  heroTitle: {
    fontSize: 28,
    fontFamily: "Inter_700Bold",
    lineHeight: 34,
  },
  heroMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  heroMetaText: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
  },
  heroButtons: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  playBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  playBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  infoBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  infoBtnText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  content: {
    paddingTop: 20,
  },
  section: {
    marginBottom: 24,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
    paddingHorizontal: 16,
  },
});
