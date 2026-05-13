import { useRouter } from "expo-router";
import React from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useColors } from "@/hooks/useColors";

interface Props<T> {
  title: string;
  data: T[];
  renderItem: ({ item }: { item: T }) => React.ReactElement;
  keyExtractor: (item: T) => string;
  seeAllRoute?: string;
  seeAllParams?: Record<string, string>;
}

export function CategoryRow<T>({
  title,
  data,
  renderItem,
  keyExtractor,
  seeAllRoute,
  seeAllParams,
}: Props<T>) {
  const colors = useColors();
  const router = useRouter();

  if (data.length === 0) return null;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        {!!seeAllRoute && (
          <Pressable
            onPress={() =>
              router.push({ pathname: seeAllRoute as string, params: seeAllParams })
            }
          >
            <Text style={[styles.seeAll, { color: colors.primary }]}>See all</Text>
          </Pressable>
        )}
      </View>
      <FlatList
        horizontal
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        scrollEnabled={data.length > 0}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  seeAll: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
  },
  list: {
    paddingHorizontal: 16,
  },
});
