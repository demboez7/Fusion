import { Feather } from "@expo/vector-icons";
import { useVideoPlayer, VideoView } from "expo-video";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  Platform,
  Pressable,
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

  const player = useVideoPlayer(url ?? "", (p) => {
    p.play();
  });

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
    return () => {
      if (controlsTimer.current) clearTimeout(controlsTimer.current);
    };
  }, []);

  useEffect(() => {
    const subscription = player.addListener("playingChange", (ev) => {
      setIsPlaying(ev.isPlaying);
    });
    const errSub = player.addListener("statusChange", (ev) => {
      if (ev.status === "error") {
        setError("Stream failed to load. This may require an external player.");
      }
    });
    return () => {
      subscription.remove();
      errSub.remove();
    };
  }, [player]);

  const togglePlay = () => {
    if (player.playing) {
      player.pause();
    } else {
      player.play();
    }
    showControlsNow();
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
                style={[styles.backBtn, { backgroundColor: "rgba(0,0,0,0.5)" }]}
                onPress={() => router.back()}
              >
                <Feather name="arrow-left" size={22} color="#fff" />
              </Pressable>
              <Text style={styles.titleText} numberOfLines={1}>{title}</Text>
              <View style={{ width: 44 }} />
            </View>

            <View style={styles.centerControls}>
              <Pressable
                style={[styles.controlBtn, { backgroundColor: "rgba(0,0,0,0.5)" }]}
                onPress={() => { player.seekBy(-10); showControlsNow(); }}
              >
                <Feather name="rotate-ccw" size={24} color="#fff" />
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
              </Pressable>
            </View>

            <View style={[styles.bottomBar, { paddingBottom: insets.bottom + 16 }]}>
              <View style={{ height: 24 }} />
            </View>
          </Animated.View>
        )}
      </Pressable>
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
    backgroundColor: "transparent",
  },
  backBtn: { width: 44, height: 44, borderRadius: 22, justifyContent: "center", alignItems: "center" },
  titleText: { color: "#fff", fontSize: 16, fontFamily: "Inter_600SemiBold", flex: 1, textAlign: "center" },
  centerControls: { flexDirection: "row", justifyContent: "center", alignItems: "center", gap: 32 },
  controlBtn: { width: 52, height: 52, borderRadius: 26, justifyContent: "center", alignItems: "center" },
  playBtn: { width: 72, height: 72, borderRadius: 36, justifyContent: "center", alignItems: "center" },
  bottomBar: { paddingHorizontal: 16, gap: 8 },
});
