import { Feather } from "@expo/vector-icons";
import { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

function TvTab({
  isFocused,
  icon,
  label,
  onPress,
  preferred,
  colors,
}: {
  isFocused: boolean;
  icon: string;
  label: string;
  onPress: () => void;
  preferred: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  const [hover, setHover] = useState(false);
  const showRing = hover;
  return (
    <Pressable
      onPress={onPress}
      onFocus={() => setHover(true)}
      onBlur={() => setHover(false)}
      hasTVPreferredFocus={preferred}
      style={({ pressed }) => [
        styles.tab,
        isFocused && [styles.tabActive, { borderBottomColor: colors.primary }],
        showRing && { backgroundColor: colors.primary + "22", borderColor: colors.focus, borderWidth: 2 },
        pressed && { opacity: 0.75 },
      ]}
    >
      <Feather
        name={icon as "home"}
        size={20}
        color={isFocused || showRing ? colors.primary : colors.mutedForeground}
      />
      <Text
        style={[
          styles.tabLabel,
          { color: isFocused || showRing ? colors.primary : colors.mutedForeground },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

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
            <TvTab
              key={route.key}
              isFocused={isFocused}
              icon={icon}
              label={label}
              preferred={isFocused}
              colors={colors}
              onPress={() => { if (!isFocused) navigation.navigate(route.name); }}
            />
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
    gap: 8,
    paddingHorizontal: 18,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: "transparent",
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
