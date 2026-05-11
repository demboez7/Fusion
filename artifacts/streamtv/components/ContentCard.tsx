import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import React from "react";
import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";
import { StremioMeta } from "@/services/stremio";

interface Props {
  item: StremioMeta;
  width?: number;
  showType?: boolean;
}

export function ContentCard({ item, width = 120, showType = false }: Props) {
  const colors = useColors();
  const router = useRouter();
  const height = width * 1.5;

  return (
    <Pressable
      style={({ pressed }) => [
        styles.container,
        { width, opacity: pressed ? 0.75 : 1 },
      ]}
      onPress={() =>
        router.push({ pathname: "/detail", params: { type: item.type, id: item.id } })
      }
    >
      <View style={[styles.poster, { width, height, backgroundColor: colors.card, borderRadius: 8 }]}>
        {item.poster ? (
          <Image
            source={{ uri: item.poster }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
          />
        ) : (
          <View style={styles.placeholder}>
            <Feather name="film" size={24} color={colors.mutedForeground} />
          </View>
        )}
      </View>
      <Text
        style={[styles.name, { color: colors.foreground }]}
        numberOfLines={2}
      >
        {item.name}
      </Text>
      {showType && (
        <Text style={[styles.type, { color: colors.mutedForeground }]}>
          {item.type === "movie" ? "Movie" : "Series"}
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    marginRight: 12,
  },
  poster: {
    overflow: "hidden",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  name: {
    fontSize: 12,
    fontFamily: "Inter_500Medium",
    lineHeight: 16,
  },
  type: {
    fontSize: 10,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
});
