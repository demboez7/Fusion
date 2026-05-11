import { Feather } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useColors } from "@/hooks/useColors";

export default function PlayerScreen() {
  const { url, title } = useLocalSearchParams<{ url: string; title: string }>();
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const controlsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [showControls, setShowControls] = useState(true);
  const [isPlaying, setIsPlaying] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showSubtitles, setShowSubtitles] = useState(false);
  const [subtitleTracks, setSubtitleTracks] = useState<{ id: string; label: string; language: string }[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<string | null>(null);

  const player = useVideoPlayer(url ?? "", (p) => {
    p.play();
  });

  useEffect(() => {
    const sub = player.addListener("playingChange", (ev) => {
      setIsPlaying(ev.isPlaying);
    });
    const errSub = player.addListener("statusChange", (ev) => {
      if (ev.status === "error") {
        setError("Stream failed to load. This may require an external player.");
      }
    });
    const trackSub = player.addListener("availableSubtitleTracksChange" as never, (ev: unknown) => {
      if (ev && typeof ev === "object" && "availableSubtitleTracks" in ev) {
        const tracks = (ev as { availableSubtitleTracks: { id: string; label: string; language: string }[] })
          .availableSubtitleTracks;
        setSubtitleTracks(tracks ?? []);
      }
    });
    return () => {
      sub.remove();
      errSub.remove();
      trackSub.remove();
    };
  }, [player]);

  const hideControlsAfterDelay = () => {
    if (controlsTimer.current) clearTimeout(controlsTimer.current);
    controlsTimer.current = setTimeout(() => {
      Animated.timing(controlsOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setShowControls(false);
      });
    }, 3500);
  };

  const showControlsNow = () => {
    setShowControls(true);
    Animated.timing(controlsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    hideControlsAfterDelay();
  };

  useEffect(() => {
    hideControlsAfterDelay();
    return () => { if (controlsTimer.current) clearTimeout(controlsTimer.current); };
  }, []);

  const togglePlay = () => {
    if (player.playing) player.pause();
    else player.play();
    showControlsNow();
  };

  const selectSubtitle = (id: string | null) => {
    try {
      if (id === null) {
        (player as unknown as { selectedSubtitleTrack: null }).selectedSubtitleTrack = null;
      } else {
        (player as unknown as { selectedSubtitleTrack: string }).selectedSubtitleTrack = id;
      }
      setSelectedSubtitle(id);
    } catch {}
    setShowSubtitles(false);
  };

  if (!url) {
    return (
      <View style={[styles.container, { backgroundColor: "#000" }]}>
        <View style={styles.overlay}>
          <Feather name="alert-circle" size={40} color={colors.destructive} />
          <Text style={styles.errorText}>No stream URL provided</Text>
          <Pressable style={[styles.retryBtn, { backgroundColor: colors.primary }]} onPress={() => router.back()}>
            <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Go Back</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: "#000" }]}>
      <Pressable style={styles.videoWrapper} onPress={showControlsNow}>
        <VideoView
          player={player}
          style={styles.video}
          contentFit="contain"
          nativeControls={false}
          allowsFullscreen
          allowsPictureInPicture
        />

        {error && (
          <View style={styles.overlay}>
            <Feather name="alert-circle" size={40} color={colors.destructive} />
            <Text style={styles.errorText}>{error}</Text>
            <Text style={styles.errorHint}>
              Try opening in VLC or another media player for HLS/MPEG-TS streams.
            </Text>
            <Pressable
              style={[styles.retryBtn, { backgroundColor: colors.primary }]}
              onPress={() => { setError(null); player.play(); }}
            >
              <Text style={[styles.retryText, { color: colors.primaryForeground }]}>Retry</Text>
            </Pressable>
          </View>
        )}

        {showControls && (
          <Animated.View style={[styles.controls, { opacity: controlsOpacity }]}>
            <View style={[styles.topBar, { paddingTop: insets.top + 8 }]}>
              <Pressable
                style={[styles.iconBtn, { backgroundColor: "rgba(0,0,0,0.5)" }]}
                onPress={() => router.back()}
              >
                <Feather name="arrow-left" size={22} color="#fff" />
              </Pressable>
              <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
              <Pressable
                style={[
                  styles.iconBtn,
                  { backgroundColor: selectedSubtitle ? "rgba(30,200,180,0.7)" : "rgba(0,0,0,0.5)" },
                ]}
                onPress={() => { setShowSubtitles(true); showControlsNow(); }}
              >
                <Feather name="message-square" size={20} color="#fff" />
              </Pressable>
            </View>

            <View style={styles.centerControls}>
              <Pressable
                style={[styles.controlBtn, { backgroundColor: "rgba(0,0,0,0.5)" }]}
                onPress={() => { player.seekBy(-10); showControlsNow(); }}
              >
                <Feather name="rotate-ccw" size={24} color="#fff" />
                <Text style={styles.seekLabel}>10</Text>
              </Pressable>

              <Pressable
                style={[styles.playBtn, { backgroundColor: "rgba(255,255,255,0.15)" }]}
                onPress={togglePlay}
              >
                <Feather name={isPlaying ? "pause" : "play"} size={34} color="#fff" />
              </Pressable>

              <Pressable
                style={[styles.controlBtn, { backgroundColor: "rgba(0,0,0,0.5)" }]}
                onPress={() => { player.seekBy(10); showControlsNow(); }}
              >
                <Feather name="rotate-cw" size={24} color="#fff" />
                <Text style={styles.seekLabel}>10</Text>
              </Pressable>
            </View>

            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
              <View style={{ height: 24 }} />
            </View>
          </Animated.View>
        )}
      </Pressable>

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
            {subtitleTracks.length === 0 && (
              <Text style={[styles.noSubText, { color: colors.mutedForeground }]}>
                No subtitle tracks found in this stream.{"\n"}Some streams include embedded subtitles — try a different stream source.
              </Text>
            )}
            {subtitleTracks.map((track) => (
              <Pressable
                key={track.id}
                style={[styles.subtitleRow, selectedSubtitle === track.id && { backgroundColor: colors.surface }]}
                onPress={() => selectSubtitle(track.id)}
              >
                <Feather name={selectedSubtitle === track.id ? "check-circle" : "circle"} size={18} color={selectedSubtitle === track.id ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.subtitleLabel, { color: colors.foreground }]}>
                  {track.label || track.language}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  videoWrapper: { flex: 1, justifyContent: "center" },
  video: { width: "100%", height: Platform.OS === "web" ? 400 : "100%" },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.6)",
    gap: 16,
    paddingHorizontal: 32,
  },
  errorText: { color: "#fff", fontSize: 15, textAlign: "center", fontFamily: "Inter_500Medium" },
  errorHint: { color: "rgba(255,255,255,0.6)", fontSize: 12, textAlign: "center", fontFamily: "Inter_400Regular" },
  retryBtn: { paddingHorizontal: 24, paddingVertical: 10, borderRadius: 8, marginTop: 8 },
  retryText: { fontSize: 14, fontFamily: "Inter_600SemiBold" },
  controls: { ...StyleSheet.absoluteFillObject, justifyContent: "space-between" },
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  iconBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  titleText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "center", marginHorizontal: 8 },
  centerControls: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 32 },
  controlBtn: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center" },
  seekLabel: { position: "absolute", bottom: 6, fontSize: 9, color: "#fff", fontFamily: "Inter_700Bold" },
  playBtn: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  bottomBar: { paddingHorizontal: 16 },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)" },
  subtitleSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 12,
    paddingHorizontal: 20,
    maxHeight: "60%",
  },
  sheetHandle: { width: 40, height: 4, borderRadius: 2, backgroundColor: "#555", alignSelf: "center", marginBottom: 16 },
  sheetTitle: { fontSize: 17, fontFamily: "Inter_700Bold", marginBottom: 12 },
  subtitleRow: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 14, paddingHorizontal: 8, borderRadius: 8 },
  subtitleLabel: { fontSize: 15, fontFamily: "Inter_500Medium" },
  noSubText: { fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 20, paddingVertical: 16, textAlign: "center" },
});
