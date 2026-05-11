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
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIptv } from "@/contexts/IptvContext";
import { useSettings } from "@/contexts/SettingsContext";
import { useStremio } from "@/contexts/StremioContext";
import { useColors } from "@/hooks/useColors";

function SectionHeader({ title }: { title: string }) {
  const colors = useColors();
  return <Text style={[styles.sectionHeader, { color: colors.mutedForeground }]}>{title}</Text>;
}

export default function SettingsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { isLoggedIn, user, login, logout, addons } = useStremio();
  const { playlistUrl, setPlaylistUrl, channels, epgUrl, setEpgUrl, epgData, epgLoading, refreshEpg } = useIptv();
  const { isTvMode, setTvMode } = useSettings();

  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [loginError, setLoginError] = useState("");

  const [showIptv, setShowIptv] = useState(false);
  const [iptvInput, setIptvInput] = useState(playlistUrl);
  const [savingIptv, setSavingIptv] = useState(false);

  const [showEpg, setShowEpg] = useState(false);
  const [epgInput, setEpgInput] = useState(epgUrl);

  const [showAddons, setShowAddons] = useState(false);

  const addonSummary = addons.map((a) => {
    const resources = (a.manifest?.resources ?? []).map((r) =>
      typeof r === "string" ? r : (r as { name?: string }).name ?? ""
    );
    const catalogs = a.manifest?.catalogs ?? [];
    const catalogTypes = Array.from(new Set(catalogs.map((c) => c.type)));
    return {
      id: a.manifest?.id ?? a.transportUrl,
      name: a.manifest?.name ?? "Unknown",
      hasCatalog: catalogs.length > 0,
      catalogTypes,
      hasMeta: resources.includes("meta"),
      hasStream: resources.includes("stream"),
    };
  });
  const movieCatalogCount = addonSummary.filter((a) => a.catalogTypes.includes("movie")).length;
  const seriesCatalogCount = addonSummary.filter((a) => a.catalogTypes.includes("series")).length;
  const streamCount = addonSummary.filter((a) => a.hasStream).length;

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setLoginError("Please enter email and password"); return; }
    setLoggingIn(true); setLoginError("");
    try {
      await login(email.trim(), password);
      setShowLogin(false); setEmail(""); setPassword("");
    } catch (e) {
      setLoginError(e instanceof Error ? e.message : "Login failed");
    } finally { setLoggingIn(false); }
  };

  const handleLogout = () => {
    Alert.alert("Sign Out", "Are you sure you want to sign out of Stremio?", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign Out", style: "destructive", onPress: logout },
    ]);
  };

  const handleSaveIptv = async () => {
    const url = iptvInput.trim();
    if (!url) {
      Alert.alert("URL required", "Please paste an M3U playlist URL.");
      return;
    }
    setSavingIptv(true);
    try {
      await setPlaylistUrl(url);
      setShowIptv(false);
      Alert.alert("Playlist loaded", "Open the Live TV tab to browse your channels.");
    } catch (e) {
      Alert.alert("Failed to load playlist", e instanceof Error ? e.message : String(e));
    } finally {
      setSavingIptv(false);
    }
  };

  const handleSaveEpg = async () => {
    await setEpgUrl(epgInput.trim());
    setShowEpg(false);
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 90 }} showsVerticalScrollIndicator={false}>
        <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <Text style={[styles.heading, { color: colors.foreground }]}>Settings</Text>
        </View>

        <SectionHeader title="STREMIO ACCOUNT" />
        {isLoggedIn && user ? (
          <>
            <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={styles.rowLeft}>
                <Feather name="user" size={18} color={colors.primary} />
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>{user.email}</Text>
              </View>
            </View>
            <Pressable
              style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
              onPress={() => setShowAddons(!showAddons)}
            >
              <View style={styles.rowLeft}>
                <Feather name="package" size={18} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.foreground }]}>Installed Addons</Text>
                  <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                    {movieCatalogCount} movie · {seriesCatalogCount} series · {streamCount} stream
                  </Text>
                </View>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>{addons.length}</Text>
                <Feather name={showAddons ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
              </View>
            </Pressable>
            {showAddons && (
              <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border, gap: 8 }]}>
                {addonSummary.length === 0 ? (
                  <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>No addons loaded.</Text>
                ) : (
                  addonSummary.map((a) => (
                    <View key={a.id} style={{ paddingVertical: 6, borderBottomColor: colors.border, borderBottomWidth: StyleSheet.hairlineWidth }}>
                      <Text style={[styles.rowLabel, { color: colors.foreground }]} numberOfLines={1}>{a.name}</Text>
                      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
                        {a.catalogTypes.map((t) => (
                          <View key={`cat-${t}`} style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.primary + "22" }}>
                            <Text style={{ fontSize: 10, color: colors.primary, fontFamily: "Inter_600SemiBold" }}>catalog:{t}</Text>
                          </View>
                        ))}
                        {a.hasMeta && (
                          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.muted }}>
                            <Text style={{ fontSize: 10, color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>meta</Text>
                          </View>
                        )}
                        {a.hasStream && (
                          <View style={{ paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6, backgroundColor: colors.muted }}>
                            <Text style={{ fontSize: 10, color: colors.foreground, fontFamily: "Inter_600SemiBold" }}>stream</Text>
                          </View>
                        )}
                      </View>
                    </View>
                  ))
                )}
                <Text style={[styles.rowSub, { color: colors.mutedForeground, marginTop: 4 }]}>
                  The home screen pulls catalogs from addons tagged with catalog:movie / catalog:series. If none are listed, only Cinemeta will appear.
                </Text>
              </View>
            )}
            <Pressable style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]} onPress={handleLogout}>
              <View style={styles.rowLeft}>
                <Feather name="log-out" size={18} color={colors.destructive} />
                <Text style={[styles.rowLabel, { color: colors.destructive }]}>Sign Out</Text>
              </View>
            </Pressable>
          </>
        ) : (
          <>
            <Pressable style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]} onPress={() => setShowLogin(!showLogin)}>
              <View style={styles.rowLeft}>
                <Feather name="log-in" size={18} color={colors.primary} />
                <Text style={[styles.rowLabel, { color: colors.foreground }]}>Sign In to Stremio</Text>
              </View>
              <Feather name={showLogin ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
            </Pressable>
            {showLogin && (
              <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} placeholder="Email" placeholderTextColor={colors.mutedForeground} value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" selectionColor={colors.primary} />
                <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} placeholder="Password" placeholderTextColor={colors.mutedForeground} value={password} onChangeText={setPassword} secureTextEntry selectionColor={colors.primary} />
                {loginError ? <Text style={[styles.error, { color: colors.destructive }]}>{loginError}</Text> : null}
                <Pressable style={({ pressed }) => [styles.formBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]} onPress={handleLogin} disabled={loggingIn}>
                  {loggingIn ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.formBtnText, { color: colors.primaryForeground }]}>Sign In</Text>}
                </Pressable>
              </View>
            )}
          </>
        )}

        <SectionHeader title="IPTV PLAYLIST" />
        <Pressable style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]} onPress={() => setShowIptv(!showIptv)}>
          <View style={styles.rowLeft}>
            <Feather name="tv" size={18} color={colors.primary} />
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>M3U Playlist URL</Text>
          </View>
          <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>
            {channels.length > 0 ? `${channels.length} ch` : "Not set"}
          </Text>
        </Pressable>
        {showIptv && (
          <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} placeholder="http://provider.com/playlist.m3u" placeholderTextColor={colors.mutedForeground} value={iptvInput} onChangeText={setIptvInput} autoCapitalize="none" keyboardType="url" selectionColor={colors.primary} multiline />
            <Pressable style={({ pressed }) => [styles.formBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]} onPress={handleSaveIptv} disabled={savingIptv}>
              {savingIptv ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.formBtnText, { color: colors.primaryForeground }]}>Load Playlist</Text>}
            </Pressable>
          </View>
        )}

        <SectionHeader title="EPG (TV GUIDE)" />
        <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowLeft}>
            <Feather name="calendar" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>EPG / TV Guide</Text>
              {epgUrl ? (
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]} numberOfLines={1}>
                  {epgData.size > 0 ? `${epgData.size} channels with guide` : epgUrl}
                </Text>
              ) : (
                <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                  Auto-detected from playlist or set manually
                </Text>
              )}
            </View>
          </View>
          <Pressable onPress={() => setShowEpg(!showEpg)}>
            <Feather name={showEpg ? "chevron-up" : "edit-2"} size={16} color={colors.mutedForeground} />
          </Pressable>
        </View>
        {epgUrl && (
          <Pressable style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]} onPress={refreshEpg}>
            <View style={styles.rowLeft}>
              <Feather name="refresh-cw" size={18} color={colors.primary} />
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>Refresh EPG</Text>
            </View>
            {epgLoading ? <ActivityIndicator color={colors.primary} size="small" /> : null}
          </Pressable>
        )}
        {showEpg && (
          <View style={[styles.form, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>XMLTV EPG URL (optional)</Text>
            <TextInput style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} placeholder="http://provider.com/epg.xml" placeholderTextColor={colors.mutedForeground} value={epgInput} onChangeText={setEpgInput} autoCapitalize="none" keyboardType="url" selectionColor={colors.primary} />
            <Pressable style={({ pressed }) => [styles.formBtn, { backgroundColor: colors.primary, opacity: pressed ? 0.8 : 1 }]} onPress={handleSaveEpg}>
              <Text style={[styles.formBtnText, { color: colors.primaryForeground }]}>Save & Load EPG</Text>
            </Pressable>
          </View>
        )}

        <SectionHeader title="DISPLAY" />
        <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowLeft}>
            <Feather name="monitor" size={18} color={colors.primary} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.rowLabel, { color: colors.foreground }]}>TV Mode</Text>
              <Text style={[styles.rowSub, { color: colors.mutedForeground }]}>
                Top nav bar, larger cards, D-pad focus. Auto-on for Android TV.
              </Text>
            </View>
          </View>
          <Switch
            value={isTvMode}
            onValueChange={setTvMode}
            trackColor={{ false: colors.muted, true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        <SectionHeader title="ABOUT" />
        <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={styles.rowLeft}>
            <Feather name="info" size={18} color={colors.primary} />
            <Text style={[styles.rowLabel, { color: colors.foreground }]}>StreamTV</Text>
          </View>
          <Text style={[styles.rowValue, { color: colors.mutedForeground }]}>v1.1.0</Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: 16, paddingBottom: 8 },
  heading: { fontSize: 26, fontFamily: "Inter_700Bold" },
  sectionHeader: { fontSize: 11, fontFamily: "Inter_600SemiBold", letterSpacing: 1.2, paddingHorizontal: 16, paddingTop: 24, paddingBottom: 8 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  rowLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  rowLabel: { fontSize: 15, fontFamily: "Inter_400Regular" },
  rowSub: { fontSize: 12, fontFamily: "Inter_400Regular", marginTop: 2 },
  rowValue: { fontSize: 13, fontFamily: "Inter_400Regular", maxWidth: 120, textAlign: "right" },
  form: { margin: 16, marginTop: 4, padding: 16, borderRadius: 12, borderWidth: 1, gap: 12 },
  formLabel: { fontSize: 13, fontFamily: "Inter_400Regular" },
  input: { borderWidth: 1, borderRadius: 8, padding: 12, fontSize: 14, fontFamily: "Inter_400Regular" },
  formBtn: { borderRadius: 8, paddingVertical: 12, alignItems: "center" },
  formBtnText: { fontSize: 15, fontFamily: "Inter_600SemiBold" },
  error: { fontSize: 13, fontFamily: "Inter_400Regular" },
  infoBox: { flexDirection: "row", gap: 10, marginHorizontal: 16, marginTop: 4, padding: 12, borderRadius: 10, alignItems: "flex-start" },
  infoText: { fontSize: 12, fontFamily: "Inter_400Regular", flex: 1, lineHeight: 17 },
});
