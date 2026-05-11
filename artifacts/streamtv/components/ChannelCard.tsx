import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { EpgBadge } from "@/components/EpgBadge";
import { useIptv } from "@/contexts/IptvContext";
import { useColors } from "@/hooks/useColors";
import { IptvChannel } from "@/services/m3u-parser";

interface Props {
  channel: IptvChannel;
  onPress?: () => void;
  compact?: boolean;
}

export function ChannelCard({ channel, onPress, compact = false }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { getCurrentProgram } = useIptv();
  const currentProgram = channel.tvgId ? getCurrentProgram(channel.tvgId) : null;

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push({
        pathname: "/player",
        params: { url: channel.url, title: channel.name, logo: channel.logo ?? "" },
      });
    }
  };

  if (compact) {
    return (
      <Pressable
        style={({ pressed }) => [
          styles.compact,
          { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
        ]}
        onPress={handlePress}
      >
        <View style={[styles.compactLogo, { backgroundColor: colors.surface }]}>
          {channel.logo ? (
            <Image source={{ uri: channel.logo }} style={styles.compactLogoImg} contentFit="contain" />
          ) : (
            <Feather name="tv" size={18} color={colors.mutedForeground} />
          )}
        </View>
        <View style={styles.compactInfo}>
          <Text style={[styles.compactName, { color: colors.foreground }]} numberOfLines={1}>
            {channel.name}
          </Text>
          {currentProgram && (
            <Text style={[styles.epgNow, { color: colors.mutedForeground }]} numberOfLines={1}>
              ▶ {currentProgram.title}
            </Text>
          )}
        </View>
        <Feather name="chevron-right" size={14} color={colors.mutedForeground} />
      </Pressable>
    );
  }

  return (
    <Pressable
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
      ]}
      onPress={handlePress}
    >
      <View style={[styles.logo, { backgroundColor: colors.surface }]}>
        {channel.logo ? (
          <Image source={{ uri: channel.logo }} style={styles.logoImg} contentFit="contain" />
        ) : (
          <Feather name="tv" size={22} color={colors.mutedForeground} />
        )}
      </View>
      <View style={styles.live}>
        <View style={[styles.liveDot, { backgroundColor: "#ef4444" }]} />
        <Text style={[styles.liveText, { color: "#ef4444" }]}>LIVE</Text>
      </View>
      <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={2}>
        {channel.name}
      </Text>
      {currentProgram && (
        <Text style={[styles.epgNow, { color: colors.mutedForeground }]} numberOfLines={1}>
          {currentProgram.title}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 140,
    marginRight: 12,
    borderRadius: 10,
    borderWidth: 1,
    overflow: "hidden",
  },
  logo: {
    width: "100%",
    height: 80,
    justifyContent: "center",
    alignItems: "center",
  },
  logoImg: { width: "80%", height: "80%" },
  live: { flexDirection: "row", alignItems: "center", paddingHorizontal: 8, paddingTop: 6, gap: 4 },
  liveDot: { width: 5, height: 5, borderRadius: 3 },
  liveText: { fontSize: 9, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  name: { fontSize: 11, fontFamily: "Inter_500Medium", paddingHorizontal: 8, paddingTop: 3, lineHeight: 15 },
  epgNow: { fontSize: 9, fontFamily: "Inter_400Regular", paddingHorizontal: 8, paddingBottom: 8, paddingTop: 2 },
  compact: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 10,
    borderWidth: 1,
    marginBottom: 8,
    gap: 12,
  },
  compactLogo: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    flexShrink: 0,
  },
  compactLogoImg: { width: 32, height: 32 },
  compactInfo: { flex: 1, gap: 3 },
  compactName: { fontSize: 14, fontFamily: "Inter_500Medium" },
  epgNow: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
