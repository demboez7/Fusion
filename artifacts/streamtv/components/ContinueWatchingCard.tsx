import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useProgress, type ProgressEntry } from "@/contexts/ProgressContext";
import { useColors } from "@/hooks/useColors";
import { useSettings } from "@/contexts/SettingsContext";

interface Props {
  entry: ProgressEntry;
  width?: number;
}

export function ContinueWatchingCard({ entry, width = 160 }: Props) {
  const colors = useColors();
  const router = useRouter();
  const { clearProgress } = useProgress();
  const { isTvMode } = useSettings();
  const [focused, setFocused] = useState(false);
  const height = Math.round(width * 0.62);
  const showRing = isTvMode && focused;

  const pct = entry.duration > 0 ? Math.min(1, Math.max(0, entry.position / entry.duration)) : 0;
  const remaining = Math.max(0, entry.duration - entry.position);
  const remMin = Math.round(remaining / 60);
  const remainingLabel = remMin >= 60
    ? `${Math.floor(remMin / 60)}h ${remMin % 60}m left`
    : `${remMin}m left`;

  return (
    <Pressable
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      style={({ pressed }) => [
        styles.container,
        { width, opacity: pressed ? 0.75 : 1 },
        showRing && { transform: [{ scale: 1.05 }] },
      ]}
      onPress={() => {
        // If we know the last-played stream, resume it directly. Fall back
        // to the detail page (e.g. when the user cleared their player or
        // only the progress entry is present).
        if (entry.lastStreamUrl) {
          router.push({
            pathname: "/player",
            params: {
              url: entry.lastStreamUrl,
              title: entry.lastStreamTitle ?? entry.name,
              type: entry.type,
              subtitleId: entry.lastStreamSubtitleId ?? "",
              progressKey: entry.key,
              progressId: entry.id,
              poster: entry.poster ?? "",
              background: entry.background ?? "",
              episodeLabel: entry.episodeLabel ?? "",
              resumePosition: String(Math.floor(entry.position)),
            },
          });
        } else {
          router.push({ pathname: "/detail", params: { type: entry.type, id: entry.id } });
        }
      }}
    >
      <View style={[
        styles.thumb,
        { width, height, backgroundColor: colors.card },
        showRing && { borderWidth: 3, borderColor: colors.focus },
      ]}>
        {entry.background || entry.poster ? (
          <Image
            source={{ uri: entry.background ?? entry.poster }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.placeholder}>
            <Feather name="film" size={24} color={colors.mutedForeground} />
          </View>
        )}
        <View style={styles.playOverlay}>
          <View style={[styles.playCircle, { backgroundColor: "rgba(0,0,0,0.55)" }]}>
            <Feather name="play" size={20} color="#fff" />
          </View>
        </View>
        <Pressable
          style={[styles.removeBtn, { backgroundColor: "rgba(0,0,0,0.6)" }]}
          onPress={(e) => {
            e.stopPropagation();
            clearProgress(entry.key);
          }}
          hitSlop={8}
        >
          <Feather name="x" size={12} color="#fff" />
        </Pressable>
        <View style={[styles.progressTrack, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
          <View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${pct * 100}%` }]} />
        </View>
      </View>
      <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>
        {entry.name}
      </Text>
      <Text style={[styles.sub, { color: colors.mutedForeground }]} numberOfLines={1}>
        {entry.episodeLabel ? `${entry.episodeLabel} · ${remainingLabel}` : remainingLabel}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { marginRight: 12 },
  thumb: { overflow: "hidden", borderRadius: 8, marginBottom: 6 },
  placeholder: { flex: 1, justifyContent: "center", alignItems: "center" },
  playOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: "center", alignItems: "center" },
  playCircle: { width: 36, height: 36, borderRadius: 18, justifyContent: "center", alignItems: "center" },
  removeBtn: { position: "absolute", top: 6, right: 6, width: 20, height: 20, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  progressTrack: { position: "absolute", left: 0, right: 0, bottom: 0, height: 3 },
  progressFill: { height: "100%" },
  name: { fontSize: 12, fontFamily: "Inter_500Medium", lineHeight: 16 },
  sub: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
});
