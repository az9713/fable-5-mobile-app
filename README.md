# Ideas — a voice-notes app for your creative brain

A single-user glassmorphism voice-notes app: tap record, talk, and it transcribes, titles, and summarizes your idea with AI. Built with Expo (React Native), local-only, no accounts.

Record → **Whisper** transcription → **Claude Haiku** auto-title + summary + next-steps → filed in Inbox → move into glass folders → expand/append/chat with any note.

## Stack
- **Expo SDK 54** / React Native 0.81 / expo-router (⚠️ **pinned to SDK 54** — the phone's Expo Go supports no higher; do not upgrade the SDK)
- Local **SQLite** (expo-sqlite) — the only copy of your notes lives on the device
- OpenAI Whisper (transcription) + Anthropic Claude Haiku (analysis & chat), called directly from the app
- Glass UI via expo-blur iOS vibrancy materials + reanimated

## Run it on your iPhone (Expo Go)
You need: Node, the app deps installed (`cd app && npm install`), the **Expo Go** app on your iPhone, and your API keys.

1. Put your keys in `app/.env` (git-ignored) for development:
   ```
   EXPO_PUBLIC_OPENAI_KEY=sk-...
   EXPO_PUBLIC_ANTHROPIC_KEY=sk-ant-...
   ```
   (Or leave `app/.env` empty and paste them into the in-app **Settings** screen — they save to the iOS Keychain.)
2. Start the dev server **from the `app/` folder**:
   ```bash
   cd app
   npx expo start --tunnel
   ```
   Use `--tunnel` because this network blocks LAN device-to-device. If ngrok errors, retry once or twice — it's transient.
3. On the iPhone: **Camera app → scan the QR** → opens in Expo Go. Watch the terminal for `iOS Bundling … 100%` to confirm it loaded fresh code. Press `r` in the terminal to force a reload.

The app only runs while this dev server is up. That's an iOS limitation of Expo Go — see Deploy below.

## Tests
```bash
cd app && npm test -- --maxWorkers=2   # ~105 tests
npx tsc --noEmit                        # type check
npx expo export --platform ios --output-dir /tmp/check   # proves the bundle builds
```

## Deploy — running without the PC/tunnel
There is **no free, PC-independent way** to run this on iOS. Expo Go only loads from a running dev server, and EAS Update does **not** load in Expo Go without a build. To get an "Ideas" app that installs on the phone and runs on its own, you need an **EAS Build standalone**, which requires the **$99/yr Apple Developer Program** (or a Mac for 7-day free provisioning). If you get either, the build is one command:
```bash
cd app && eas build --platform ios --profile preview   # after eas device:create + provisioning
```

## Data safety
Your notes live only in this device's SQLite. **Deleting Expo Go deletes every note.** Use **Settings → Export all notes** (Markdown + JSON via the share sheet) to back up — do it after any session that matters.

## Layout
- `app/src/theme/` — design tokens + glass + backgrounds
- `app/src/components/` — GlassCard, RecordButton, FolderTile, NoteRow, ChatDrawer, Background
- `app/src/db/` — SQLite adapter, schema, repo (tested against better-sqlite3)
- `app/src/ai/` — whisper.ts, anthropic.ts
- `app/src/store/` — zustand store, secrets (Keychain)
- `app/src/app/` — expo-router screens (index, folder/[id], note/[id], settings)
- `docs/plans/` — the full implementation plan this was built from
