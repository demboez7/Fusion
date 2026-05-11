import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useColors } from "@/hooks/useColors";
import { StremioMeta } from "@/services/stremio";

interface Props {
  item: StremioMeta;
  width?: number;
}

export function TvContentCard({ item, width = 200 }: Props) {
  const colors = useColors();
  const router = useRouter();
  const height = width * 1.5;
  const [focused, setFocused] = useState(false);

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { width, opacity: pressed ? 0.85 : 1 },
      ]}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onPress={() =>
        router.push({ pathname: "/detail", params: { type: item.type, id: item.id } })
      }
    >
      <View
        style={[
          styles.poster,
          {
            width,
            height,
            backgroundColor: colors.card,
            borderRadius: 10,
            borderWidth: focused ? 3 : 0,
            borderColor: focused ? colors.focus : "transparent",
          },
        ]}
      >
        {item.poster ? (
          <Image
            source={{ uri: item.poster }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
          />
        ) : (
          <View style={styles.placeholder}>
            <Feather name="film" size={36} color={colors.mutedForeground} />
          </View>
        )}
        {focused && (
          <View style={styles.focusOverlay}>
            <View style={[styles.playIcon, { backgroundColor: colors.primary }]}>
              <Feather name="play" size={20} color={colors.primaryForeground} />
            </View>
          </View>
        )}
      </View>
      <Text
        style={[styles.name, { color: focused ? colors.primary : colors.foreground }]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
      {!!item.imdbRating && (
        <Text style={[styles.rating, { color: colors.mutedForeground }]}>★ {item.imdbRating}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 16,
  },
  poster: {
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 8,
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  focusOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  playIcon: {
    width: 52,
    height: 52,
    borderRadius: 26,
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontSize: 14,
    fontFamily: "Inter_600SemiBold",
    lineHeight: 19,
  },
  rating: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
