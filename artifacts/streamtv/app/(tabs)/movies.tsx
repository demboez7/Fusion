import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ContentCard } from "@/components/ContentCard";
import { SearchBar } from "@/components/SearchBar";
import { ShimmerCard } from "@/components/ShimmerCard";
import { useStremio } from "@/contexts/StremioContext";
import { useColors } from "@/hooks/useColors";
import { StremioMeta } from "@/services/stremio";

const CARD_WIDTH = 110;
const NUM_COLUMNS = 3;

export default function MoviesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getMovies } = useStremio();

  const [movies, setMovies] = useState<StremioMeta[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [skip, setSkip] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [searchTimeout, setSearchTimeout] = useState<ReturnType<typeof setTimeout> | null>(null);

  const load = useCallback(async (q: string, currentSkip: number, append = false) => {
    if (!append) setLoading(true);
    else setLoadingMore(true);
    try {
      const results = await getMovies(q || undefined, currentSkip);
      if (append) setMovies((prev) => [...prev, ...results]);
      else setMovies(results);
      setHasMore(results.length >= 20);
    } catch {
      setHasMore(false);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [getMovies]);

  useEffect(() => { load("", 0); }, []);

  const handleSearch = (text: string) => {
    setSearch(text);
    if (searchTimeout) clearTimeout(searchTimeout);
    const t = setTimeout(() => {
      setSkip(0);
      load(text, 0);
    }, 400);
    setSearchTimeout(t);
  };

  const loadMore = () => {
    if (loadingMore || !hasMore || loading) return;
    const newSkip = skip + 20;
    setSkip(newSkip);
    load(search, newSkip, true);
  };

  const numCols = 3;
  const itemWidth = (344 - 16 * 2 - 12 * (numCols - 1)) / numCols;

  if (loading) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={[styles.heading, { color: colors.foreground }]}>Movies</Text>
        </View>
        <SearchBar value="" onChangeText={() => {}} placeholder="Search movies..." />
        <View style={styles.shimmerGrid}>
          {Array.from({ length: 9 }).map((_, i) => (
            <ShimmerCard key={i} width={itemWidth} height={itemWidth * 1.5} />
          ))}
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.heading, { color: colors.foreground }]}>Movies</Text>
      </View>
      <SearchBar value={search} onChangeText={handleSearch} placeholder="Search movies..." />
      {movies.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No movies found</Text>
        </View>
      ) : (
        <FlatList
          data={movies}
          numColumns={NUM_COLUMNS}
          keyExtractor={(item) => item.id}
          columnWrapperStyle={styles.row}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 90 }}
          showsVerticalScrollIndicator={false}
          onEndReached={loadMore}
          onEndReachedThreshold={0.5}
          scrollEnabled={movies.length > 0}
          renderItem={({ item }) => (
            <ContentCard item={item} width={itemWidth} />
          )}
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.primary} style={{ marginTop: 16 }} />
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    paddingHorizontal: 16,
    paddingBottom: 12,
  },
  heading: {
    fontSize: 26,
    fontFamily: "Inter_700Bold",
  },
  shimmerGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: 16,
    gap: 12,
  },
  row: {
    gap: 12,
    marginBottom: 14,
  },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});
