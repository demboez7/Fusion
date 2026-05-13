# Fusion

A self-contained Android streaming app that fuses **Stremio addons** and
**IPTV (M3U + EPG)** into a single Netflix-style interface, with its own
built-in video player, subtitle engine, and continue-watching tracker.

Built with Expo (React Native), targeted at Android phones and Android
TV / Google TV devices, distributed as a sideloaded APK via EAS Build.

---

## What it can do

- **Watch movies and TV series** through your own Stremio account: catalogs,
  artwork, descriptions, episode lists, and stream links all come from the
  Stremio addons you already have installed in the official Stremio app.
- **Watch live TV** from any IPTV provider via an M3U / M3U8 playlist URL,
  with channel groups, search, and an optional XMLTV EPG (electronic program
  guide) showing what's on now and next.
- **Resume where you left off.** A "Continue Watching" row tracks every
  movie and episode you start, the exact stream you used, and the second
  you stopped at — tap a card and the player jumps straight back into the
  same stream at the same timestamp.
- **Pick subtitles from any of your Stremio subtitle addons** — including
  multi-language community providers and Hebrew-specific addons — and
  render them locally so they work even on streams with no embedded subs.
- **Browse and search** across catalogs from all your installed addons:
  Cinemeta, MediaFusion, Anime Kitsu, Real-Debrid catalogs, Local Files,
  custom community addons, and more.
- **Filter streams by addon.** When several addons return results for the
  same title, a tab strip lets you isolate just one provider (Torrentio,
  MediaFusion, Comet, Jackettio, Sootio, …) so you can quickly compare
  quality / size / source.
- **Run on phones, tablets, and Android TV** with a layout that adapts to
  remote-control navigation on big screens.

---

## How it does it

Fusion is a thin, fully-local client that talks **directly** to the public
Stremio APIs and to your IPTV provider's servers. There is no Fusion
backend, no account system, and no telemetry — your Stremio auth key,
addon list, IPTV URL, and watch progress live only in the app's local
storage on the device.

### Stremio integration (`services/stremio.ts` + `contexts/StremioContext.tsx`)

- **Login** is performed against `api.strem.io` with your Stremio email and
  password. The returned `authKey` is stored in `AsyncStorage` and used to
  fetch your installed addon collection.
- **Catalogs** are pulled from each installed catalog addon's
  `/catalog/<type>/<id>.json` endpoint and aggregated into Netflix-style
  rows on the Movies / Series / Home screens.
- **Metadata** (poster, background, description, cast, episode list) comes
  from Cinemeta or any meta addon that supports the title's id type
  (`tt…`, `tmdb:…`, `kitsu:…`, `mf:…`, etc.).
- **Streams** are fetched in parallel from every stream-capable addon
  (Torrentio, MediaFusion, Comet, Jackettio, Peerflix, Sootio, Real-Debrid
  Israel build, WebStreamr, TorrentsDB, …). Results stream into the UI
  progressively so you don't wait for the slowest addon to finish.
- **Cross-id resolution.** Many debrid / torrent addons only accept IMDB
  ids (`tt…`). When the title's primary id is a TMDB or Kitsu id, Fusion
  derives the IMDB form from `meta.imdb_id` (with `:S:E` appended for TV
  episodes) and tries every candidate id each addon's manifest claims to
  support. This is what unlocks Torrentio / Comet / Jackettio results on
  non-IMDB catalogs.
- **Subtitles** use the same multi-id strategy (`fetchSubtitlesFromAddons`):
  every subtitle addon is queried with every id form it accepts, results
  are deduped by URL, and each entry is tagged with the addon name.

### IPTV integration (`services/m3u-parser.ts`, `services/epg.ts`,
`contexts/IptvContext.tsx`)

- Paste an M3U / M3U8 URL in **Settings → IPTV**. The playlist is
  downloaded, parsed locally, and channels are grouped by their `group-title`
  attribute.
- An optional XMLTV EPG URL parses programs into per-channel timelines
  with timezone-aware start/stop times. The "Now Playing" badge on each
  channel tile reads the current program from this index.

### The video player (`app/player.tsx`)

- Built on **expo-video**'s `useVideoPlayer` for native, hardware-accelerated
  playback (ExoPlayer on Android).
- Supports HLS, DASH, MP4, MKV, and the magnet/direct URLs returned by
  debrid addons.
- Custom UI overlay with seek bar, skip ±10s, subtitles button, audio
  track picker, and back-to-detail navigation.
- **External subtitle engine.** When you pick a subtitle from a Stremio
  addon, Fusion downloads the file (`.srt` / `.vtt`), parses it locally
  (`services/subtitles.ts`), and renders cues over the video — so subs
  work even when the underlying stream has no embedded text tracks. The
  parser also strips the promo / attribution cues many addons inject as
  the first one or two lines.
- **Position tracking.** Every 5 seconds the player fires a
  `recordProgress(...)` call carrying the current position, duration, and
  the URL/title/subtitleId of the stream you chose.

### Continue Watching (`contexts/ProgressContext.tsx` +
`components/ContinueWatchingCard.tsx`)

- Progress is keyed by `<type>:<id>` for movies and
  `<type>:<imdbId>:S:E` for episodes, capped at the 50 most recent
  entries, persisted in `AsyncStorage` under `watch_progress_v1`.
- Each entry stores the **exact stream URL, stream title, and selected
  subtitle id** you last used, plus poster/background and the position in
  seconds.
- Tapping a Continue Watching card pushes straight into `/player` with a
  `resumePosition` param; the player seeks to that timestamp the first
  time the video reports `readyToPlay`.

---

## Features at a glance

- Movies, Series, Home, IPTV, and Settings tabs.
- Search across all configured catalogs.
- Hero banner with featured artwork.
- Per-addon stream tabs (`All / Torrentio · 12 / MediaFusion · 8 / …`)
  on every detail page.
- Continue Watching row with progress bar and dismiss button.
- Resume-from-last-stream (URL + position + subtitle).
- Multi-addon subtitle pickup with per-addon labels.
- Hebrew-friendly: the UI handles RTL strings, Hebrew-named addons, and
  Hebrew-specific Telegram subtitle providers out of the box.
- IPTV channels with optional XMLTV EPG and "Now Playing" badges.
- Hidden-addon filter so noisy / broken addons can be excluded from
  stream search without uninstalling them in Stremio.
- Light / dark theme that follows the OS.
- Android TV / Google TV launcher entry (`LEANBACK_LAUNCHER`).

---

## Project layout

```text
artifacts/streamtv/
├── app/                          # expo-router screens
│   ├── (tabs)/
│   │   ├── index.tsx             # Home (Continue Watching, featured rows)
│   │   ├── movies.tsx            # Movies catalog rows
│   │   ├── series.tsx            # TV catalog rows
│   │   ├── iptv.tsx              # Live TV channel grid + EPG
│   │   └── settings.tsx          # Login, IPTV URL, subtitle prefs, About
│   ├── detail.tsx                # Title detail + episode list + streams
│   ├── player.tsx                # Video player + subtitle overlay
│   └── _layout.tsx               # Providers (Settings/Stremio/IPTV/Progress)
├── components/                   # ContentCard, ContinueWatchingCard, …
├── contexts/
│   ├── StremioContext.tsx        # auth, addons, streams, subtitles
│   ├── IptvContext.tsx           # M3U + EPG state
│   ├── SettingsContext.tsx       # hidden addons, IPTV URL, theme
│   └── ProgressContext.tsx       # Continue Watching store
├── services/
│   ├── stremio.ts                # Stremio API + addon fan-out
│   ├── subtitles.ts              # SRT/VTT parser + promo stripping
│   ├── m3u-parser.ts             # IPTV M3U parser
│   ├── epg.ts                    # XMLTV EPG parser
│   └── tmdb.ts                   # Optional TMDB enrichment
├── hooks/useColors.ts            # Theme tokens
├── assets/images/                # icon.png (app + splash + favicon)
├── app.json                      # Expo config (name, icon, perms, plugins)
├── eas.json                      # EAS Build profiles
└── package.json
```

---

## Tech stack

- **Expo SDK 54** (React Native 0.81, New Architecture enabled)
- **TypeScript 5.9** (strict)
- **expo-router** for file-based navigation
- **expo-video** for native playback (ExoPlayer on Android)
- **@react-native-async-storage/async-storage** for local persistence
- **react-native-reanimated** for animations
- **react-native-safe-area-context** + **react-native-screens** for layout
- **@expo/vector-icons** (Feather)
- Built and signed via **EAS Build** (`preview` profile → APK)

---

## Building and running

### Run in development on the local network

```bash
pnpm --filter @workspace/streamtv run dev
```

This starts the Expo dev server. Scan the QR code with Expo Go (Android)
or open the LAN URL on a device on the same network. Live reload is
enabled.

### Build a sideload APK with EAS

From `artifacts/streamtv/`:

```bash
eas build --platform android --profile preview
```

The `preview` profile in `eas.json` produces an APK (not an AAB) signed
with an EAS-managed keystore, suitable for direct sideload to a phone or
Android TV. EAS uploads the build artifact and prints a download link.

If a build dies with **"We've lost connection to the worker"** that's an
intermittent EAS infrastructure failure — just re-run the same command.

### Optional environment variables

- `TMDB_API_KEY` — exposed to the app as `EXPO_PUBLIC_TMDB_API_KEY` and
  used to enrich missing artwork / metadata from TMDB. Optional;
  Cinemeta covers the vast majority of titles.

No other env vars are required. Stremio credentials and the IPTV URL
are entered inside the app at runtime and stored in `AsyncStorage`.

---

## Privacy

- Fusion has **no backend**. There is no Fusion server, no account
  system, no analytics, and no telemetry.
- Your Stremio email/password is sent **only** to `api.strem.io` (the
  official Stremio backend) to log in. Only the resulting `authKey` is
  stored on the device.
- Stream and subtitle requests go **directly** from your device to the
  third-party addons you have installed in Stremio.
- Watch progress, hidden-addon list, IPTV URL, and theme preference are
  stored only in local `AsyncStorage` on the device. Uninstalling the
  app erases them.

---

## Version

**v1.0 Beta** — current sideload-only Android build.
