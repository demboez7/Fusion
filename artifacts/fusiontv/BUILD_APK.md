# Building a StreamTV APK

This produces a real installable Android APK that runs without Expo Go and
includes the full native player.

## One-time setup (on your computer, not Replit)

You need Node.js 20+ and a free Expo account.

```bash
# 1. Install the EAS CLI globally
npm install -g eas-cli

# 2. Log in to Expo (creates a free account if you don't have one)
eas login

# 3. Clone this repo locally and install deps
git clone <this-repo-url>
cd <repo>
pnpm install

# 4. From the streamtv artifact, link the project to your Expo account
cd artifacts/streamtv
eas init           # answer "yes" to create a new EAS project
```

`eas init` writes a `projectId` into `app.json`. Commit that change.

## Building the APK

```bash
# From artifacts/streamtv
eas build --platform android --profile preview
```

That uploads your code to Expo's build servers and produces an APK. The
build takes ~10–15 minutes. When it finishes, the CLI prints a download
URL — open it on your phone to install.

The `preview` profile is configured for `buildType: apk` (the default
`production` profile produces an `.aab` Play Store bundle, which can't be
installed directly).

## Installing on your phone

1. Download the `.apk` from the URL the CLI printed.
2. Tap the file. Android will ask permission to install from unknown sources — grant it once.
3. Open StreamTV. Log in with your Stremio account, your addons load,
   the player works with full native controls. No Expo Go needed.

## Updating the app later

For JS-only changes (most code edits), you can publish an OTA update
without rebuilding the APK:

```bash
eas update --branch preview
```

Users get the update next time they open the app. You only need a new
APK build when you change native code or `app.json` plugins.

## Notes

- The current player uses `expo-video` (ExoPlayer on Android). It plays
  MP4, standard HLS, and DASH well. If you hit a stream it can't play
  (rare codec, MKV with weird audio), the player shows an "Open in
  another app" button so you can hand the URL to VLC.
- Background playback and picture-in-picture are enabled in `app.json`.
- TV launcher intent (`LEANBACK_LAUNCHER`) is included so the same APK
  installs as a real app on Android TV too.
