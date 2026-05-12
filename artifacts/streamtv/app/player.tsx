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
import { fetchSubtitleCues, findActiveCue, SubtitleCue } from "@/services/subtitles";

interface SubtitleOption {
  id: string;
  label: string;
  language: string;
  external?: boolean;
  url?: string;
}

const LANG_CODE_NAMES: Record<string, string> = {
  en: "English", eng: "English",
  he: "Hebrew", heb: "Hebrew", iw: "Hebrew",
  ar: "Arabic", ara: "Arabic",
  ru: "Russian", rus: "Russian",
  es: "Spanish", spa: "Spanish",
  fr: "French", fre: "French", fra: "French",
  de: "German", ger: "German", deu: "German",
  it: "Italian", ita: "Italian",
  pt: "Portuguese", por: "Portuguese",
  tr: "Turkish", tur: "Turkish",
  pl: "Polish", pol: "Polish",
  nl: "Dutch", dut: "Dutch", nld: "Dutch",
  ro: "Romanian", rum: "Romanian", ron: "Romanian",
  cs: "Czech", cze: "Czech", ces: "Czech",
  el: "Greek", gre: "Greek", ell: "Greek",
  zh: "Chinese", chi: "Chinese", zho: "Chinese",
  ja: "Japanese", jpn: "Japanese",
  ko: "Korean", kor: "Korean",
  hi: "Hindi", hin: "Hindi",
  uk: "Ukrainian", ukr: "Ukrainian",
  bg: "Bulgarian", bul: "Bulgarian",
  sr: "Serbian", srp: "Serbian",
  hr: "Croatian", hrv: "Croatian",
  sv: "Swedish", swe: "Swedish",
  no: "Norwegian", nor: "Norwegian",
  fi: "Finnish", fin: "Finnish",
  da: "Danish", dan: "Danish",
  hu: "Hungarian", hun: "Hungarian",
  fa: "Persian", per: "Persian", fas: "Persian",
  th: "Thai", tha: "Thai",
  vi: "Vietnamese", vie: "Vietnamese",
  id: "Indonesian", ind: "Indonesian",
};

function prettyLangName(raw: string | undefined): string {
  if (!raw) return "Unknown";
  const trimmed = raw.trim().toLowerCase();
  if (LANG_CODE_NAMES[trimmed]) return LANG_CODE_NAMES[trimmed];
  // First-letter uppercase the original (preserves "Machine", "Forced", etc).
  const orig = raw.trim();
  return orig.charAt(0).toUpperCase() + orig.slice(1);
}

function looksGenericLang(raw: string): boolean {
  const t = raw.trim().toLowerCase();
  return t === "" || t === "machine" || t === "auto" || t === "unknown" || t === "und" || t === "xx";
}

function extractFilenameHint(url: string): string | null {
  try {
    // RN's URL parser can be flaky on some addon URLs — manual extraction is
    // safer. Strip query/hash, take last path segment, drop common subtitle
    // extensions.
    const noQuery = url.split("#")[0].split("?")[0];
    let last = decodeURIComponent(noQuery.split("/").filter(Boolean).pop() ?? "");
    last = last.replace(/\.(srt|vtt|ass|ssa|sub|smi)(\.gz|\.zip)?$/i, "");
    if (!last) return null;

    // Detect a language code embedded in the filename ("...heb.srt", "[en]…").
    for (const code of Object.keys(LANG_CODE_NAMES)) {
      const re = new RegExp(`(^|[._\\-\\[\\]\\s\\(\\)])${code}([._\\-\\[\\]\\s\\(\\)]|$)`, "i");
      if (re.test(last)) return LANG_CODE_NAMES[code];
    }

    // Otherwise return a short, readable token sequence from the filename.
    const tokens = last
      .split(/[._\-\[\]\s\(\)]+/)
      .filter(
        (t) =>
          t.length > 1 &&
          !/^\d+$/.test(t) &&
          !/^(720p|1080p|2160p|4k|x264|x265|hevc|aac|ac3|web|webrip|bluray|brrip|dvdrip|hdtv|dj|sub|subs|subtitle|subtitles)$/i.test(
            t
          )
      )
      .slice(0, 4);
    const hint = tokens.join(" ").trim();
    if (hint.length > 0) return hint.slice(0, 30);
    // Final fallback: just the raw filename truncated.
    return last.slice(0, 30);
  } catch {
    return null;
  }
}

function buildAddonSubtitleOptions(subs: StremioSubtitle[]): SubtitleOption[] {
  // Strategy: prefer an explicit name/title from the addon; otherwise build
  // a label from (resolved language) + (URL filename hint) + (addon name).
  // Always include the addon name when the addon's lang field is generic
  // (e.g. "Machine") so 12 entries from one addon don't collapse to "Machine".
  const out: SubtitleOption[] = subs.map((s, i) => {
    const explicit = s.name?.trim() || s.title?.trim();
    const langRaw = s.lang ?? "";
    const generic = looksGenericLang(langRaw);
    const hint = extractFilenameHint(s.url);
    // If lang looks generic, try the URL-derived language first.
    const langPretty = generic && hint && LANG_CODE_NAMES_VALUES.has(hint) ? hint : prettyLangName(langRaw);
    const addonTag = s.addonName ? ` · ${s.addonName}` : "";

    let label: string;
    if (explicit) {
      label = `${explicit}${addonTag}`;
    } else if (hint && hint !== langPretty) {
      label = `${langPretty} · ${hint}${addonTag}`;
    } else {
      // No useful filename info — at least show addon name + index so the
      // user can tell entries apart.
      label = `${langPretty}${addonTag}`;
    }

    return {
      id: `addon::${i}::${s.id}`,
      label,
      language: langPretty,
      external: true,
      url: s.url,
    };
  });

  // Dedupe identical labels by appending an index.
  const labelCounts = new Map<string, number>();
  for (const opt of out) {
    labelCounts.set(opt.label, (labelCounts.get(opt.label) ?? 0) + 1);
  }
  const seen = new Map<string, number>();
  return out.map((opt) => {
    const total = labelCounts.get(opt.label) ?? 1;
    if (total === 1) return opt;
    const idx = (seen.get(opt.label) ?? 0) + 1;
    seen.set(opt.label, idx);
    return { ...opt, label: `${opt.label} (#${idx})` };
  });
}

const LANG_CODE_NAMES_VALUES = new Set(Object.values(LANG_CODE_NAMES));

// Sort by language so all Hebrew options group together, English together, etc.
function sortSubtitles(options: SubtitleOption[]): SubtitleOption[] {
  return [...options].sort((a, b) => a.language.localeCompare(b.language) || a.label.localeCompare(b.label));
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
  const [externalCues, setExternalCues] = useState<SubtitleCue[] | null>(null);
  const [activeCueText, setActiveCueText] = useState<string | null>(null);
  const [loadingExternalSub, setLoadingExternalSub] = useState(false);
  const [externalSubError, setExternalSubError] = useState<string | null>(null);
  const cuesRef = useRef<SubtitleCue[] | null>(null);

  const player = useVideoPlayer(url ?? "", (p) => {
    p.play();
    p.timeUpdateEventInterval = 0.25;
  });

  useEffect(() => {
    const errSub = player.addListener("statusChange", (ev) => {
      if (ev.status === "error") {
        setError("Stream failed to load. The codec or container may not be supported.");
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
    const timeSub = player.addListener("timeUpdate", (ev) => {
      const cues = cuesRef.current;
      if (!cues || cues.length === 0) return;
      const cue = findActiveCue(cues, ev.currentTime);
      setActiveCueText((prev) => {
        const next = cue ? cue.text : null;
        return prev === next ? prev : next;
      });
    });
    return () => {
      errSub.remove();
      trackSub.remove();
      timeSub.remove();
    };
  }, [player]);

  useEffect(() => {
    cuesRef.current = externalCues;
    if (!externalCues) setActiveCueText(null);
  }, [externalCues]);

  const loadAddonSubtitles = async () => {
    if (addonSubsLoaded || loadingAddonSubs) return;
    if (!type || !subtitleId) {
      setAddonSubsLoaded(true);
      return;
    }
    setLoadingAddonSubs(true);
    try {
      const subs: StremioSubtitle[] = await getSubtitles(type, subtitleId);
      setAddonTracks(sortSubtitles(buildAddonSubtitleOptions(subs)));
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

  const selectSubtitle = async (option: SubtitleOption | null) => {
    setExternalSubError(null);
    if (option === null) {
      try {
        (player as unknown as { subtitleTrack: null }).subtitleTrack = null;
      } catch {}
      setExternalCues(null);
      setSelectedSubtitle(null);
      setShowSubtitles(false);
      return;
    }
    if (option.external && option.url) {
      setLoadingExternalSub(true);
      setSelectedSubtitle(option.id);
      try {
        const cues = await fetchSubtitleCues(option.url);
        setExternalCues(cues);
        try {
          (player as unknown as { subtitleTrack: null }).subtitleTrack = null;
        } catch {}
        setShowSubtitles(false);
      } catch (e) {
        setExternalCues(null);
        setSelectedSubtitle(null);
        setExternalSubError(e instanceof Error ? e.message : String(e));
      } finally {
        setLoadingExternalSub(false);
      }
      return;
    }
    try {
      (player as unknown as { subtitleTrack: { id: string } }).subtitleTrack = { id: option.id } as unknown as { id: string };
    } catch {}
    setExternalCues(null);
    setSelectedSubtitle(option.id);
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

      {activeCueText && (
        <View style={styles.subtitleOverlay} pointerEvents="none">
          <Text style={styles.subtitleOverlayText}>{activeCueText}</Text>
        </View>
      )}

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
            {externalSubError && (
              <Text style={[styles.noSubText, { color: colors.destructive }]}>
                Couldn&apos;t load subtitle: {externalSubError}
              </Text>
            )}
            {addonTracks.map((track) => {
              const isSelected = selectedSubtitle === track.id;
              return (
                <Pressable
                  key={track.id}
                  style={[styles.subtitleRow, isSelected && { backgroundColor: colors.surface }]}
                  onPress={() => selectSubtitle(track)}
                  disabled={loadingExternalSub}
                >
                  <Feather
                    name={isSelected ? "check-circle" : "circle"}
                    size={18}
                    color={isSelected ? colors.primary : colors.mutedForeground}
                  />
                  <Text style={[styles.subtitleLabel, { color: colors.foreground, flex: 1 }]}>
                    {track.label || track.language}
                  </Text>
                  {isSelected && loadingExternalSub && (
                    <ActivityIndicator color={colors.primary} size="small" />
                  )}
                </Pressable>
              );
            })}

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
  subtitleOverlay: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 80,
    alignItems: "center",
    pointerEvents: "none",
  },
  subtitleOverlayText: {
    color: "#fff",
    fontSize: 18,
    fontFamily: "Inter_600SemiBold",
    textAlign: "center",
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
    overflow: "hidden",
    textShadowColor: "rgba(0,0,0,0.9)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
});
