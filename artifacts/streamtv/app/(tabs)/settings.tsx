import { Feather } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIptv } from "@/contexts/IptvContext";
import { useStremio } from "@/contexts/StremioContext";
import { useColors } from "@/hooks/useColors";

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return (
    <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{title}</Text>
  );
}

function SettingsRow({
  icon,
  label,
  value,
  onPress,
  destructive,
}: {
  icon: string;
  label: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
}) {
  const colors = useColors();
  return (
    <Pressable
      style={({ pressed }) => [
        styles.row,
        { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 },
      ]}
      onPress={onPress}
      disabled={!onPress}
    >
      <View style={styles.rowLeft}>
        <Feather
          name={icon as "user"}
          size={18}
          color={destructive ? colors.destructive : colors.primary}
        />
        <Text style={[styles.rowLabel, { color: destructive ? colors.destructive : colors.foreground }]}>
          {label}
        </Text>
      </View>
      {value !== undefined && (
        <Text style={[styles.rowValue, { color: colors.mutedForeground }]} numberOfLines={1}>
          {value}
        </Text>
      )}
      {onPress && !value && (
        <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
      )}
    </Pressable>
  );
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isLoggedIn, user, login, logout, addons } = useStremio();
  const { playlistUrl, setPlaylistUrl, channels } = useIptv();

  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [showIptv, setShowIptv] = useState(false);
  const [iptvInput, setIptvInput] = useState(playlistUrl);
  const [savingIptv, setSavingIptv] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setLoginError("Please enter email and password");
      return;
    }
    setLoggingIn(true);
    setLoginError("");
    try {
      await login(email.trim(), password);
      setShowLogin(false);
      setEmail("");
      setPassword("");
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Login failed");
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out of Stremio?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  const handleSaveIptv = async () => {
    setSavingIptv(true);
    try {
      await setPlaylistUrl(iptvInput.trim());
      setShowIptv(false);
    } catch {}
    setSavingIptv(false);
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <ScrollView
        contentContainerStyle={{ paddingBottom: insets.bottom + 90 }}
        showsVerticalScrollIndicator={false}
      >
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={[styles.heading, { color: colors.foreground }]}>Settings</Text>
        </View>

        <SectionHeader title="STREMIO ACCOUNT" />

        {isLoggedIn && user ? (
          <>
            <SettingsRow icon="user" label={user.email ?? "Stremio Account"} />
            <SettingsRow
              icon="package"
              label="Installed Addons"
              value={`${addons.length} addons`}
            />
            <SettingsRow icon="log-out" label="Sign Out" onPress={handleLogout} destructive />
          </>
        ) : (
          <>
            <SettingsRow
              icon="log-in"
              label="Sign In to Stremio"
              onPress={() => setShowLogin(!showLogin)}
            />
            {showLogin && (
              <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                  placeholder="Email"
                  placeholderTextColor={colors.mutedForeground}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  keyboardType="email-address"
                  selectionColor={colors.primary}
                />
                <TextInput
                  style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
                  placeholder="Password"
                  placeholderTextColor={colors.mutedForeground}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  selectionColor={colors.primary}
                />
                {loginError ? (
                  <Text style={[styles.error, { color: colors.destructive }]}>{loginError}</Text>
                ) : null}
                <Pressable
                  style={({ pressed }) => [
                    styles.formBtn,
                    { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
                  ]}
                  onPress={handleLogin}
                  disabled={loggingIn}
                >
                  {loggingIn ? (
                    <ActivityIndicator color={colors.primaryForeground} />
                  ) : (
                    <Text style={[styles.formBtnText, { color: colors.primaryForeground }]}>
                      Sign In
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
            <View style={[styles.note, { backgroundColor: colors.card }]}>
              <Feather name="info" size={14} color={colors.mutedForeground} />
              <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
                Sign in to sync your Stremio addons and stream with your configured sources including Debrid services.
              </Text>
            </View>
          </>
        )}

        <SectionHeader title="IPTV PLAYLIST" />

        <SettingsRow
          icon="tv"
          label="M3U Playlist URL"
          value={channels.length > 0 ? `${channels.length} channels loaded` : "Not configured"}
          onPress={() => setShowIptv(!showIptv)}
        />

        {showIptv && (
          <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>
              Enter your M3U playlist URL
            </Text>
            <TextInput
              style={[styles.input, { color: colors.foreground, borderColor: colors.border }]}
              placeholder="http://your-provider.com/playlist.m3u"
              placeholderTextColor={colors.mutedForeground}
              value={iptvInput}
              onChangeText={setIptvInput}
              autoCapitalize="none"
              keyboardType="url"
              selectionColor={colors.primary}
              multiline
            />
            <Pressable
              style={({ pressed }) => [
                styles.formBtn,
                { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 },
              ]}
              onPress={handleSaveIptv}
              disabled={savingIptv}
            >
              {savingIptv ? (
                <ActivityIndicator color={colors.primaryForeground} />
              ) : (
                <Text style={[styles.formBtnText, { color: colors.primaryForeground }]}>
                  Load Playlist
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {channels.length > 0 && (
          <SettingsRow icon="refresh-cw" label="Refresh Channels" onPress={() => setPlaylistUrl(playlistUrl)} />
        )}

        <SectionHeader title="ABOUT" />
        <SettingsRow icon="info" label="StreamTV" value="v1.0.0" />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  heading: { fontSize: 26, fontFamily: "Inter_700Bold" },
  sectionHeader: {
    fontSize: 11,
    fontFamily: "Inter_600SemiBold",
    letterSpacing: 1.2,
    paddingHorizontal: 16,
    paddingTop: 24,
    paddingBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: "Inter_400Regular", flex: 1 },
  rowValue: { fontSize: 13, fontFamily: "Inter_400Regular", maxWidth: 160 },
  form: {
    margin: 16,
    marginTop: 4,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 12,
  },
  formLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
    fontFamily: "Inter_400Regular",
  },
  formBtn: {
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: "center",
  },
  formBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  error: { fontSize: 13, fontFamily: "Inter_400Regular" },
  note: {
    flexDirection: "row",
    gap: 10,
    margin: 16,
    marginTop: 4,
    padding: 12,
    borderRadius: 10,
    alignItems: "flex-start",
  },
  noteText: { fontSize: 13, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 18 },
});
