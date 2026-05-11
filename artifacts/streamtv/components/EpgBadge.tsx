import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { EpgProgram, formatEpgTime, programProgress } from "@/services/epg";

interface Props {
  program: EpgProgram | null;
  compact?: boolean;
}

export function EpgBadge({ program, compact = false }: Props) {
  const colors = useColors();
  if (!program) return null;
  const progress = programProgress(program);

  if (compact) {
    return (
      <View style={styles.compactContainer}>
        <Text style={[styles.compactTitle, { color: colors.mutedForeground }]} numberOfLines={1}>
          {program.title}
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.row}>
        <Text style={[styles.title, { color: colors.foreground }]} numberOfLines={1}>
          {program.title}
        </Text>
        <Text style={[styles.time, { color: colors.mutedForeground }]}>
          {formatEpgTime(program.start)} – {formatEpgTime(program.stop)}
        </Text>
      </View>
      <View style={[styles.progressBg, { backgroundColor: colors.muted }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: colors.primary, width: `${Math.round(progress * 100)}%` },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    gap: 6,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  title: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  time: {
    fontSize: 11,
    fontFamily: "Inter_400Regular",
    flexShrink: 0,
  },
  progressBg: {
    height: 3,
    borderRadius: 2,
    overflow: "hidden",
  },
  progressFill: {
    height: 3,
    borderRadius: 2,
  },
  compactContainer: {
    paddingTop: 2,
  },
  compactTitle: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
  },
});
