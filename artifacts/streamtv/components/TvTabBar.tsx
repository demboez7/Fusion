import { Feather } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

const TAB_ICONS: Record<string, string> = {
  index: "home",
  movies: "film",
  series: "monitor",
  iptv: "tv",
  settings: "settings",
};

const TAB_LABELS: Record<string, string> = {
  index: "Home",
  movies: "Movies",
  series: "Series",
  iptv: "Live TV",
  settings: "Settings",
};

export function TvTabBar({ state, navigation }: BottomTabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.bar,
        {
          backgroundColor: colors.background,
          borderBottomColor: colors.border,
          paddingTop: insets.top + 8,
        },
      ]}
    >
      <View style={styles.logo}>
        <Feather name="play-circle" size={22} color={colors.primary} />
        <Text style={[styles.logoText, { color: colors.foreground }]}>StreamTV</Text>
      </View>

      <View style={styles.tabs}>
        {state.routes.map((route, index) => {
          const isFocused = state.index === index;
          const icon = TAB_ICONS[route.name] ?? "circle";
          const label = TAB_LABELS[route.name] ?? route.name;

          return (
            <Pressable
              key={route.key}
              style={({ pressed }) => [
                styles.tab,
                isFocused && [styles.tabActive, { borderBottomColor: colors.primary }],
                pressed && { opacity: 0.75 },
              ]}
              onPress={() => {
                if (!isFocused) navigation.navigate(route.name);
              }}
              hasTVPreferredFocus={isFocused}
            >
              <Feather
                name={icon as "home"}
                size={18}
                color={isFocused ? colors.primary : colors.mutedForeground}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isFocused ? colors.primary : colors.mutedForeground },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 24,
  },
  logo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginRight: 16,
  },
  logoText: {
    fontSize: 18,
    fontFamily: "Inter_700Bold",
  },
  tabs: {
    flexDirection: "row",
    gap: 4,
    flex: 1,
  },
  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    borderBottomWidth: 2,
    borderBottomColor: "transparent",
  },
  tabActive: {
    borderBottomWidth: 2,
  },
  tabLabel: {
    fontSize: 14,
    fontFamily: "Inter_500Medium",
  },
});
