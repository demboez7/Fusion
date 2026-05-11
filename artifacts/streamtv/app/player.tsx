import { Feather } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useStremio } from "@/contexts/StremioContext";
import { useColors } from "@/hooks/useColors";
import { StremioSubtitle } from "@/services/stremio";

interface SubtitleOption {
  id: string;
  label: string;
  language: string;
  external?: boolean;
  url?: string;
}

export default function PlayerScreen() {
  const { url, title, type, subtitleId } = useLocalSearchParams<{
    url: string;
    title: string;
    type?: string;
    subtitleId?: string;
  }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { getSubtitles, subtitleAddonsCount } = useStremio();

  const [error, setError] = useState<string | null>(null);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [embeddedTracks, setEmbeddedTracks] = useState<SubtitleOption[]>([]);
  const [addonTracks, setAddonTracks] = useState<SubtitleOption[]>([]);
  const [loadingAddonSubs, setLoadingAddonSubs] = useState(false);
  const [addonSubsLoaded, setAddonSubsLoaded] = useState(false);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null);

  const player = useVideoPlayer(url ?? "", (p) => {
    p.play();
  });

  useEffect(() => {
    const errSub = player.addListener("statusChange", (ev) => {
      if (ev.status === "error") {
        setError("Stream failed to load. The codec or container may not be supported by Expo Go.");
      }
    });
    const trackSub = player.addListener("availableSubtitleTracksChange" as never, (ev: unknown) => {
      if (ev && typeof ev === "object" && "availableSubtitleTracks" in ev) {
        const tracks = (ev as { availableSubtitleTracks: { id: string; label: string; language: string }[] })
          .availableSubtitleTracks;
        setEmbeddedTracks(
          (tracks ?? []).map((t) => ({ id: t.id, label: t.label, language: t.language, external: false }))
        );
      }
    });
    return () => {
      errSub.remove();
      trackSub.remove();
    };
  }, [player]);

  const loadAddonSubtitles = async () => {
    if (addonSubsLoaded || loadingAddonSubs) return;
    if (!type || !subtitleId) {
      setAddonSubsLoaded(true);
      return;
    }
    setLoadingAddonSubs(true);
    try {
      const subs: StremioSubtitle[] = await getSubtitles(type, subtitleId);
      setAddonTracks(
        subs.map((s) => ({
          id: `addon::${s.id}`,
          label: s.lang || s.id,
          language: s.lang || "",
          external: true,
          url: s.url,
        }))
      );
    } catch {
      // ignore — empty list
    } finally {
      setLoadingAddonSubs(false);
      setAddonSubsLoaded(true);
    }
  };

  const openSubtitleSheet = () => {
    setShowSubtitles(true);
    loadAddonSubtitles();
  };

  const selectSubtitle = (option: SubtitleOption | null) => {
    if (option === null) {
      try {
        (player as unknown as { selectedSubtitleTrack: null }).selectedSubtitleTrack = null;
      } catch {}
      setSelectedSubtitle(null);
      setShowSubtitles(false);
      return;
    }
    if (option.external && option.url) {
      // expo-video can't attach external SRT/VTT tracks at runtime in Expo Go.
      // Offer to open the .srt file in the user's preferred app instead.
      Linking.openURL(option.url).catch(() => {});
      setSelectedSubtitle(option.id);
      setShowSubtitles(false);
      return;
    }
    try {
      (player as unknown as { selectedSubtitleTrack: string }).selectedSubtitleTrack = option.id;
      setSelectedSubtitle(option.id);
    } catch {}
    setShowSubtitles(false);
  };

  if (!url) {
    return (
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        <View style={styles.centerOverlay}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={styles.errorText}>No stream URL provided</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  const allTracks: SubtitleOption[] = [...embeddedTracks, ...addonTracks];

  const openExternal = () => {
    if (url) Linking.openURL(url).catch(() => {});
  };

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <VideoView
        player={player}
        style={styles.video}
        contentFit="contain"
        nativeControls
        fullscreenOptions={{ enable: true }}
        allowsPictureInPicture
      />

      {/* Always-visible top overlay with back + CC. Sits along the very top edge so
          it never overlaps the native scrub bar (which is at the bottom). */}
      <View style={[styles.topBar, { paddingTop: insets.top + 6 }]} pointerEvents="box-none">
        <Pressable
          style={[styles.iconBtn, { backgroundColor: "rgba(0,0,0,0.55)" }]}
          onPress={() => router.back()}
          hitSlop={8}
        >
          <Feather name="arrow-left" size={22} color="#fff" />
        </Pressable>
        <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
        <Pressable
          style={[
            styles.iconBtn,
            { backgroundColor: selectedSubtitle ? "rgba(30,200,180,0.75)" : "rgba(0,0,0,0.55)" },
          ]}
          onPress={openSubtitleSheet}
          hitSlop={8}
        >
          <Feather name="message-square" size={20} color="#fff" />
        </Pressable>
      </View>

      {error && (
        <View style={styles.centerOverlay}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.errorHint}>
            For broader codec support (MKV, AVI, custom HLS, etc.) you can open this stream
            in VLC or another media player on your device.
          </Text>
          <Pressable
            style={[styles.retryBtn, { backgroundColor: colors.primary }]}
            onPress={() => { setError(null); player.play(); }}
          >
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
          </Pressable>
          <Pressable
            style={[styles.retryBtn, { backgroundColor: "transparent", borderWidth: 1, borderColor: colors.primary }]}
            onPress={openExternal}
          >
            <Text style={[styles.retryText, { color: colors.primary }]}>Open in another app</Text>
          </Pressable>
        </View>
      )}

      <Modal
        visible={showSubtitles}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSubtitles(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setShowSubtitles(false)} />
        <View style={[styles.subtitleSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 16 }]}>
          <View style={styles.sheetHandle} />
          <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Subtitles</Text>
          <ScrollView>
            <Pressable
              style={[styles.subtitleRow, selectedSubtitle === null && { backgroundColor: colors.surface }]}
              onPress={() => selectSubtitle(null)}
            >
              <Feather name={selectedSubtitle === null ? "check-circle" : "circle"} size={18} color={selectedSubtitle === null ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.subtitleLabel, { color: colors.foreground }]}>Off</Text>
            </Pressable>

            {embeddedTracks.length > 0 && (
              <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>Embedded in stream</Text>
            )}
            {embeddedTracks.map((track) => (
              <Pressable
                key={track.id}
                style={[styles.subtitleRow, selectedSubtitle === track.id && { backgroundColor: colors.surface }]}
                onPress={() => selectSubtitle(track)}
              >
                <Feather name={selectedSubtitle === track.id ? "check-circle" : "circle"} size={18} color={selectedSubtitle === track.id ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.subtitleLabel, { color: colors.foreground }]}>
                  {track.label || track.language}
                </Text>
              </Pressable>
            ))}

            <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>
              From your subtitle addons {subtitleAddonsCount > 0 ? `(${subtitleAddonsCount} installed)` : ""}
            </Text>
            {subtitleAddonsCount === 0 && (
              <Text style={[styles.noSubText, { color: colors.mutedForeground }]}>
                You don&apos;t have any subtitle addons installed in your Stremio account. Install one
                (e.g. OpenSubtitles, OpenSubtitles v3, Subscene) from web.stremio.com → Addons → Subtitles, then re-login here.
              </Text>
            )}
            {loadingAddonSubs && (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} size="small" />
                <Text style={[styles.subtitleLabel, { color: colors.mutedForeground }]}>Loading…</Text>
              </View>
            )}
            {!loadingAddonSubs && addonSubsLoaded && addonTracks.length === 0 && (
              <Text style={[styles.noSubText, { color: colors.mutedForeground }]}>
                No subtitles found from your installed addons for this title.
              </Text>
            )}
            {addonTracks.map((track) => (
              <Pressable
                key={track.id}
                style={[styles.subtitleRow, selectedSubtitle === track.id && { backgroundColor: colors.surface }]}
                onPress={() => selectSubtitle(track)}
              >
                <Feather name="external-link" size={18} color={colors.mutedForeground} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.subtitleLabel, { color: colors.foreground }]}>
                    {track.label || track.language}
                  </Text>
                  <Text style={[styles.subtitleHint, { color: colors.mutedForeground }]}>
                    Opens externally — Expo Go can't load .srt files into the player
                  </Text>
                </View>
              </Pressable>
            ))}

            {allTracks.length === 0 && embeddedTracks.length === 0 && !loadingAddonSubs && addonSubsLoaded && (
              <Text style={[styles.noSubText, { color: colors.mutedForeground }]}>
                No embedded subtitle tracks in this stream.
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  video: { width: "100%", height: Platform.OS === "web" ? 400 : "100%", flex: Platform.OS === "web" ? undefined : 1 },
  centerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.75)",
    gap: 16,
    paddingHorizontal: 32,
  },
  errorText: { color: "#fff", fontSize: 15, textAlign: "center", fontFamily: "Inter_500Medium" },
  errorHint: { color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center", fontFamily: "Inter_400Regular" },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: 4 },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    paddingBottom: 10,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  iconBtn: { width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  titleText: { color: "#fff", fontSize: 14, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "center", marginHorizontal: 8 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  subtitleSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: "70%",
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#555", alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 12 },
  sectionLabel: { fontSize: 11, fontFamily: "Inter_600SemiBold", textTransform: "uppercase", marginTop: 16, marginBottom: 6, letterSpacing: 0.5 },
  subtitleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 12, paddingHorizontal: 8, borderRadius: 8 },
  subtitleLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  subtitleHint: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 8 },
  noSubText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, paddingVertical: 12, paddingHorizontal: 8 },
});
