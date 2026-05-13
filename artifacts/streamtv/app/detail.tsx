import { Feather } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useSettings } from "@/contexts/SettingsContext";
import { useStremio } from "@/contexts/StremioContext";
import { useColors } from "@/hooks/useColors";
import { AddonStreamProgress, StremioMeta, StremioStream, StremioVideo } from "@/services/stremio";
import {
  TmdbEpisode,
  findTmdbIdFromImdb,
  getTmdbSeason,
  getTmdbShow,
  tmdbPoster,
} from "@/services/tmdb";

interface AddonStatus {
  addonId: string;
  addonName: string;
  status: "loading" | "done" | "error" | "timeout";
  count: number;
  durationMs: number;
  httpStatus?: number;
  errorMessage?: string;
  transportUrl?: string;
  requestUrls?: string[];
  responseSnippet?: string;
}

interface SeasonEpisode {
  id: string;
  season: number;
  episode: number;
  title: string;
  thumbnail?: string;
  overview?: string;
  runtime?: number | null;
  airDate?: string | null;
}

function groupVideosBySeasonFromMeta(videos: StremioVideo[]): Map<number, SeasonEpisode[]> {
  const map = new Map<number, SeasonEpisode[]>();
  for (const v of videos) {
    const s = v.season ?? 0;
    if (s <= 0) continue;
    if (!map.has(s)) map.set(s, []);
    map.get(s)!.push({
      id: v.id,
      season: s,
      episode: v.episode ?? 0,
      title: v.title ?? v.name ?? `Episode ${v.episode ?? "?"}`,
      thumbnail: v.thumbnail,
      overview: v.overview,
      runtime: null,
      airDate: v.released ?? null,
    });
  }
  for (const eps of map.values()) {
    eps.sort((a, b) => a.episode - b.episode);
  }
  return map;
}

function mergeTmdbIntoEpisodes(
  episodes: SeasonEpisode[],
  tmdbEps: TmdbEpisode[]
): SeasonEpisode[] {
  const tmdbMap = new Map(tmdbEps.map((e) => [e.episode_number, e]));
  return episodes.map((ep) => {
    const t = tmdbMap.get(ep.episode);
    if (!t) return ep;
    return {
      ...ep,
      title: t.name || ep.title,
      thumbnail: t.still_path ? tmdbPoster(t.still_path, "w185") : ep.thumbnail,
      overview: t.overview || ep.overview,
      runtime: t.runtime,
      airDate: t.air_date,
    };
  });
}

export default function DetailScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { getDetail, getStreamsProgressive, addons, isLoggedIn } = useStremio();
  const { useTmdb } = useSettings();

  const streamAddons = addons.filter((a) => {
    const res = a.manifest?.resources ?? [];
    return res.some((r: unknown) => {
      if (typeof r === "string") return r === "stream";
      if (typeof r === "object" && r !== null && "name" in r) return (r as { name: string }).name === "stream";
      return false;
    }) && (a.manifest?.types ?? []).includes(type ?? "");
  });
  const metaAddons = addons.filter((a) => {
    const res = a.manifest?.resources ?? [];
    return res.some((r: unknown) => {
      if (typeof r === "string") return r === "meta";
      if (typeof r === "object" && r !== null && "name" in r) return (r as { name: string }).name === "meta";
      return false;
    }) && (a.manifest?.types ?? []).includes(type ?? "");
  });
  const catalogAddons = addons.filter((a) =>
    (a.manifest?.catalogs ?? []).some((c) => c.type === (type ?? ""))
  );

  const [meta, setMeta] = useState<StremioMeta | null>(null);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  const [seasonMap, setSeasonMap] = useState<Map<number, SeasonEpisode[]>>(new Map());
  const [seasonNumbers, setSeasonNumbers] = useState<number[]>([]);
  const [selectedSeason, setSelectedSeason] = useState<number>(1);
  const [tmdbId, setTmdbId] = useState<number | null>(null);
  const [loadingTmdb, setLoadingTmdb] = useState(false);

  const [streams, setStreams] = useState<StremioStream[]>([]);
  const [loadingStreams, setLoadingStreams] = useState(false);
  const [streamsLoaded, setStreamsLoaded] = useState(false);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [activeEpisode, setActiveEpisode] = useState<SeasonEpisode | null>(null);
  const [addonStatuses, setAddonStatuses] = useState<AddonStatus[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const bgImage = meta?.background ?? meta?.poster;

  useEffect(() => {
    if (!type || !id) return;
    setLoadingMeta(true);
    setMetaError(null);
    getDetail(type, id)
      .then((m) => {
        setMeta(m);
        if (m && type === "series" && m.videos && m.videos.length > 0) {
          const grouped = groupVideosBySeasonFromMeta(m.videos);
          setSeasonMap(grouped);
          const nums = Array.from(grouped.keys()).sort((a, b) => a - b);
          setSeasonNumbers(nums);
          setSelectedSeason(nums[0] ?? 1);

          if (useTmdb && id.startsWith("tt")) {
            const imdbId = id.split(":")[0];
            setLoadingTmdb(true);
            findTmdbIdFromImdb(imdbId)
              .then((tid) => {
                if (tid) {
                  setTmdbId(tid);
                  return getTmdbShow(tid).then((show) => {
                    const filtered = show?.seasons?.filter((s) => s.season_number > 0) ?? [];
                    if (filtered.length > 0) {
                      const firstSeason = nums[0] ?? 1;
                      return getTmdbSeason(tid, firstSeason).then((season) => {
                        if (season?.episodes) {
                          setSeasonMap((prev) => {
                            const next = new Map(prev);
                            const existing = next.get(firstSeason) ?? [];
                            next.set(firstSeason, mergeTmdbIntoEpisodes(existing, season.episodes));
                            return next;
                          });
                        }
                      });
                    }
                  });
                }
              })
              .catch(() => {})
              .finally(() => setLoadingTmdb(false));
          }
        }
      })
      .catch(() => setMetaError("Failed to load details"))
      .finally(() => setLoadingMeta(false));
  }, [type, id, useTmdb]);

  useEffect(() => {
    if (!tmdbId || !useTmdb || selectedSeason === 0) return;
    getTmdbSeason(tmdbId, selectedSeason)
      .then((season) => {
        if (season?.episodes) {
          setSeasonMap((prev) => {
            const next = new Map(prev);
            const existing = next.get(selectedSeason) ?? [];
            next.set(selectedSeason, mergeTmdbIntoEpisodes(existing, season.episodes));
            return next;
          });
        }
      })
      .catch(() => {});
  }, [tmdbId, selectedSeason, useTmdb]);

  const loadStreams = async (streamId?: string) => {
    const rawSid = streamId ?? id;
    if (!type || !rawSid || loadingStreams) return;
    // Some catalogs (e.g. TMDB-Cinemeta variants) hand us movie ids of the
    // form "tt12345:67890:67890" where 67890 is the TMDB id repeated. Real
    // Stremio movie ids are just "tt12345"; for series episodes they're
    // "tt12345:S:E" with small season/episode numbers. Strip any trailing
    // junk so strict addons (Sootio, Peerflix) don't reject the request.
    let sid = rawSid;
    if (rawSid.startsWith("tt")) {
      const parts = rawSid.split(":");
      if (type === "movie") {
        sid = parts[0];
      } else if (type === "series" && parts.length >= 3) {
        const s = parts[parts.length - 2];
        const e = parts[parts.length - 1];
        sid = /^\d{1,4}$/.test(s) && /^\d{1,4}$/.test(e) ? `${parts[0]}:${s}:${e}` : parts[0];
      }
    }
    // Derive an IMDB id to also try against debrid addons that only key
    // on tt… ids (Torrentio/Comet/Jackettio/etc.). Prefer meta.imdb_id;
    // fall back to the route id itself if it's already tt-prefixed.
    const routeIdHead = (id ?? "").split(":")[0];
    const baseImdb =
      meta?.imdb_id ??
      (routeIdHead.startsWith("tt") ? routeIdHead : undefined);
    let imdbForCall: string | undefined;
    if (baseImdb) {
      const sidParts = sid.split(":");
      const sidHead = sidParts[0];
      if (sidHead.startsWith("tt")) {
        // Already an IMDB id (possibly "tt12345:S:E") — use as-is.
        imdbForCall = sid;
      } else if (type === "series" && sidParts.length >= 3) {
        // Non-IMDB catalog id like "tmdb:67890:1:5" or "kitsu:42:1:5".
        // The last two parts are the S:E pair we want; drop the catalog
        // prefix + source id and graft only "S:E" onto the imdb id.
        const s = sidParts[sidParts.length - 2];
        const e = sidParts[sidParts.length - 1];
        if (/^\d{1,4}$/.test(s) && /^\d{1,4}$/.test(e)) {
          imdbForCall = `${baseImdb}:${s}:${e}`;
        } else {
          imdbForCall = baseImdb;
        }
      } else {
        // Movie (or anything else): pass the bare IMDB id only.
        imdbForCall = baseImdb;
      }
    }
    setLoadingStreams(true);
    setStreamError(null);
    setStreams([]);
    setAddonStatuses([]);
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);

    if (!isLoggedIn) {
      setStreamError(
        "Sign in to your Stremio account in Settings to load streams from your installed addons."
      );
      setLoadingStreams(false);
      setStreamsLoaded(true);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }
    if (streamAddons.length === 0) {
      setStreamError(
        "No stream addons installed. Add a stream addon (e.g. Torrentio) in the Stremio app, then come back."
      );
      setLoadingStreams(false);
      setStreamsLoaded(true);
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    try {
      await getStreamsProgressive(type, sid, (p: AddonStreamProgress) => {
        setAddonStatuses((prev) => {
          const next = prev.filter((a) => a.addonId !== p.addonId);
          next.push({
            addonId: p.addonId,
            addonName: p.addonName,
            status: p.status,
            count: p.streams.length,
            durationMs: p.durationMs,
            httpStatus: p.httpStatus,
            errorMessage: p.errorMessage,
            transportUrl: p.transportUrl,
            requestUrls: p.requestUrls,
            responseSnippet: p.responseSnippet,
          });
          return next;
        });
        if (p.status === "done" && p.streams.length > 0) {
          const stamped = p.streams.map((s) => ({ ...s, addonName: s.addonName ?? p.addonName }));
          setStreams((prev) => [...prev, ...stamped]);
        }
      }, imdbForCall);
      setStreams((current) => {
        if (current.length === 0) {
          setStreamError("No streams found from your installed addons for this title.");
        }
        return current;
      });
    } catch {
      setStreamError("Failed to fetch streams. Check your connection.");
    } finally {
      setLoadingStreams(false);
      setStreamsLoaded(true);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Auto-load streams for movies (and series with no episode list) as soon as
  // the meta is loaded, so the user doesn't have to tap a "Find Streams" button.
  useEffect(() => {
    if (!meta || !type || !id) return;
    if (type === "series" && seasonNumbers.length > 0) return;
    if (streamsLoaded || loadingStreams) return;
    loadStreams();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [meta, type, id, seasonNumbers.length]);

  const handleEpisodePress = (ep: SeasonEpisode) => {
    if (activeEpisode?.id === ep.id) {
      setActiveEpisode(null);
      setStreams([]);
      setAddonStatuses([]);
      setStreamsLoaded(false);
      return;
    }
    setActiveEpisode(ep);
    setStreams([]);
    setAddonStatuses([]);
    setStreamsLoaded(false);
    const routeId = id ?? "";
    const streamId = routeId.startsWith("tt")
      ? `${routeId.split(":")[0]}:${ep.season}:${ep.episode}`
      : ep.id;
    loadStreams(streamId);
  };

  const handleStream = (stream: StremioStream) => {
    if (stream.url) {
      const routeId = id ?? "";
      const subtitleId = activeEpisode && routeId.startsWith("tt")
        ? `${routeId.split(":")[0]}:${activeEpisode.season}:${activeEpisode.episode}`
        : (activeEpisode?.id ?? routeId);
      const progressKey = activeEpisode
        ? `${type}:${routeId.split(":")[0]}:${activeEpisode.season}:${activeEpisode.episode}`
        : `${type}:${routeId}`;
      const episodeLabel = activeEpisode
        ? `S${activeEpisode.season}E${activeEpisode.episode}`
        : undefined;
      router.push({
        pathname: "/player",
        params: {
          url: stream.url,
          title: activeEpisode
            ? `${meta?.name} · S${activeEpisode.season}E${activeEpisode.episode}`
            : (meta?.name ?? "Stream"),
          type: type ?? "",
          subtitleId,
          progressKey,
          progressId: routeId,
          poster: meta?.poster ?? "",
          background: meta?.background ?? "",
          episodeLabel: episodeLabel ?? "",
        },
      });
    }
  };

  if (loadingMeta) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
        <Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading…</Text>
      </View>
    );
  }

  if (metaError || !meta) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <Feather name="alert-circle" size={40} color={colors.destructive} />
        <Text style={[styles.errorText, { color: colors.foreground }]}>{metaError ?? "Not found"}</Text>
        <Pressable onPress={() => router.back()}>
          <Text style={[styles.linkText, { color: colors.primary }]}>Go back</Text>
        </Pressable>
      </View>
    );
  }

  const currentEpisodes = seasonMap.get(selectedSeason) ?? [];
  const isSeries = type === "series";
  const hasEpisodes = isSeries && seasonNumbers.length > 0;

  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: colors.background }}
      contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.hero}>
        <Image source={{ uri: bgImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
        <LinearGradient colors={["rgba(0,0,0,0.15)", colors.background]} style={[StyleSheet.absoluteFill, { top: "25%" }]} />
        <Pressable style={[styles.backBtn, { top: insets.top + 8, backgroundColor: "rgba(0,0,0,0.55)" }]} onPress={() => router.back()}>
          <Feather name="arrow-left" size={20} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.content}>
        <View style={styles.posterRow}>
          {!!meta.poster && (
            <Image source={{ uri: meta.poster }} style={[styles.poster, { backgroundColor: colors.card }]} contentFit="cover" />
          )}
          <View style={styles.mainInfo}>
            <Text style={[styles.title, { color: colors.foreground }]}>{meta.name}</Text>
            <View style={styles.badges}>
              <View style={[styles.badge, { backgroundColor: colors.primary }]}>
                <Text style={[styles.badgeText, { color: colors.primaryForeground }]}>
                  {isSeries ? "SERIES" : "MOVIE"}
                </Text>
              </View>
              {meta.imdbRating ? (
                <View style={[styles.badge, { backgroundColor: colors.surface }]}>
                  <Feather name="star" size={10} color="#f59e0b" />
                  <Text style={[styles.badgeText, { color: "#f59e0b" }]}>{meta.imdbRating}</Text>
                </View>
              ) : null}
              {useTmdb && (
                <View style={[styles.badge, { backgroundColor: colors.surface }]}>
                  <Text style={[styles.badgeText, { color: colors.primary }]}>TMDB</Text>
                </View>
              )}
            </View>
            <View style={styles.metaRow}>
              {meta.releaseInfo ? <Text style={[styles.metaText, { color: colors.mutedForeground }]}>{meta.releaseInfo}</Text> : null}
              {meta.runtime ? <Text style={[styles.metaText, { color: colors.mutedForeground }]}>· {meta.runtime}</Text> : null}
            </View>
            {!!meta.genres && meta.genres.length > 0 && (
              <Text style={[styles.genres, { color: colors.mutedForeground }]}>{meta.genres.slice(0, 3).join(" · ")}</Text>
            )}
          </View>
        </View>

        {meta.description ? (
          <Text style={[styles.description, { color: colors.foreground }]}>{meta.description}</Text>
        ) : null}

        {isLoggedIn && addons.length > 0 && (
          <View style={{ gap: 6 }}>
            <Text style={[styles.addonLabel, { color: colors.mutedForeground }]}>ACTIVE ADDONS</Text>
            <View style={styles.addonRow}>
              <View style={[styles.addonChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <Feather name="database" size={11} color={colors.mutedForeground} />
                <Text style={[styles.addonChipText, { color: colors.mutedForeground }]}>Cinemeta</Text>
              </View>
              {catalogAddons.map((a) => (
                <View key={`cat-${a.manifest.id}`} style={[styles.addonChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Feather name="grid" size={11} color={colors.primary} />
                  <Text style={[styles.addonChipText, { color: colors.primary }]}>{a.manifest.name}</Text>
                </View>
              ))}
              {metaAddons.filter((a) => !catalogAddons.some((c) => c.manifest.id === a.manifest.id)).map((a) => (
                <View key={`meta-${a.manifest.id}`} style={[styles.addonChip, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Feather name="info" size={11} color={colors.primary} />
                  <Text style={[styles.addonChipText, { color: colors.primary }]}>{a.manifest.name}</Text>
                </View>
              ))}
              {streamAddons.map((a) => (
                <View key={`stream-${a.manifest.id}`} style={[styles.addonChip, { backgroundColor: colors.surface, borderColor: colors.primary }]}>
                  <Feather name="play" size={11} color={colors.primary} />
                  <Text style={[styles.addonChipText, { color: colors.primary }]}>{a.manifest.name}</Text>
                </View>
              ))}
            </View>
          </View>
        )}

        {!isSeries && loadingStreams && !streamsLoaded && (
          <View style={[styles.watchBtn, { backgroundColor: colors.surface }]}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.watchBtnText, { color: colors.foreground }]}>
              Searching streams{elapsed > 0 ? ` (${elapsed}s)` : ""}…
            </Text>
          </View>
        )}
        {!isSeries && streamsLoaded && (
          <Pressable
            style={({ pressed }) => [styles.watchBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.75 : 1 }]}
            onPress={() => loadStreams()}
            disabled={loadingStreams}
          >
            {loadingStreams ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.watchBtnText, { color: colors.foreground }]}>
                  Searching{elapsed > 0 ? ` (${elapsed}s)` : ""}…
                </Text>
              </View>
            ) : (
              <>
                <Feather name="refresh-cw" size={16} color={colors.foreground} />
                <Text style={[styles.watchBtnText, { color: colors.foreground }]}>Search Again</Text>
              </>
            )}
          </Pressable>
        )}

        {!isSeries && (loadingStreams || streamsLoaded) && (
          <StreamsList
            streams={streams}
            loadingStreams={loadingStreams}
            streamError={streamError}
            elapsed={elapsed}
            onPress={handleStream}
            colors={colors}
            addonStatuses={addonStatuses}
          />
        )}

        {hasEpisodes && (
          <>
            <View style={styles.sectionHeader}>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Episodes</Text>
              {loadingTmdb && (
                <View style={styles.tmdbBadge}>
                  <ActivityIndicator size="small" color={colors.primary} />
                  <Text style={[styles.tmdbBadgeText, { color: colors.mutedForeground }]}>Loading TMDB…</Text>
                </View>
              )}
            </View>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.seasonRow}>
              {seasonNumbers.map((s) => (
                <Pressable
                  key={s}
                  style={[
                    styles.seasonChip,
                    {
                      backgroundColor: selectedSeason === s ? colors.primary : colors.card,
                      borderColor: selectedSeason === s ? colors.primary : colors.border,
                    },
                  ]}
                  onPress={() => { setSelectedSeason(s); setActiveEpisode(null); setStreams([]); setAddonStatuses([]); setStreamsLoaded(false); }}
                >
                  <Text style={[styles.seasonChipText, { color: selectedSeason === s ? colors.primaryForeground : colors.foreground }]}>
                    S{s}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            <View style={styles.episodeList}>
              {currentEpisodes.map((ep) => {
                const isActive = activeEpisode?.id === ep.id;
                return (
                  <View key={ep.id}>
                    <Pressable
                      style={({ pressed }) => [
                        styles.episodeRow,
                        {
                          backgroundColor: isActive ? colors.surface : colors.card,
                          borderColor: isActive ? colors.primary : colors.border,
                          opacity: pressed ? 0.8 : 1,
                        },
                      ]}
                      onPress={() => handleEpisodePress(ep)}
                    >
                      {ep.thumbnail ? (
                        <Image source={{ uri: ep.thumbnail }} style={styles.episodeThumb} contentFit="cover" />
                      ) : (
                        <View style={[styles.episodeThumb, styles.episodeThumbPlaceholder, { backgroundColor: colors.surface }]}>
                          <Feather name="play" size={18} color={colors.mutedForeground} />
                        </View>
                      )}
                      <View style={styles.episodeInfo}>
                        <Text style={[styles.episodeNum, { color: colors.mutedForeground }]}>
                          E{ep.episode}{ep.runtime ? ` · ${ep.runtime}m` : ""}
                        </Text>
                        <Text style={[styles.episodeName, { color: colors.foreground }]} numberOfLines={2}>
                          {ep.title}
                        </Text>
                        {ep.overview ? (
                          <Text style={[styles.episodeDesc, { color: colors.mutedForeground }]} numberOfLines={2}>
                            {ep.overview}
                          </Text>
                        ) : null}
                      </View>
                      {isActive && loadingStreams ? (
                        <ActivityIndicator size="small" color={colors.primary} style={{ marginRight: 8 }} />
                      ) : (
                        <Feather name={isActive ? "chevron-down" : "play"} size={16} color={isActive ? colors.primary : colors.mutedForeground} />
                      )}
                    </Pressable>

                    {isActive && (loadingStreams || streamsLoaded) && (
                      <View style={[styles.inlineStreams, { backgroundColor: colors.background, borderColor: colors.border }]}>
                        <StreamsList
                          streams={streams}
                          loadingStreams={loadingStreams}
                          streamError={streamError}
                          elapsed={elapsed}
                          onPress={handleStream}
                          colors={colors}
                          addonStatuses={addonStatuses}
                          compact
                        />
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          </>
        )}

        {isSeries && !hasEpisodes && (
          <>
            {loadingStreams && !streamsLoaded && (
              <View style={[styles.watchBtn, { backgroundColor: colors.surface }]}>
                <ActivityIndicator color={colors.primary} />
                <Text style={[styles.watchBtnText, { color: colors.foreground }]}>
                  Searching streams{elapsed > 0 ? ` (${elapsed}s)` : ""}…
                </Text>
              </View>
            )}
            {streamsLoaded && (
              <Pressable
                style={({ pressed }) => [styles.watchBtn, { backgroundColor: colors.surface, opacity: pressed ? 0.75 : 1 }]}
                onPress={() => loadStreams()}
                disabled={loadingStreams}
              >
                {loadingStreams ? (
                  <View style={styles.loadingRow}>
                    <ActivityIndicator color={colors.primary} />
                    <Text style={[styles.watchBtnText, { color: colors.foreground }]}>Searching{elapsed > 0 ? ` (${elapsed}s)` : ""}…</Text>
                  </View>
                ) : (
                  <>
                    <Feather name="refresh-cw" size={16} color={colors.foreground} />
                    <Text style={[styles.watchBtnText, { color: colors.foreground }]}>Search Again</Text>
                  </>
                )}
              </Pressable>
            )}
            {(loadingStreams || streamsLoaded) && (
              <StreamsList streams={streams} loadingStreams={loadingStreams} streamError={streamError} elapsed={elapsed} onPress={handleStream} colors={colors} addonStatuses={addonStatuses} />
            )}
          </>
        )}
      </View>
    </ScrollView>
  );
}

function AddonStatusList({
  statuses,
  colors,
}: {
  statuses: AddonStatus[];
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
}) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  if (statuses.length === 0) return null;
  // Stable order: loading first, then by name.
  const sorted = [...statuses].sort((a, b) => {
    if (a.status === "loading" && b.status !== "loading") return -1;
    if (b.status === "loading" && a.status !== "loading") return 1;
    return a.addonName.localeCompare(b.addonName);
  });
  return (
    <View style={styles.addonStatusList}>
      {sorted.map((s) => {
        const isExpanded = expandedId === s.addonId;
        const isLoading = s.status === "loading";
        const isDone = s.status === "done";
        const isErr = s.status === "error" || s.status === "timeout";
        const dotColor = isLoading
          ? colors.mutedForeground
          : isErr
            ? colors.destructive
            : s.count > 0
              ? colors.primary
              : colors.mutedForeground;
        const detail = isLoading
          ? "searching…"
          : s.status === "timeout"
            ? `timed out · ${(s.durationMs / 1000).toFixed(1)}s`
            : s.status === "error"
              ? `${s.errorMessage ?? "failed"} · ${(s.durationMs / 1000).toFixed(1)}s`
              : s.count === 0
                ? `no streams · ${(s.durationMs / 1000).toFixed(1)}s`
                : `${s.count} stream${s.count === 1 ? "" : "s"} · ${(s.durationMs / 1000).toFixed(1)}s`;
        // Heuristic: a transport URL has a config segment if either
        // (a) it contains a redacted token marker "***" (meaning we
        // masked at least one secret), or (b) it's long enough that
        // it can't be just "<host>/manifest.json".
        const hasConfig =
          !!s.transportUrl &&
          (s.transportUrl.includes("***") || s.transportUrl.length > 80);
        const showConfigWarning = s.status === "done" && s.count === 0 && !!s.transportUrl && !hasConfig;
        return (
          <View key={s.addonId}>
            <Pressable
              style={({ pressed }) => [
                styles.addonStatusRow,
                {
                  backgroundColor: colors.card,
                  borderColor: isExpanded ? colors.primary : colors.border,
                  opacity: pressed ? 0.7 : 1,
                },
              ]}
              onPress={() => setExpandedId(isExpanded ? null : s.addonId)}
            >
              {isLoading ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <View style={[styles.statusDot, { backgroundColor: dotColor }]} />
              )}
              <Text style={[styles.addonStatusName, { color: colors.foreground }]} numberOfLines={1}>
                {s.addonName}
              </Text>
              <Text style={[styles.addonStatusDetail, { color: isDone && s.count > 0 ? colors.primary : colors.mutedForeground }]} numberOfLines={1}>
                {detail}
              </Text>
              <Text style={{ color: colors.mutedForeground, marginLeft: 8, fontSize: 12 }}>
                {isExpanded ? "▲" : "▼"}
              </Text>
            </Pressable>
            {isExpanded ? (
              <View
                style={{
                  backgroundColor: colors.card,
                  borderColor: colors.border,
                  borderWidth: 1,
                  borderTopWidth: 0,
                  marginTop: -6,
                  marginBottom: 6,
                  borderBottomLeftRadius: 12,
                  borderBottomRightRadius: 12,
                  padding: 12,
                  gap: 8,
                }}
              >
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>ID</Text>
                <Text selectable style={{ color: colors.foreground, fontSize: 12 }}>{s.addonId}</Text>
                {s.httpStatus !== undefined ? (
                  <>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>HTTP</Text>
                    <Text style={{ color: colors.foreground, fontSize: 12 }}>{s.httpStatus}</Text>
                  </>
                ) : null}
                {s.errorMessage ? (
                  <>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Error</Text>
                    <Text style={{ color: colors.destructive, fontSize: 12 }}>{s.errorMessage}</Text>
                  </>
                ) : null}
                {s.transportUrl ? (
                  <>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Transport URL</Text>
                    <Text selectable style={{ color: colors.foreground, fontSize: 11 }}>{s.transportUrl}</Text>
                  </>
                ) : null}
                {s.requestUrls && s.requestUrls.length > 0 ? (
                  <>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      Requested {s.requestUrls.length} URL(s)
                    </Text>
                    {s.requestUrls.map((u, i) => (
                      <Text key={i} selectable style={{ color: colors.foreground, fontSize: 11 }}>{u}</Text>
                    ))}
                  </>
                ) : null}
                {s.responseSnippet ? (
                  <>
                    <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>
                      Response (first 200 chars)
                    </Text>
                    <Text selectable style={{ color: colors.foreground, fontSize: 11 }}>{s.responseSnippet}</Text>
                  </>
                ) : null}
                {showConfigWarning ? (
                  <Text style={{ color: colors.destructive, fontSize: 12, marginTop: 4 }}>
                    ⚠ No config segment detected in transport URL — this addon may be installed without a Real-Debrid token. Re-install/configure it on web.stremio.com.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

function StreamsList({
  streams,
  loadingStreams,
  streamError,
  onPress,
  colors,
  addonStatuses,
  compact = false,
}: {
  streams: StremioStream[];
  loadingStreams: boolean;
  streamError: string | null;
  elapsed: number;
  onPress: (s: StremioStream) => void;
  colors: ReturnType<typeof import("@/hooks/useColors").useColors>;
  addonStatuses: AddonStatus[];
  compact?: boolean;
}) {
  const direct = streams.filter((s) => !!s.url);
  const torrentOnly = streams.filter((s) => !s.url && !!s.infoHash);
  const loadingCount = addonStatuses.filter((a) => a.status === "loading").length;
  const totalCount = addonStatuses.length;

  // Build the addon-filter tab list from the playable streams. Order by
  // first appearance so it matches the order Stremio returned results in.
  const addonTabs: { name: string; count: number }[] = [];
  for (const s of direct) {
    const name = s.addonName ?? "Other";
    const existing = addonTabs.find((t) => t.name === name);
    if (existing) existing.count += 1;
    else addonTabs.push({ name, count: 1 });
  }
  const [selectedAddon, setSelectedAddon] = useState<string>("All");
  // If the previously selected addon vanished (rare — e.g. streams cleared),
  // fall back to "All".
  useEffect(() => {
    if (selectedAddon !== "All" && !addonTabs.some((t) => t.name === selectedAddon)) {
      setSelectedAddon("All");
    }
  }, [addonTabs, selectedAddon]);
  const visibleStreams =
    selectedAddon === "All" ? direct : direct.filter((s) => (s.addonName ?? "Other") === selectedAddon);

  return (
    <View style={compact ? styles.streamsSectionCompact : styles.streamsSection}>
      {!compact && totalCount > 0 && (
        <Text style={[styles.streamsSubtitle, { color: colors.mutedForeground }]}>
          {loadingCount > 0
            ? `${totalCount - loadingCount}/${totalCount} addons · ${direct.length} playable so far`
            : `${direct.length} playable · ${torrentOnly.length} torrent-only · all ${totalCount} addons checked`}
        </Text>
      )}

      <AddonStatusList statuses={addonStatuses} colors={colors} />

      {streamError && !loadingStreams ? (
        <View style={[styles.noStreams, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="info" size={16} color={colors.mutedForeground} />
          <Text style={[styles.noStreamsText, { color: colors.mutedForeground }]}>{streamError}</Text>
        </View>
      ) : null}

      {addonTabs.length > 1 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.addonTabsRow}
        >
          {[{ name: "All", count: direct.length }, ...addonTabs].map((tab) => {
            const active = selectedAddon === tab.name;
            return (
              <Pressable
                key={tab.name}
                onPress={() => setSelectedAddon(tab.name)}
                style={({ pressed }) => [
                  styles.addonTabChip,
                  {
                    backgroundColor: active ? colors.primary : "transparent",
                    opacity: pressed ? 0.7 : 1,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.addonTabChipText,
                    { color: active ? colors.primaryForeground : colors.mutedForeground },
                  ]}
                  numberOfLines={1}
                >
                  {tab.name}
                  {tab.name !== "All" ? ` · ${tab.count}` : ""}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      )}

      {visibleStreams.map((stream, i) => (
        <Pressable
          key={`direct-${i}`}
          style={({ pressed }) => [styles.streamRow, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.75 : 1 }]}
          onPress={() => onPress(stream)}
        >
          <View style={[styles.streamIcon, { backgroundColor: colors.surface }]}>
            <Feather name="play-circle" size={18} color={colors.primary} />
          </View>
          <View style={styles.streamInfo}>
            <Text style={[styles.streamName, { color: colors.foreground }]} numberOfLines={1}>
              {stream.name ?? "Stream"}
            </Text>
            {stream.title ? (
              <Text style={[styles.streamMeta, { color: colors.mutedForeground }]} numberOfLines={2}>
                {stream.title}
              </Text>
            ) : null}
          </View>
          <Feather name="chevron-right" size={16} color={colors.mutedForeground} />
        </Pressable>
      ))}

      {torrentOnly.length > 0 && (
        <View style={[styles.torrentBox, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="alert-circle" size={15} color="#f59e0b" />
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.torrentTitle, { color: colors.foreground }]}>
              {torrentOnly.length} torrent-only stream{torrentOnly.length !== 1 ? "s" : ""}
            </Text>
            <Text style={[styles.torrentSub, { color: colors.mutedForeground }]}>
              These require a debrid service (e.g. Real-Debrid) linked in your Torrentio addon settings. Once linked, they become direct playable streams.
            </Text>
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: "center", alignItems: "center", gap: 12, padding: 32 },
  loadingText: { fontSize: 14, fontFamily: "Inter_400Regular" },
  errorText: { fontSize: 16, fontFamily: "Inter_500Medium", textAlign: "center" },
  linkText: { fontSize: 15, fontFamily: "Inter_500Medium" },
  hero: { height: 260, justifyContent: "flex-end" },
  backBtn: { position: "absolute", left: 16, width: 40, height: 40, borderRadius: 20, justifyContent: "center", alignItems: "center" },
  content: { paddingHorizontal: 16, paddingTop: 16, gap: 14 },
  posterRow: { flexDirection: "row", gap: 14, alignItems: "flex-start" },
  poster: { width: 100, height: 150, borderRadius: 10, flexShrink: 0 },
  mainInfo: { flex: 1, gap: 7, paddingTop: 4 },
  title: { fontSize: 22, fontFamily: "Inter_700Bold", lineHeight: 28 },
  badges: { flexDirection: "row", gap: 6, flexWrap: "wrap" },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 0.5 },
  metaRow: { flexDirection: "row", gap: 4, flexWrap: "wrap" },
  metaText: { fontSize: 13, fontFamily: "Inter_400Regular" },
  genres: { fontSize: 13, fontFamily: "Inter_400Regular" },
  description: { fontSize: 14, fontFamily: "Inter_400Regular", lineHeight: 21, opacity: 0.85 },
  sectionHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 6 },
  sectionTitle: { fontSize: 17, fontFamily: "Inter_700Bold" },
  tmdbBadge: { flexDirection: "row", alignItems: "center", gap: 6 },
  tmdbBadgeText: { fontSize: 12, fontFamily: "Inter_400Regular" },
  seasonRow: { gap: 8, paddingVertical: 2 },
  seasonChip: { paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
  seasonChipText: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  episodeList: { gap: 8 },
  episodeRow: { flexDirection: "row", alignItems: "center", borderRadius: 10, borderWidth: 1, overflow: "hidden" },
  episodeThumb: { width: 100, height: 64 },
  episodeThumbPlaceholder: { justifyContent: "center", alignItems: "center" },
  episodeInfo: { flex: 1, padding: 10, gap: 2 },
  episodeNum: { fontSize: 11, fontFamily: "Inter_400Regular" },
  episodeName: { fontSize: 13, fontFamily: "Inter_600SemiBold", lineHeight: 17 },
  episodeDesc: { fontSize: 11, fontFamily: "Inter_400Regular", lineHeight: 15 },
  inlineStreams: { borderLeftWidth: 1, borderRightWidth: 1, borderBottomWidth: 1, borderBottomLeftRadius: 10, borderBottomRightRadius: 10, marginTop: -8, paddingTop: 8, paddingHorizontal: 8, paddingBottom: 8 },
  watchBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, paddingVertical: 14, borderRadius: 12 },
  loadingRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  watchBtnText: { fontSize: 16, fontFamily: "Inter_600SemiBold" },
  streamsSection: { gap: 8 },
  streamsSectionCompact: { gap: 6, paddingTop: 4 },
  streamsSubtitle: { fontSize: 13, fontFamily: "Inter_400Regular" },
  noStreams: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 10, borderWidth: 1, alignItems: "flex-start" },
  noStreamsText: { flex: 1, fontSize: 13, fontFamily: "Inter_400Regular", lineHeight: 18 },
  streamRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12, borderRadius: 10, borderWidth: 1 },
  streamIcon: { width: 40, height: 40, borderRadius: 10, justifyContent: "center", alignItems: "center" },
  streamInfo: { flex: 1 },
  streamName: { fontSize: 13, fontFamily: "Inter_500Medium", lineHeight: 18 },
  streamMeta: { fontSize: 11, fontFamily: "Inter_400Regular", marginTop: 2 },
  torrentBox: { flexDirection: "row", gap: 10, padding: 14, borderRadius: 10, borderWidth: 1, alignItems: "flex-start" },
  torrentTitle: { fontSize: 13, fontFamily: "Inter_600SemiBold" },
  torrentSub: { fontSize: 12, fontFamily: "Inter_400Regular", lineHeight: 17 },
  addonLabel: { fontSize: 10, fontFamily: "Inter_700Bold", letterSpacing: 1 },
  addonRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  addonChip: { flexDirection: "row", alignItems: "center", gap: 5, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, borderWidth: 1 },
  addonChipText: { fontSize: 11, fontFamily: "Inter_500Medium" },
  addonTabsRow: { gap: 6, paddingVertical: 6, paddingHorizontal: 2 },
  addonTabChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18 },
  addonTabChipText: { fontSize: 12, fontFamily: "Inter_600SemiBold", maxWidth: 200 },
  addonStatusList: { gap: 4, marginBottom: 4 },
  addonStatusRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 8, borderWidth: 1 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  addonStatusName: { flex: 1, fontSize: 12, fontFamily: "Inter_500Medium" },
  addonStatusDetail: { fontSize: 11, fontFamily: "Inter_400Regular" },
});
