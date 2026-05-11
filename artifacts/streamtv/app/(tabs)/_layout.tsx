import { Feather } from "@expo/vector-icons";
import { BlurView } from "expo-blur";
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Tabs } from "expo-router";
import { Icon, Label, NativeTabs } from "expo-router/unstable-native-tabs";
import { SymbolView } from "expo-symbols";
import React from "react";
import { Platform, StyleSheet, View } from "react-native";
import { TvTabBar } from "@/components/TvTabBar";
import { useSettings } from "@/contexts/SettingsContext";
import { useColors } from "@/hooks/useColors";

function NativeTabLayout() {
  return (
    <NativeTabs>
      <NativeTabs.Trigger name="index">
        <Icon sf={{ default: "house", selected: "house.fill" }} />
        <Label>Home</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="movies">
        <Icon sf={{ default: "film", selected: "film.fill" }} />
        <Label>Movies</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="series">
        <Icon sf={{ default: "play.rectangle", selected: "play.rectangle.fill" }} />
        <Label>Series</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="iptv">
        <Icon sf={{ default: "tv", selected: "tv.fill" }} />
        <Label>Live TV</Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <Icon sf={{ default: "gearshape", selected: "gearshape.fill" }} />
        <Label>Settings</Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}

function ClassicTabLayout() {
  const colors = useColors();
  const { isTvMode } = useSettings();
  const isIOS = Platform.OS === "ios";
  const isWeb = Platform.OS === "web";

  if (isTvMode) {
    return (
      <Tabs
        tabBar={(props) => <TvTabBar {...props} />}
        screenOptions={{ headerShown: false }}
      >
        <Tabs.Screen name="index" />
        <Tabs.Screen name="movies" />
        <Tabs.Screen name="series" />
        <Tabs.Screen name="iptv" />
        <Tabs.Screen name="settings" />
      </Tabs>
    );
  }

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        headerShown: false,
        tabBarStyle: {
          position: "absolute",
          backgroundColor: isIOS ? "transparent" : colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.border,
          elevation: 0,
          height: isWeb ? 84 : 60,
        },
        tabBarBackground: () =>
          isIOS ? (
            <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          ) : (
            <View style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]} />
          ),
        tabBarLabelStyle: { fontFamily: "Inter_500Medium", fontSize: 10 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="house" tintColor={color} size={22} /> : <Feather name="home" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="movies"
        options={{
          title: "Movies",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="film" tintColor={color} size={22} /> : <Feather name="film" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="series"
        options={{
          title: "Series",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="play.rectangle" tintColor={color} size={22} /> : <Feather name="monitor" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="iptv"
        options={{
          title: "Live TV",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="tv" tintColor={color} size={22} /> : <Feather name="tv" size={22} color={color} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color }) =>
            isIOS ? <SymbolView name="gearshape" tintColor={color} size={22} /> : <Feather name="settings" size={22} color={color} />,
        }}
      />
    </Tabs>
  );
}

export default function TabLayout() {
  if (isLiquidGlassAvailable()) return <NativeTabLayout />;
  return <ClassicTabLayout />;
}
