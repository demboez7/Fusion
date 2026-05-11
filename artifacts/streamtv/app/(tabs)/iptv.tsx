import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ChannelCard } from "@/components/ChannelCard";
import { SearchBar } from "@/components/SearchBar";
import { useIptv } from "@/contexts/IptvContext";
import { useColors } from "@/hooks/useColors";
import { IptvChannel } from "@/services/m3u-parser";
import { useRouter } from "expo-router";

export default function IptvScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { channels, groups, groupNames, isLoading, error, refresh, playlistUrl } = useIptv();

  const [search, setSearch] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  };

  const filteredChannels: IptvChannel[] = (() => {
    let chs = selectedGroup ? (groups[selectedGroup] ?? []) : channels;
    if (search) {
      const q = search.toLowerCase();
      chs = chs.filter((c) => c.name.toLowerCase().includes(q));
    }
    return chs;
  })();

  if (!playlistUrl) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={[styles.heading, { color: colors.foreground }]}>Live TV</Text>
        </View>
        <View style={styles.empty}>
          <Feather name="tv" size={48} color={colors.mutedForeground} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No Playlist Added</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>
            Add your M3U playlist URL in Settings to watch live TV
          </Text>
          <Pressable
            style={[styles.settingsBtn, { backgroundColor: colors.primary }]}
            onPress={() => router.push("/(tabs)/settings")}
          >
            <Feather name="settings" size={16} color={colors.primaryForeground} />
            <Text style={[styles.settingsBtnText, { color: colors.primaryForeground }]}>Go to Settings</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  if (isLoading && channels.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={[styles.heading, { color: colors.foreground }]}>Live TV</Text>
        </View>
        <View style={styles.empty}>
          <ActivityIndicator color={colors.primary} size="large" />
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Loading channels...</Text>
        </View>
      </View>
    );
  }

  if (error && channels.length === 0) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={[styles.heading, { color: colors.foreground }]}>Live TV</Text>
        </View>
        <View style={styles.empty}>
          <Feather name="alert-circle" size={48} color={colors.destructive} />
          <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Failed to Load</Text>
          <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{error}</Text>
          <Pressable
            style={[styles.settingsBtn, { backgroundColor: colors.primary }]}
            onPress={refresh}
          >
            <Text style={[styles.settingsBtnText, { color: colors.primaryForeground }]}>Retry</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Text style={[styles.heading, { color: colors.foreground }]}>Live TV</Text>
        <Text style={[styles.count, { color: colors.mutedForeground }]}>
          {channels.length} channels
        </Text>
      </View>

      <SearchBar value={search} onChangeText={setSearch} placeholder="Search channels..." />

      {groupNames.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.groups}
          style={styles.groupsScroll}
        >
          <Pressable
            style={[
              styles.groupChip,
              {
                backgroundColor: !selectedGroup ? colors.primary : colors.card,
                borderColor: !selectedGroup ? colors.primary : colors.border,
              },
            ]}
            onPress={() => setSelectedGroup(null)}
          >
            <Text
              style={[
                styles.groupChipText,
                { color: !selectedGroup ? colors.primaryForeground : colors.foreground },
              ]}
            >
              All
            </Text>
          </Pressable>
          {groupNames.map((g) => (
            <Pressable
              key={g}
              style={[
                styles.groupChip,
                {
                  backgroundColor: selectedGroup === g ? colors.primary : colors.card,
                  borderColor: selectedGroup === g ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedGroup(g === selectedGroup ? null : g)}
            >
              <Text
                style={[
                  styles.groupChipText,
                  { color: selectedGroup === g ? colors.primaryForeground : colors.foreground },
                ]}
              >
                {g}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}

      <FlatList
        data={filteredChannels}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
        scrollEnabled={filteredChannels.length > 0}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}
        renderItem={({ item }) => <ChannelCard channel={item} compact />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>No channels found</Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { paddingHorizontal: 16, paddingBottom: 4 },
  heading: { fontSize: 26, fontFamily: "Inter_700Bold" },
  count: { fontSize: 13, fontFamily: "Inter_400Regular", marginTop: 2 },
  groupsScroll: { maxHeight: 44, marginBottom: 12 },
  groups: { paddingHorizontal: 16, gap: 8, alignItems: "center" },
  groupChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  groupChipText: { fontSize: 13, fontFamily: "Inter_500Medium" },
  empty: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 32,
    paddingTop: 60,
  },
  emptyTitle: { fontSize: 18, fontFamily: "Inter_600SemiBold", textAlign: "center" },
  emptyText: { fontSize: 14, fontFamily: "Inter_400Regular", textAlign: "center" },
  settingsBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 10,
    marginTop: 8,
  },
  settingsBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
});
